import { AppError } from '@verity/shared/errors';
import type { NextRequest } from 'next/server';
import type { z } from 'zod';

export async function parseJsonBody<T>(request: NextRequest, schema: z.ZodType<T>) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Request body must be valid JSON.', 422);
  }

  return schema.parse(body);
}

export function parseSearchParams<T>(request: NextRequest, schema: z.ZodType<T>) {
  return schema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
}

export function parseParams<T>(params: unknown, schema: z.ZodType<T>) {
  return schema.parse(params);
}
