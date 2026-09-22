export class DomainError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class InsufficientStockError extends DomainError {
  constructor(productName: string, available: number, requested: number) {
    super(409, 'INSUFFICIENT_STOCK', `Insufficient stock for "${productName}"`, {
      productName,
      available,
      requested,
    });
  }
}

export class ConfirmationBlockedError extends DomainError {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(422, 'CONFIRMATION_BLOCKED', 'Confirmation is blocked', { reasons });
    this.reasons = reasons;
  }
}

export class BusinessNotSetupError extends DomainError {
  constructor() {
    super(404, 'BUSINESS_NOT_SETUP', 'Business profile not set up yet');
  }
}

export class VoiceAiError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(502, 'VOICE_AI_ERROR', message, details);
  }
}

export class StorageError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(500, 'STORAGE_ERROR', message, details);
  }
}

export class TenantMismatchError extends DomainError {
  constructor() {
    super(403, 'TENANT_MISMATCH', 'Record does not belong to your business');
  }
}