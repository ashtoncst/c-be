export class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class ForbiddenError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class ConflictError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}
