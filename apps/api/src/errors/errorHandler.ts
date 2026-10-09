import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './AppError.js';

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = (request.id as string) || 'req-unknown';

  if (error instanceof AppError) {
    const response: ErrorEnvelope = {
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    };
    reply.status(error.statusCode).send(response);
    return;
  }

  // Handle Fastify built-in schema validation errors
  if ('validation' in error && Array.isArray((error as FastifyError).validation)) {
    const response: ErrorEnvelope = {
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message || 'Request validation failed',
        requestId,
      },
    };
    reply.status(400).send(response);
    return;
  }

  // Handle other Fastify errors (e.g. rate limit, 404 routes, body too large)
  if ('statusCode' in error && typeof (error as FastifyError).statusCode === 'number') {
    const fastifyError = error as FastifyError;
    const statusCode = fastifyError.statusCode ?? 500;
    const code = fastifyError.code ?? (statusCode === 404 ? 'NOT_FOUND' : 'CLIENT_ERROR');
    const response: ErrorEnvelope = {
      error: {
        code,
        message: fastifyError.message,
        requestId,
      },
    };
    reply.status(statusCode).send(response);
    return;
  }

  // Safe fallback for unexpected 500 errors
  request.log.error({ err: error, requestId }, 'Unhandled application error');

  const response: ErrorEnvelope = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal error occurred. Please try again later.',
      requestId,
    },
  };

  reply.status(500).send(response);
}
