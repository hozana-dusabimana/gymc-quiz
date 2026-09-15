/**
 * Structured API error. Thrown anywhere in the request lifecycle and rendered
 * by the error middleware into `{ success:false, error:{ code, message } }`.
 */
export class ApiError extends Error {
  /**
   * @param {number} status  HTTP status code
   * @param {string} code    stable machine-readable code (SCREAMING_SNAKE_CASE)
   * @param {string} message human-readable message (safe to show a user)
   * @param {object} [details] optional extra context (e.g. field errors)
   */
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (msg = 'Invalid request', details) => new ApiError(400, 'BAD_REQUEST', msg, details),
  validation: (msg = 'Validation failed', details) => new ApiError(422, 'VALIDATION_ERROR', msg, details),
  unauthorized: (msg = 'Authentication required') => new ApiError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'You do not have access to this resource') => new ApiError(403, 'FORBIDDEN', msg),
  notFound: (msg = 'Resource not found') => new ApiError(404, 'NOT_FOUND', msg),
  conflict: (msg = 'Resource conflict', details) => new ApiError(409, 'CONFLICT', msg, details),
  tooMany: (msg = 'Too many requests') => new ApiError(429, 'RATE_LIMITED', msg),
  upstream: (msg = 'Upstream service error') => new ApiError(502, 'UPSTREAM_ERROR', msg),
  unavailable: (msg = 'Service unavailable') => new ApiError(503, 'SERVICE_UNAVAILABLE', msg),
  internal: (msg = 'Something went wrong') => new ApiError(500, 'INTERNAL_ERROR', msg),
};

/** Send a success envelope. */
export function ok(res, data, status = 200, extra = {}) {
  return res.status(status).json({ success: true, data, ...extra });
}
