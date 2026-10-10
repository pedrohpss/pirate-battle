import axios, { isAxiosError } from 'axios';
import { API_BASE_URL } from './contracts';
import type { ApiErrorBody } from './contracts';

/** Request timeout. Can be changed with the VITE_API_TIMEOUT_MS environment variable. */
const DEFAULT_TIMEOUT_MS = 5000;
const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);
export const API_TIMEOUT_MS = configuredTimeout > 0 ? configuredTimeout : DEFAULT_TIMEOUT_MS;

/** The single Axios instance used for every API call. */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

/** What kind of failure happened, independent of Axios details. */
export type ApiErrorKind = 'timeout' | 'network' | 'client' | 'server' | 'cancelled' | 'unknown';

export function getErrorKind(error: unknown): ApiErrorKind {
  if (!isAxiosError(error)) return 'unknown';
  if (error.code === 'ERR_CANCELED') return 'cancelled';
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return 'timeout';
  const status = error.response?.status;
  if (status === undefined) return 'network';
  return status >= 500 ? 'server' : 'client';
}

/**
 * Worth trying again? Timeouts, connection failures and 5xx usually are.
 * A 4xx means the request itself is wrong, so repeating it would not help.
 */
export function isRetryableError(error: unknown): boolean {
  const kind = getErrorKind(error);
  return kind === 'timeout' || kind === 'network' || kind === 'server';
}

/** A short message for the player. */
export function describeError(error: unknown): string {
  switch (getErrorKind(error)) {
    case 'timeout':
      return 'The server took too long to answer.';
    case 'network':
      return 'Could not reach the server.';
    case 'server':
      return 'The server had a problem.';
    case 'client': {
      const body: unknown = isAxiosError(error) ? error.response?.data : undefined;
      const message = (body as Partial<ApiErrorBody> | undefined)?.message;
      return typeof message === 'string' ? message : 'The request was rejected.';
    }
    default:
      return 'Something went wrong.';
  }
}
