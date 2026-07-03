import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextData {
  requestId: string;
  correlationId?: string;
  userId?: string;
  workspaceId?: string;
  projectId?: string;
  [key: string]: unknown;
}

export const requestContext = new AsyncLocalStorage<RequestContextData>();

export function getRequestContext(): RequestContextData | undefined {
  return requestContext.getStore();
}

export function runWithContext<T>(data: RequestContextData, fn: () => T): T {
  return requestContext.run(data, fn);
}
