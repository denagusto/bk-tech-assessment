export class UserId {
  private constructor(private readonly value: string) {}

  static create(value: string): UserId {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      throw new Error('User ID must be a non-empty string');
    }
    
    if (value.length > 100) {
      throw new Error('User ID must be less than 100 characters');
    }

    return new UserId(value.trim());
  }

  toString(): string {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }
}
