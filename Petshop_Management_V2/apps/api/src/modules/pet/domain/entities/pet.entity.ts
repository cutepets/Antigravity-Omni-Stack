import { randomUUID } from 'crypto'

export interface PetProps {
    id: string
    petCode: string
    name: string
    species: string
    breed?: string | null
    gender?: string | null
    dateOfBirth?: Date | null
    weight?: number | null
    color?: string | null
    allergies?: string | null
    temperament?: string | null
    notes?: string | null
    avatar?: string | null
    microchipId?: string | null
    branchId: string | null
    customerId: string
    customer?: {
        id: string
        fullName: string
        phone?: string | null
    } | null
    createdAt: Date
    updatedAt: Date
}

export class PetEntity {
    readonly id: string
    private props: PetProps

    private constructor(props: PetProps) {
        this.id = props.id
        this.props = props
    }

    /**
     * Factory: create a brand-new pet (generates id + timestamps).
     */
    static create(props: Omit<PetProps, 'id' | 'createdAt' | 'updatedAt'>): PetEntity {
        return new PetEntity({
            ...props,
            id: randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
        })
    }

    /**
     * Factory: reconstitute an existing pet from persistence.
     */
    static reconstitute(props: PetProps): PetEntity {
        return new PetEntity(props)
    }

    // ─── Read-only accessors ────────────────────────────────────────────────────

    get name() { return this.props.name }
    get species() { return this.props.species }
    get breed() { return this.props.breed }
    get gender() { return this.props.gender }
    get dateOfBirth() { return this.props.dateOfBirth }
    get weight() { return this.props.weight }
    get avatar() { return this.props.avatar }
    get branchId() { return this.props.branchId }
    get customerId() { return this.props.customerId }
    get petCode() { return this.props.petCode }
    get microchipId() { return this.props.microchipId }
    get createdAt() { return this.props.createdAt }
    get updatedAt() { return this.props.updatedAt }

    /** Return a shallow snapshot (safe to serialize). */
    toSnapshot(): Readonly<PetProps> {
        return { ...this.props }
    }

    // ─── Domain mutations ────────────────────────────────────────────────────────

    updateInfo(data: Partial<Pick<PetProps,
        'name' | 'species' | 'breed' | 'gender' | 'dateOfBirth' | 'color' |
        'allergies' | 'temperament' | 'notes' | 'weight' | 'microchipId'
    >>) {
        if (data.name !== undefined && !data.name.trim()) {
            throw new Error('Tên thú cưng không được rỗng')
        }
        this.props = { ...this.props, ...data, updatedAt: new Date() }
    }

    updateAvatar(url: string) {
        if (!url.trim()) throw new Error('Avatar URL không hợp lệ')
        this.props = { ...this.props, avatar: url, updatedAt: new Date() }
    }

    moveToCustomer(customerId: string, branchId: string) {
        this.props = { ...this.props, customerId, branchId, updatedAt: new Date() }
    }
}
