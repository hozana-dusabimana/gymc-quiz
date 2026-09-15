import { ZodError } from 'zod';
import { ApiError } from '../utils/response.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details;

  if (err instanceof ApiError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err?.type === 'entity.parse.failed') {
    // body-parser: malformed JSON in the request body
    status = 400;
    code = 'BAD_REQUEST';
    message = 'Request body is not valid JSON';
  } else if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Uploaded file exceeds the allowed size';
  } else if (typeof err?.code === 'string' && err.code.startsWith('LIMIT_')) {
    // other multer upload errors (unexpected field, too many files, …)
    status = 400;
    code = 'BAD_REQUEST';
    message = 'File upload was rejected';
  } else if (err?.code === '23505') {
    status = 409;
    code = 'CONFLICT';
    message = 'That resource already exists';
  } else if (err?.code === '23503') {
    status = 409;
    code = 'CONFLICT';
    message = 'Referenced resource does not exist';
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  if (!env.isProd && status >= 500) body.error.stack = err.stack;

  res.status(status).json(body);
}
