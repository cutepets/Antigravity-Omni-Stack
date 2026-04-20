/**
 * Domain Event: raised when pet information is updated.
 * Can be handled by event handlers for audit log, notifications, etc.
 */
export class PetInfoUpdatedEvent {
    readonly occurredAt: Date

    constructor(
        public readonly petId: string,
        public readonly changes: Array<{
            field: string
            label: string
            from: string | null
            to: string | null
        }>,
        public readonly updatedBy?: string | null,
    ) {
        this.occurredAt = new Date()
    }
}

/** Domain Event: raised when a weight log is added */
export class PetWeightLoggedEvent {
    readonly occurredAt: Date

    constructor(
        public readonly petId: string,
        public readonly weight: number,
        public readonly notes?: string | null,
    ) {
        this.occurredAt = new Date()
    }
}

/** Domain Event: raised when a vaccination record is added */
export class PetVaccinatedEvent {
    readonly occurredAt: Date

    constructor(
        public readonly petId: string,
        public readonly vaccineName: string,
        public readonly date: Date,
    ) {
        this.occurredAt = new Date()
    }
}
