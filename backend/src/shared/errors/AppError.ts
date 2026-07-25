/**
 * AppError – Custom error class for operational errors.
 *
 * WHY a custom error class:
 * - Distinguishes between "operational" errors (expected: 404, 401, 422)
 *   and "programmer" errors (unexpected: TypeError, null deref).
 * - The global error handler uses `isOperational` to decide whether to
 *   expose details to the client or return a generic 500.
 * - Carrying `statusCode` on the error keeps controllers clean —
 *   they just `throw new AppError(...)` and the handler formats the response.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Convenience factory methods
export const NotFoundError = (resource: string) =>
  new AppError(`${resource} not found`, 404, 'NOT_FOUND');

export const UnauthorizedError = (message = 'Unauthorized') =>
  new AppError(message, 401, 'UNAUTHORIZED');

export const ForbiddenError = (message = 'Forbidden') =>
  new AppError(message, 403, 'FORBIDDEN');

export const ValidationError = (message: string) =>
  new AppError(message, 422, 'VALIDATION_ERROR');

export const ConflictError = (message: string) =>
  new AppError(message, 409, 'CONFLICT');
