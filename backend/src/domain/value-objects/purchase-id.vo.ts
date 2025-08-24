import { v4 as uuidv4 } from 'uuid';

export class PurchaseId {
  private constructor(private readonly value: string) {}

  static generate(): PurchaseId {
    return new PurchaseId(uuidv4());
  }

  static fromString(value: string): PurchaseId {
    if (!value || typeof value !== 'string') {
      throw new Error('Invalid purchase ID format');
    }
    return new PurchaseId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: PurchaseId): boolean {
    return this.value === other.value;
  }
}
