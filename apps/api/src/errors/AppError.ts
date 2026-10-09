export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class AuthenticationError extends AppError {
  readonly code = 'AUTH_REQUIRED';
  readonly statusCode = 401;
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
}

export class DatabaseError extends AppError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;
}

export class InternalError extends AppError {
  readonly code = 'INTERNAL_ERROR';
  readonly statusCode = 500;
}
