import { AppError } from '@verity/shared/errors';
import { NextResponse } from 'next/server';
import type { z } from 'zod';

export function jsonResponse<T>(data: T, schema: z.ZodType<T>, init?: ResponseInit) {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new AppError('INTERNAL_ERROR', 'API response validation failed', 500, {
      issues: result.error.issues,
    });
  }

  return NextResponse.json(result.data, init);
}

export function noContentResponse() {
  return new NextResponse(null, { status: 204 });
}
