import { randomUUID } from 'node:crypto';
import { MAX_REQUEST_BODY_BYTES } from '@verity/shared/constants';
import { AppError, AuthenticationError } from '@verity/shared/errors';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getAuthContext, type AuthContext } from '@/lib/auth/session';
import { logger, runWithContext, reportError, metrics, withSpan, monitorRegistry, thresholds } from '@verity/shared/observability';

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
    const requestId = request.headers.get('x-request-id') ?? randomUUID();
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

      return await runWithContext(
        { requestId, userId: auth.userId, workspaceId: auth.workspaceId },
        async () => {
          return await withSpan('api_request', { method: request.method, route: request.nextUrl.pathname }, async () => {
            const response = await handler(request, { requestId, auth }, routeContext);
            const durationMs = Date.now() - startedAt;
            
            metrics.increment('api_request_count', 1, { method: request.method, route: request.nextUrl.pathname, status: response.status });
            metrics.histogram('api_request_duration', durationMs, { method: request.method, route: request.nextUrl.pathname });
            
            if (durationMs > thresholds.API_LATENCY_CRITICAL_MS) {
              monitorRegistry.emitAlert('api_critical_latency', 'API latency is critically high', 'critical', 'api', durationMs, thresholds.API_LATENCY_CRITICAL_MS, { route: request.nextUrl.pathname });
            } else if (durationMs > thresholds.API_LATENCY_WARNING_MS) {
              monitorRegistry.emitAlert('api_high_latency', 'API latency is high', 'warning', 'api', durationMs, thresholds.API_LATENCY_WARNING_MS, { route: request.nextUrl.pathname });
            }
            
            logger.info('api_request_completed', {
              method: request.method,
              path: request.nextUrl.pathname,
              status: response.status,
              durationMs,
            });
            response.headers.set('x-request-id', requestId);
            return response;
          });
        }
      );
    } catch (error) {
      const isAppError = error instanceof AppError;
      const appError =
        isAppError
          ? error
          : error instanceof ZodError
            ? new AppError('VALIDATION_ERROR', 'Request validation failed.', 422, { issues: error.issues })
            : new AppError('INTERNAL_ERROR', 'Unexpected server error.', 500);

      if (!isAppError) {
        reportError(error, {
          service: 'verity-web',
          tags: { route: request.nextUrl.pathname, method: request.method },
          severity: appError.statusCode >= 500 ? 'error' : 'warning',
        });
      }

      return runWithContext({ requestId }, () => {
        const durationMs = Date.now() - startedAt;
        
        metrics.increment('api_request_count', 1, { method: request.method, route: request.nextUrl.pathname, status: appError.statusCode });
        metrics.histogram('api_request_duration', durationMs, { method: request.method, route: request.nextUrl.pathname });

        logger.error('api_request_failed', {
          method: request.method,
          path: request.nextUrl.pathname,
          status: appError.statusCode,
          code: appError.code,
          durationMs,
          error: appError,
        });

        return errorResponse(appError, requestId);
      });
    }
  };
}
