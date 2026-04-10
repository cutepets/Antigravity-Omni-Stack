import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { createHash, timingSafeEqual } from 'crypto'
import { DatabaseService } from '../../database/database.service.js'
import { OrdersService } from './orders.service.js'
import { PaymentIntentEventsService } from './payment-intent-events.service.js'

type NormalizedBankTransferEvent = {
  provider: string
  sourceEventKey: string
  dedupeKey: string
  externalEventId?: string | null
  externalTxnId?: string | null
  bankBin?: string | null
  accountNumber: string
  amount: number
  currency: string
  direction: 'IN' | 'OUT'
  description: string
  normalizedDescription: string
  txnAt?: Date | null
  rawPayload: Record<string, unknown>
}

type MatchCandidate = {
  id: string
  code: string
  status: 'PENDING' | 'PAID' | 'EXPIRED'
  amount: number
  transferContent: string
  paymentMethodId: string
  orderId?: string | null
  orderNumber?: string | null
}

type BankTransactionRecord = {
  id: string
  provider: string
  sourceEventKey?: string | null
  dedupeKey: string
  externalEventId?: string | null
  externalTxnId?: string | null
  bankBin?: string | null
  accountNumber: string
  amount: number
  currency: string
  direction: string
  description: string
  normalizedDescription: string
  status: string
  classification: string
  isTest: boolean
  sourceCount: number
  matchedPaymentIntentId?: string | null
  matchedOrderId?: string | null
  matchedPaymentMethodId?: string | null
  matchReason?: string | null
  note?: string | null
  txnAt?: Date | null
  processedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class PaymentWebhookService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly ordersService: OrdersService,
    private readonly paymentIntentEvents: PaymentIntentEventsService,
  ) {}

  async processBankTransferWebhook(
    provider: string,
    payload: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
  ) {
    await this.assertWebhookSecret(provider, headers)
    return this.processBankTransferWebhookPayload(provider, payload)
  }

  async testBankTransferWebhook(provider: string, payload: Record<string, unknown>) {
    const event = this.normalizeBankTransferEvent(provider, payload)
    const matched = this.shouldAttemptSalesPaymentMatch(event)
      ? await this.findMatchingIntent(event)
      : null
    const bankTransaction = await this.createTestBankTransaction(event, matched)

    return {
      ok: true,
      persisted: true,
      status: matched ? (matched.status === 'PAID' ? 'already_paid' : 'matched') : 'unmatched',
      bankTransaction: this.mapBankTransactionResult(bankTransaction),
      normalizedEvent: {
        provider: event.provider,
        accountNumber: event.accountNumber,
        bankBin: event.bankBin ?? null,
        amount: event.amount,
        currency: event.currency,
        direction: event.direction,
        description: event.description,
        normalizedDescription: event.normalizedDescription,
        txnAt: event.txnAt?.toISOString() ?? null,
      },
      matchedPaymentIntent: matched
        ? {
            id: matched.id,
            code: matched.code,
            status: matched.status,
            orderId: matched.orderId ?? null,
            orderNumber: matched.orderNumber ?? null,
            amount: matched.amount,
            paymentMethodId: matched.paymentMethodId,
            transferContent: matched.transferContent,
          }
        : null,
    }
  }

  async listBankTransactions(params?: {
    scope?: string
    status?: string
    search?: string
  }) {
    const scope = params?.scope
    const normalizedScope = String(scope ?? 'all').trim().toLowerCase()
    const normalizedStatus = String(params?.status ?? '').trim().toUpperCase()
    const normalizedSearch = String(params?.search ?? '').trim()
    const where: Record<string, unknown> = {}

    if (normalizedScope === 'test') {
      where['isTest'] = true
    } else if (normalizedScope === 'real') {
      where['isTest'] = false
    }

    if (normalizedStatus && normalizedStatus !== 'ALL') {
      where['status'] = normalizedStatus
    }

    if (normalizedSearch) {
      where['OR'] = [
        { provider: { contains: normalizedSearch, mode: 'insensitive' } },
        { accountNumber: { contains: normalizedSearch } },
        { description: { contains: normalizedSearch, mode: 'insensitive' } },
        { normalizedDescription: { contains: this.normalizeLookupToken(normalizedSearch), mode: 'insensitive' } },
        { externalTxnId: { contains: normalizedSearch, mode: 'insensitive' } },
        { paymentIntent: { code: { contains: normalizedSearch, mode: 'insensitive' } } },
        { order: { orderNumber: { contains: normalizedSearch, mode: 'insensitive' } } },
      ]
    }

    const records = await (this.prisma as any).bankTransaction.findMany({
      where,
      orderBy: [
        { txnAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 100,
      include: {
        paymentIntent: {
          select: {
            id: true,
            code: true,
            status: true,
            amount: true,
            transferContent: true,
            orderId: true,
            order: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
      },
    })

    return records.map((record: any) => this.mapBankTransactionResult(record))
  }

  async removeTestBankTransaction(id: string) {
    const bankTransaction = await (this.prisma as any).bankTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        isTest: true,
      },
    })

    if (!bankTransaction) {
      throw new NotFoundException('Khong tim thay giao dich ngan hang')
    }

    if (!bankTransaction.isTest) {
      throw new ConflictException('Chi duoc xoa du lieu test webhook')
    }

    await (this.prisma as any).bankTransaction.delete({
      where: { id },
    })

    return {
      success: true,
      message: 'Da xoa du lieu test webhook',
    }
  }

  private async processBankTransferWebhookPayload(
    provider: string,
    payload: Record<string, unknown>,
  ) {
    const paymentWebhookEvent = (this.prisma as any).paymentWebhookEvent

    const event = this.normalizeBankTransferEvent(provider, payload)
    const created = await paymentWebhookEvent.create({
      data: {
        provider: event.provider,
        sourceEventKey: event.sourceEventKey,
        dedupeKey: event.dedupeKey,
        externalEventId: event.externalEventId ?? null,
        externalTxnId: event.externalTxnId ?? null,
        bankBin: event.bankBin ?? null,
        accountNumber: event.accountNumber,
        amount: event.amount,
        currency: event.currency,
        direction: event.direction,
        description: event.description,
        normalizedDescription: event.normalizedDescription,
        txnAt: event.txnAt ?? null,
        rawPayload: event.rawPayload as any,
      } as any,
    })
    const matched = this.shouldAttemptSalesPaymentMatch(event)
      ? await this.findMatchingIntent(event)
      : null
    const bankTransaction = await this.findOrCreateRealBankTransaction(event)

    await paymentWebhookEvent.update({
      where: { id: created.id },
      data: {
        bankTransactionId: bankTransaction.id,
      } as any,
    })

    const duplicateOf = await this.findDuplicateEvent(created.id, event)
    if (duplicateOf) {
      await paymentWebhookEvent.update({
        where: { id: created.id },
        data: {
          bankTransactionId: bankTransaction.id,
          status: 'DUPLICATE',
          duplicateOfId: duplicateOf.id,
          matchedPaymentIntentId: duplicateOf.matchedPaymentIntentId ?? null,
          matchedOrderId: duplicateOf.matchedOrderId ?? null,
          matchedPaymentMethodId: duplicateOf.matchedPaymentMethodId ?? null,
          note: `Duplicate event of ${duplicateOf.id}`,
          processedAt: new Date(),
        } as any,
      })

      return {
        ok: true,
        status: 'duplicate',
        eventId: created.id,
        bankTransactionId: bankTransaction.id,
        duplicateOfId: duplicateOf.id,
        matchedPaymentIntentId: duplicateOf.matchedPaymentIntentId ?? null,
      }
    }

    if (!matched) {
      const unmatchedNote = this.buildUnmatchedNote(event)
      await paymentWebhookEvent.update({
        where: { id: created.id },
        data: {
          bankTransactionId: bankTransaction.id,
          status: 'UNMATCHED',
          note: unmatchedNote,
          processedAt: new Date(),
        } as any,
      })

      await this.updateBankTransactionState(bankTransaction.id, {
        status: 'REVIEW',
        classification: 'UNCLASSIFIED',
        note: unmatchedNote,
        processedAt: new Date(),
      })

      return {
        ok: true,
        status: 'unmatched',
        eventId: created.id,
        bankTransactionId: bankTransaction.id,
      }
    }

    if (matched.status === 'PAID') {
      await paymentWebhookEvent.update({
        where: { id: created.id },
        data: {
          bankTransactionId: bankTransaction.id,
          status: 'IGNORED_ALREADY_PAID',
          matchedPaymentIntentId: matched.id,
          matchedOrderId: matched.orderId ?? null,
          matchedPaymentMethodId: matched.paymentMethodId,
          matchReason: 'orderCode+amount',
          note: 'Matched an already-paid payment intent',
          processedAt: new Date(),
        } as any,
      })

      await this.updateBankTransactionState(bankTransaction.id, {
        status: 'IGNORED',
        classification: 'SALES_PAYMENT',
        matchedPaymentIntentId: matched.id,
        matchedOrderId: matched.orderId ?? null,
        matchedPaymentMethodId: matched.paymentMethodId,
        matchReason: 'orderCode+amount',
        note: 'Matched an already-paid payment intent',
        processedAt: new Date(),
      })

      return {
        ok: true,
        status: 'already_paid',
        eventId: created.id,
        bankTransactionId: bankTransaction.id,
        matchedPaymentIntentId: matched.id,
      }
    }

    try {
      const result = await this.ordersService.confirmPaymentIntentPaidFromWebhook({
        intentId: matched.id,
        provider: event.provider,
        paidAt: event.txnAt ?? new Date(),
        externalTxnId: event.externalTxnId ?? null,
        note: `Webhook ${event.provider}${event.externalTxnId ? ` #${event.externalTxnId}` : ''}`,
      })

      await paymentWebhookEvent.update({
        where: { id: created.id },
        data: {
          bankTransactionId: bankTransaction.id,
          status: result.outcome === 'APPLIED' ? 'APPLIED' : 'IGNORED_ALREADY_PAID',
          matchedPaymentIntentId: matched.id,
          matchedOrderId: matched.orderId ?? null,
          matchedPaymentMethodId: matched.paymentMethodId,
          matchReason: 'orderCode+amount',
          processedAt: new Date(),
          note:
            result.outcome === 'APPLIED'
              ? 'Payment intent confirmed successfully'
              : 'Payment intent was already paid before this event applied',
        } as any,
      })

      await this.updateBankTransactionState(bankTransaction.id, {
        status: result.outcome === 'APPLIED' ? 'APPLIED' : 'IGNORED',
        classification: 'SALES_PAYMENT',
        matchedPaymentIntentId: matched.id,
        matchedOrderId: matched.orderId ?? null,
        matchedPaymentMethodId: matched.paymentMethodId,
        matchReason: 'orderCode+amount',
        note:
          result.outcome === 'APPLIED'
            ? 'Payment intent confirmed successfully'
            : 'Payment intent was already paid before this event applied',
        processedAt: new Date(),
      })

      if (result.outcome === 'APPLIED') {
        this.paymentIntentEvents.emitPaid({
          code: result.intent.code,
          intentId: result.intent.id,
          orderId: result.intent.orderId ?? null,
          amount: result.intent.amount,
          paidAt: result.intent.paidAt ?? new Date().toISOString(),
          provider: event.provider,
          externalTxnId: event.externalTxnId ?? null,
        })
      }

      return {
        ok: true,
        status: result.outcome === 'APPLIED' ? 'applied' : 'already_paid',
        eventId: created.id,
        bankTransactionId: bankTransaction.id,
        matchedPaymentIntentId: matched.id,
        paymentIntentCode: result.intent.code,
        orderId: result.intent.orderId ?? null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Webhook processing failed'

      await paymentWebhookEvent.update({
        where: { id: created.id },
        data: {
          bankTransactionId: bankTransaction.id,
          status: 'REJECTED',
          matchedPaymentIntentId: matched.id,
          matchedOrderId: matched.orderId ?? null,
          matchedPaymentMethodId: matched.paymentMethodId,
          matchReason: 'orderCode+amount',
          note: message,
          processedAt: new Date(),
        } as any,
      })

      await this.updateBankTransactionState(bankTransaction.id, {
        status: 'REJECTED',
        classification: 'SALES_PAYMENT',
        matchedPaymentIntentId: matched.id,
        matchedOrderId: matched.orderId ?? null,
        matchedPaymentMethodId: matched.paymentMethodId,
        matchReason: 'orderCode+amount',
        note: message,
        processedAt: new Date(),
      })

      return {
        ok: false,
        status: 'rejected',
        eventId: created.id,
        bankTransactionId: bankTransaction.id,
        message,
      }
    }
  }

  private async findDuplicateEvent(eventId: string, event: NormalizedBankTransferEvent) {
    const duplicate = await (this.prisma as any).paymentWebhookEvent.findFirst({
      where: {
        id: { not: eventId },
        status: {
          in: ['APPLIED', 'IGNORED_ALREADY_PAID', 'DUPLICATE'],
        },
        OR: [
          { sourceEventKey: event.sourceEventKey },
          { dedupeKey: event.dedupeKey },
        ],
      },
      select: {
        id: true,
        matchedPaymentIntentId: true,
        matchedOrderId: true,
        matchedPaymentMethodId: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return duplicate
  }

  private async findMatchingIntent(event: NormalizedBankTransferEvent): Promise<MatchCandidate | null> {
    const candidates = await this.prisma.paymentIntent.findMany({
      where: {
        amount: event.amount,
        paymentMethod: {
          type: 'BANK',
          accountNumber: event.accountNumber,
          ...(event.bankBin ? { qrBankBin: event.bankBin } : {}),
        },
      },
      select: {
        id: true,
        code: true,
        status: true,
        amount: true,
        transferContent: true,
        paymentMethodId: true,
        orderId: true,
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const matched = candidates.filter((candidate) => {
      const orderToken = this.normalizeLookupToken(candidate.order?.orderNumber ?? '')
      const transferToken = this.normalizeLookupToken(candidate.transferContent)

      return (
        Boolean(transferToken && event.normalizedDescription.includes(transferToken))
        || Boolean(orderToken && event.normalizedDescription.includes(orderToken))
      )
    })

    if (matched.length === 0) {
      return null
    }

    const exactPending = matched.filter((candidate) => candidate.status === 'PENDING')
    if (exactPending.length === 1) {
      const candidate = exactPending[0]!
      return {
        id: candidate.id,
        code: candidate.code,
        status: candidate.status,
        amount: candidate.amount,
        transferContent: candidate.transferContent,
        paymentMethodId: candidate.paymentMethodId,
        orderId: candidate.orderId ?? null,
        orderNumber: candidate.order?.orderNumber ?? null,
      }
    }

    if (exactPending.length > 1) {
      return null
    }

    const paidCandidate = matched.find((candidate) => candidate.status === 'PAID')
    if (!paidCandidate) {
      return null
    }

    return {
      id: paidCandidate.id,
      code: paidCandidate.code,
      status: paidCandidate.status,
      amount: paidCandidate.amount,
      transferContent: paidCandidate.transferContent,
      paymentMethodId: paidCandidate.paymentMethodId,
      orderId: paidCandidate.orderId ?? null,
      orderNumber: paidCandidate.order?.orderNumber ?? null,
    }
  }

  private async findOrCreateRealBankTransaction(event: NormalizedBankTransferEvent): Promise<BankTransactionRecord> {
    const bankTransaction = (this.prisma as any).bankTransaction
    const existing = await bankTransaction.findFirst({
      where: {
        isTest: false,
        provider: event.provider,
        OR: [
          { sourceEventKey: event.sourceEventKey },
          { dedupeKey: event.dedupeKey },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      return bankTransaction.update({
        where: { id: existing.id },
        data: {
          sourceCount: { increment: 1 },
          externalEventId: existing.externalEventId ?? event.externalEventId ?? null,
          externalTxnId: existing.externalTxnId ?? event.externalTxnId ?? null,
          txnAt: existing.txnAt ?? event.txnAt ?? null,
          rawPayload: existing.rawPayload ?? (event.rawPayload as any),
        } as any,
      })
    }

    return bankTransaction.create({
      data: {
        provider: event.provider,
        sourceEventKey: event.sourceEventKey,
        dedupeKey: event.dedupeKey,
        externalEventId: event.externalEventId ?? null,
        externalTxnId: event.externalTxnId ?? null,
        bankBin: event.bankBin ?? null,
        accountNumber: event.accountNumber,
        amount: event.amount,
        currency: event.currency,
        direction: event.direction,
        description: event.description,
        normalizedDescription: event.normalizedDescription,
        status: 'RECEIVED',
        classification: 'UNCLASSIFIED',
        isTest: false,
        sourceCount: 1,
        txnAt: event.txnAt ?? null,
        rawPayload: event.rawPayload as any,
      } as any,
    })
  }

  private async createTestBankTransaction(
    event: NormalizedBankTransferEvent,
    matched: MatchCandidate | null,
  ): Promise<BankTransactionRecord> {
    const unmatchedNote = this.buildUnmatchedNote(event)
    return (this.prisma as any).bankTransaction.create({
      data: {
        provider: 'TESTBANK',
        sourceEventKey: `test:${event.sourceEventKey}`,
        dedupeKey: `test:${event.dedupeKey}`,
        externalEventId: event.externalEventId ?? null,
        externalTxnId: event.externalTxnId ?? null,
        bankBin: event.bankBin ?? null,
        accountNumber: event.accountNumber,
        amount: event.amount,
        currency: event.currency,
        direction: event.direction,
        description: event.description,
        normalizedDescription: event.normalizedDescription,
        status: matched ? (matched.status === 'PAID' ? 'IGNORED' : 'SUGGESTED') : 'REVIEW',
        classification: matched ? 'SALES_PAYMENT' : 'UNCLASSIFIED',
        isTest: true,
        sourceCount: 1,
        matchedPaymentIntentId: matched?.id ?? null,
        matchedOrderId: matched?.orderId ?? null,
        matchedPaymentMethodId: matched?.paymentMethodId ?? null,
        matchReason: matched ? 'orderCode+amount' : null,
        note: matched
          ? matched.status === 'PAID'
            ? 'Test webhook matched an already-paid payment intent'
            : 'Test webhook matched a pending payment intent'
          : unmatchedNote,
        txnAt: event.txnAt ?? null,
        processedAt: new Date(),
        rawPayload: event.rawPayload as any,
      } as any,
    })
  }

  private async updateBankTransactionState(
    bankTransactionId: string,
    data: Partial<BankTransactionRecord> & {
      status?: string
      classification?: string
    },
  ) {
    return (this.prisma as any).bankTransaction.update({
      where: { id: bankTransactionId },
      data: data as any,
    })
  }

  private mapBankTransactionResult(record: any) {
    return {
      id: record.id,
      provider: record.provider,
      amount: Number(record.amount) || 0,
      currency: record.currency,
      direction: record.direction,
      accountNumber: record.accountNumber,
      bankBin: record.bankBin ?? null,
      description: record.description,
      normalizedDescription: record.normalizedDescription,
      status: record.status,
      classification: record.classification,
      isTest: Boolean(record.isTest),
      sourceCount: Number(record.sourceCount) || 0,
      note: record.note ?? null,
      txnAt: record.txnAt ? new Date(record.txnAt).toISOString() : null,
      processedAt: record.processedAt ? new Date(record.processedAt).toISOString() : null,
      createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : null,
      matchedPaymentIntent: record.paymentIntent
        ? {
            id: record.paymentIntent.id,
            code: record.paymentIntent.code,
            status: record.paymentIntent.status,
            orderId: record.paymentIntent.orderId ?? null,
            orderNumber: record.paymentIntent.order?.orderNumber ?? null,
            amount: Number(record.paymentIntent.amount) || 0,
            transferContent: record.paymentIntent.transferContent,
          }
        : null,
    }
  }

  private normalizeBankTransferEvent(provider: string, payload: Record<string, unknown>): NormalizedBankTransferEvent {
    const sourcePayload = this.flattenPayload(payload)
    const normalizedProvider = String(provider || 'default').trim().toLowerCase()
    const description = this.pickFirstString(sourcePayload, [
      'description',
      'content',
      'message',
      'transferContent',
      'addDescription',
      'remark',
      'details',
    ])
    const accountNumber = this.normalizeAccountNumber(
      this.pickFirstString(sourcePayload, ['accountNumber', 'accountNo', 'toAccountNumber', 'receiverAccount']),
    )
    const bankBin = this.normalizeDigits(this.pickFirstString(sourcePayload, ['bankBin', 'bin', 'bankCode'])) || null
    const amount = this.pickFirstNumber(sourcePayload, ['amount', 'creditAmount', 'value', 'transactionAmount'])
    const direction = this.normalizeDirection(this.pickFirstString(sourcePayload, ['direction', 'txnType', 'type']))
    const txnAt = this.parseDate(this.pickFirstValue(sourcePayload, ['txnAt', 'transactionTime', 'createdAt', 'timestamp']))
    const externalEventId = this.pickFirstString(sourcePayload, ['eventId', 'id', 'webhookId']) || null
    const externalTxnId = this.pickFirstString(sourcePayload, ['externalTxnId', 'txnId', 'transactionId', 'reference']) || null

    if (!description) {
      throw new BadRequestException('Webhook is missing transfer description')
    }

    if (!accountNumber) {
      throw new BadRequestException('Webhook is missing receiver account number')
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Webhook amount is invalid')
    }

    const normalizedDescription = this.normalizeLookupToken(description)
    if (!normalizedDescription) {
      throw new BadRequestException('Webhook description cannot be normalized')
    }

    const sourceSeed = externalEventId ?? externalTxnId ?? JSON.stringify(payload)
    const sourceEventKey = `${normalizedProvider}:${this.hashValue(sourceSeed)}`
    const dedupeKey = this.hashValue(
      [
        accountNumber,
        bankBin ?? '',
        amount.toFixed(0),
        normalizedDescription,
        txnAt ? Math.floor(txnAt.getTime() / 60000).toString() : 'na',
        direction,
      ].join('|'),
    )

    return {
      provider: normalizedProvider,
      sourceEventKey,
      dedupeKey,
      externalEventId,
      externalTxnId,
      bankBin,
      accountNumber,
      amount,
      currency: (this.pickFirstString(sourcePayload, ['currency']) || 'VND').toUpperCase(),
      direction,
      description,
      normalizedDescription,
      txnAt,
      rawPayload: payload,
    }
  }

  private flattenPayload(payload: Record<string, unknown>) {
    const merged: Record<string, unknown> = { ...payload }

    for (const key of ['data', 'result', 'transaction']) {
      const nested = payload[key]
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        Object.assign(merged, nested as Record<string, unknown>)
      }
    }

    return merged
  }

  private async assertWebhookSecret(provider: string, headers: Record<string, string | string[] | undefined>) {
    const normalizedProvider = String(provider || 'default').trim().toLowerCase()
    const paymentWebhookSecret = (this.prisma as any).paymentWebhookSecret
    const totalDbSecretsCount = paymentWebhookSecret
      ? await paymentWebhookSecret.count()
      : 0
    const providerDbSecretsCount = paymentWebhookSecret
      ? await paymentWebhookSecret.count({
          where: {
            provider: normalizedProvider,
          },
        })
      : 0

    const rawSecret = this.firstHeaderValue(headers, 'x-webhook-secret')
      || this.extractBearerToken(this.firstHeaderValue(headers, 'authorization'))

    if (totalDbSecretsCount > 0) {
      if (providerDbSecretsCount === 0) {
        throw new UnauthorizedException('Webhook secret for this provider is not configured')
      }

      if (!rawSecret) {
        throw new UnauthorizedException('Missing webhook secret')
      }

      const secretHash = this.hashValue(rawSecret)
      const dbSecret = await paymentWebhookSecret.findFirst({
        where: {
          provider: normalizedProvider,
          secretHash,
        },
        select: {
          id: true,
        },
      })

      if (!dbSecret) {
        throw new UnauthorizedException('Webhook secret is invalid')
      }

      await paymentWebhookSecret.update({
        where: { id: dbSecret.id },
        data: { lastUsedAt: new Date() },
      })
      return
    }

    const configuredEnvSecrets = this.getWebhookSecretsFromEnv(normalizedProvider)
    if (configuredEnvSecrets.length === 0) {
      throw new UnauthorizedException('Webhook secret is not configured')
    }

    if (!rawSecret) {
      throw new UnauthorizedException('Missing webhook secret')
    }

    for (const configuredSecret of configuredEnvSecrets) {
      const left = Buffer.from(rawSecret)
      const right = Buffer.from(configuredSecret)
      if (left.length === right.length && timingSafeEqual(left, right)) {
        return
      }
    }

    throw new UnauthorizedException('Webhook secret is invalid')
  }

  private getWebhookSecretsFromEnv(provider: string) {
    const providerSecrets = String(process.env['BANK_TRANSFER_WEBHOOK_SECRETS'] ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

    const providerKey = provider.trim().toLowerCase()
    const matchedSecrets: string[] = []
    for (const entry of providerSecrets) {
      const [rawProvider, ...rawSecretParts] = entry.split(':')
      if (!rawProvider || rawSecretParts.length === 0) continue
      if (rawProvider.trim().toLowerCase() === providerKey) {
        matchedSecrets.push(rawSecretParts.join(':').trim())
      }
    }

    const fallbackSecret = String(process.env['BANK_TRANSFER_WEBHOOK_SECRET'] ?? '').trim()
    if (fallbackSecret) {
      matchedSecrets.push(fallbackSecret)
    }

    return matchedSecrets.filter(Boolean)
  }

  private firstHeaderValue(headers: Record<string, string | string[] | undefined>, name: string) {
    const value = headers[name] ?? headers[name.toLowerCase()]
    if (Array.isArray(value)) {
      return value[0] ?? ''
    }
    return value ?? ''
  }

  private extractBearerToken(value: string) {
    const normalized = String(value ?? '').trim()
    if (!normalized.toLowerCase().startsWith('bearer ')) {
      return ''
    }
    return normalized.slice(7).trim()
  }

  private pickFirstValue(payload: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = payload[key]
      if (value !== undefined && value !== null && value !== '') {
        return value
      }
    }
    return null
  }

  private pickFirstString(payload: Record<string, unknown>, keys: string[]) {
    const value = this.pickFirstValue(payload, keys)
    if (value === null) return ''
    return String(value).trim()
  }

  private pickFirstNumber(payload: Record<string, unknown>, keys: string[]) {
    const value = this.pickFirstValue(payload, keys)
    const amount = Number(value)
    return Number.isFinite(amount) ? amount : Number.NaN
  }

  private normalizeDirection(value: string) {
    const normalized = String(value ?? '').trim().toUpperCase()
    if (!normalized) return 'IN' as const
    if (['OUT', 'DEBIT', 'WITHDRAW', 'EXPENSE'].includes(normalized)) {
      return 'OUT' as const
    }
    return 'IN' as const
  }

  private normalizeAccountNumber(value: string) {
    return this.normalizeDigits(value)
  }

  private normalizeDigits(value: string) {
    return String(value ?? '').replace(/\D/g, '')
  }

  private normalizeLookupToken(value: string) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
  }

  private shouldAttemptSalesPaymentMatch(event: NormalizedBankTransferEvent) {
    return event.direction === 'IN'
  }

  private buildUnmatchedNote(event: NormalizedBankTransferEvent) {
    if (event.direction === 'OUT') {
      return 'Recorded outgoing bank transaction without sales-order reconciliation'
    }

    return 'No payment intent matched account + amount + order code'
  }

  private parseDate(value: unknown) {
    if (value === null || value === undefined || value === '') return null

    if (typeof value === 'number') {
      const epoch = value > 10_000_000_000 ? value : value * 1000
      const parsed = new Date(epoch)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const parsed = new Date(String(value))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  private hashValue(value: string) {
    return createHash('sha256').update(String(value)).digest('hex')
  }
}
