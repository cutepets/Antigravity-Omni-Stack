import type { PaymentStatus } from '@petshop/database'
import type { JwtPayload } from '@petshop/shared'

export class UpdateStayPaymentCommand {
    constructor(
        public readonly id: string,
        public readonly paymentStatus: PaymentStatus,
        public readonly actor: JwtPayload | undefined,
    ) { }
}
