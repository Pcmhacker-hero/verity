import { getRequestContext } from './context.js';
import { config } from '../config/index.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  correlationId?: string;
  userId?: string;
  workspaceId?: string;
  projectId?: string;
  [key: string]: unknown;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return { error: String(err) };
}

function write(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
  const context = getRequestContext();
  
  // Format error if passed in meta
  if (meta.error) {
    meta.error = serializeError(meta.error);
  }

  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  // Inject context fields if they exist
  if (context) {
    if (context.requestId) payload.requestId = context.requestId;
    if (context.correlationId) payload.correlationId = context.correlationId;
    if (context.userId) payload.userId = context.userId;
    if (context.workspaceId) payload.workspaceId = context.workspaceId;
    if (context.projectId) payload.projectId = context.projectId;
  }

  const output = JSON.stringify(payload);

  switch (level) {
    case 'debug':
      if (config.env !== 'production') console.debug(output);
      break;
    case 'info':
      console.info(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
    case 'fatal':
      console.error(output);
      break;
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
  fatal: (message: string, meta?: Record<string, unknown>) => write('fatal', message, meta),
};
