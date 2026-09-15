/**
 * Validate `req[source]` against a Zod schema, replacing it with the parsed
 * (and coerced) value. Throws ZodError -> handled by the error middleware.
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  try {
    req[source] = schema.parse(req[source]);
    next();
  } catch (err) {
    next(err);
  }
};
