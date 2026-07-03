import { ErrorReportingProvider, ErrorReportMetadata } from './error-reporter.js';
import { logger } from './logger.js';

// Stubbing Sentry to avoid heavy third-party dependencies in the prototype phase
// In a full production build, this would import * as Sentry from '@sentry/node'

export class SentryProvider implements ErrorReportingProvider {
  constructor() {
    this.init();
  }

  private init() {
    // Sentry.init({
    //   dsn: process.env.SENTRY_DSN,
    //   tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.5 : 1.0,
    //   environment: process.env.NODE_ENV
    // });
    logger.info('SentryProvider initialized (mocked for prototype)');
  }

  captureException(error: Error, metadata: ErrorReportMetadata): void {
    // Sentry.withScope((scope) => {
    //   if (metadata.requestId) scope.setTag('requestId', metadata.requestId);
    //   if (metadata.userId) scope.setUser({ id: metadata.userId });
    //   if (metadata.severity) scope.setLevel(metadata.severity);
    //   Sentry.captureException(error);
    // });
    
    // Fallback log to demonstrate the interception
    logger.debug('SentryProvider captured exception', { error: error.message, requestId: metadata.requestId });
  }

  captureMessage(message: string, metadata: ErrorReportMetadata): void {
    // Sentry.withScope((scope) => {
    //   if (metadata.requestId) scope.setTag('requestId', metadata.requestId);
    //   if (metadata.userId) scope.setUser({ id: metadata.userId });
    //   if (metadata.severity) scope.setLevel(metadata.severity);
    //   Sentry.captureMessage(message);
    // });

    logger.debug('SentryProvider captured message', { message, requestId: metadata.requestId });
  }
}
