import { sendError, handleApiError, type ApiRes } from './http.js';

/** Domain-level errors mapped to HTTP responses (not generic 500). */
export class DomainError extends Error {
  readonly statusCode: 400 | 403 | 404 | 409;
  readonly errorLabel: string;

  constructor(statusCode: 400 | 403 | 404 | 409, errorLabel: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
    this.errorLabel = errorLabel;
  }
}

export function respondServiceError(
  res: ApiRes,
  e: unknown,
  context: string,
  fields?: Record<string, unknown>,
): void {
  if (e instanceof DomainError) {
    sendError(res, e.statusCode, e.errorLabel, e.message);
    return;
  }
  handleApiError(res, e, context, fields);
}
