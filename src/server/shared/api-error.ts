/** Felles feilsvar etter kontrakten i api.md (`ApiError`). Brukes av alle rute-features. */
import type { Context } from 'hono';
import type { ApiError, ApiErrorCode } from '../../shared/api-types';

export type ApiErrorStatus = 400 | 403 | 404 | 405 | 500;

export function apiError(c: Context, status: ApiErrorStatus, code: ApiErrorCode, message: string): Response {
  return c.json<ApiError>({ error: { code, message } }, status);
}

/**
 * Leser en påkrevd sti fra query (`?path=`). `null` ved tom verdi eller NUL-byte (→ 400).
 * Selve oppslaget skjer alltid i indeksen, så traversal er umulig uansett (ADR-005).
 */
export function readPathParam(c: Context): string | null {
  const value = c.req.query('path');
  if (value === undefined || value.trim() === '' || value.includes('\0')) return null;
  return value;
}
