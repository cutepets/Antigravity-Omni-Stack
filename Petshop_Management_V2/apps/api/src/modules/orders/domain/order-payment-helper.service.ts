import { BadRequestException, Injectable } from '@nestjs/common';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  EWALLET: 'Ví điện tử',
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  CARD: 'Thẻ',
  POINTS: 'Điểm tích lũy',
};

@Injectable()
export class OrderPaymentHelperService {
  getPaymentLabel(method: string): string {
    if (method === 'TRANSFER') return 'Chuyển khoản';
    if (method === 'MIXED') return 'Nhiều hình thức';
    return METHOD_LABELS[method] ?? method;
  }

  calculatePaymentStatus(total: number, paidAmount: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
    if (paidAmount <= 0) return 'UNPAID';
    if (paidAmount >= total) return 'PAID';
    return 'PARTIAL';
  }

  calculateRemainingAmount(total: number, paidAmount: number): number {
    return Math.max(0, total - paidAmount);
  }

  sanitizeTransferContentPart(value: string | null | undefined, maxLength: number): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, maxLength);
  }

  buildTransferContent(params: {
    prefix?: string | null;
    branchCode?: string | null;
    orderNumber?: string | null;
    paymentAccountName?: string | null;
    fallbackId: string;
  }) {
    let prefix = this.sanitizeTransferContentPart(params.prefix, 5) || 'PET';
    let branchCode = this.sanitizeTransferContentPart(params.branchCode, 4) || 'CN';
    const orderToken =
      this.sanitizeTransferContentPart(params.orderNumber ?? params.fallbackId, 14) || 'MADON';
    const paymentAccountName = this.sanitizeTransferContentPart(params.paymentAccountName, 6) || 'TK';

    let base = `${prefix}${branchCode}${orderToken}`;
    if (base.length > 23 && prefix.length > 3) {
      const overflow = base.length - 23;
      prefix = prefix.slice(0, Math.max(3, prefix.length - overflow));
      base = `${prefix}${branchCode}${orderToken}`;
    }

    if (base.length > 23 && branchCode.length > 2) {
      const overflow = base.length - 23;
      branchCode = branchCode.slice(0, Math.max(2, branchCode.length - overflow));
      base = `${prefix}${branchCode}${orderToken}`;
    }

    const remaining = Math.max(0, 25 - base.length);
    const transferContent = `${base}${paymentAccountName.slice(0, remaining)}`.slice(0, 25);

    if (!transferContent) {
      throw new BadRequestException('Khong the tao noi dung chuyen khoan cho QR');
    }

    return transferContent;
  }
}
