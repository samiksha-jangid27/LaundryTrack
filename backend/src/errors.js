export class HttpError extends Error {
  constructor(status, message, code = 'request_error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}
export function errorHandler(error, req, res, next) {
  if (error.code === 'P2002')
    return res
      .status(409)
      .json({ error: 'A record with these details already exists.', code: 'conflict' });
  if (error.name === 'ZodError')
    return res
      .status(400)
      .json({ error: error.issues[0]?.message || 'Check the form', code: 'validation_error' });
  if (error.type === 'entity.too.large')
    return res.status(413).json({ error: 'Request is too large' });
  if (error instanceof SyntaxError && error.status === 400)
    return res.status(400).json({ error: 'Invalid JSON' });
  if (!error.status) console.error('Unexpected API error:', error);
  res.status(error.status || 500).json({
    error: error.status ? error.message : 'Something went wrong. Please try again.',
    code: error.code || 'internal_error',
  });
}
