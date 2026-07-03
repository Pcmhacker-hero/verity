import { randomUUID } from 'node:crypto';
import { MAX_REQUEST_BODY_BYTES } from '@verity/shared/constants';
import { AppError, AuthenticationError } from '@verity/shared/errors';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getAuthContext, type AuthContext } from '@/lib/auth/session';
import { logger } from './logger';

type HandlerContext = {
  requestId: string;
  auth: AuthContext;
};

type ApiHandler<RouteContext = unknown> = (
  request: NextRequest,
  context: HandlerContext,
  routeContext: RouteContext,
) => Promise<Response>;

function errorResponse(error: AppError, requestId: string) {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        action: error.action,
      },
    },
    { status: error.statusCode, headers: { 'x-request-id': requestId } },
  );
}

export function withApiAuth<RouteContext = unknown>(handler: ApiHandler<RouteContext>) {
  return async (request: NextRequest, routeContext: RouteContext) => {
    const requestId = randomUUID();
    const startedAt = Date.now();

    try {
      const contentLength = request.headers.get('content-length');

      if (contentLength && Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
        throw new AppError('VALIDATION_ERROR', 'Request body is too large.', 422, {
          maxBytes: MAX_REQUEST_BODY_BYTES,
        });
      }

      const auth = await getAuthContext();

      if (!auth) {
        throw new AuthenticationError();
      }

      const response = await handler(request, { requestId, auth }, routeContext);
      logger.info('api_request_completed', {
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      response.headers.set('x-request-id', requestId);
      return response;
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : error instanceof ZodError
            ? new AppError('VALIDATION_ERROR', 'Request validation failed.', 422, { issues: error.issues })
            : new AppError('INTERNAL_ERROR', 'Unexpected server error.', 500);

      logger.error('api_request_failed', {
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        status: appError.statusCode,
        code: appError.code,
        durationMs: Date.now() - startedAt,
      });

      return errorResponse(appError, requestId);
    }
  };
}
