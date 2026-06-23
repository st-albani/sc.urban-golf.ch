/**
 * Shared Fastify error handler. Maps Ajv schema-validation errors into the
 * `{ error: 'Validation failed', details: string[] }` shape that the route
 * tests and the frontend already expect. Falls through to the previous
 * 500-vs-message behaviour for everything else.
 *
 * Attach via `fastify.setErrorHandler(handleError)` — applied both from
 * app.js for production and from each test buildApp().
 */
export function handleError(error, request, reply) {
  if (error.validation) {
    return reply.code(400).send({
      error: 'Validation failed',
      details: error.validation.map(v => v.message || v.keyword),
    });
  }
  request.log.error(error);
  const statusCode = error.statusCode || 500;
  reply.code(statusCode).send({
    error: statusCode >= 500 ? 'Internal server error' : error.message,
  });
}
