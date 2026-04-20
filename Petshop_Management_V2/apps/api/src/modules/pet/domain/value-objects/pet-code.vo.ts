/**
 * Value Object: PetCode
 * Immutable, always valid, compared by value.
 */
export class PetCode {
    private readonly value: string

    private constructor(value: string) {
        this.value = value
    }

    static of(raw: string): PetCode {
        const trimmed = raw.trim().toUpperCase()
        if (!trimmed.startsWith('PET')) {
            throw new Error(`PetCode không hợp lệ: "${raw}". Phải bắt đầu bằng "PET"`)
        }
        return new PetCode(trimmed)
    }

    toString(): string {
        return this.value
    }

    equals(other: PetCode): boolean {
        return this.value === other.value
    }
}
