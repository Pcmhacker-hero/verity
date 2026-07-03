/**
 * API types — Doc 14 (API Specification).
 *
 * Standard API response envelope and pagination types.
 */

export interface ApiResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    action?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: CursorPaginationMeta;
}

export interface CursorPaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorPaginationParams {
  cursor?: string | null;
  limit?: number;
}

export type ApiErrorAction =
  | 'redirect_to_login'
  | 'retry'
  | 'reconnect_github'
  | 'contact_support';
