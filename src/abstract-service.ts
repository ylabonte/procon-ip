/**
 * Common HTTP base for ProCon.IP service classes.
 * @packageDocumentation
 */

import { BadCredentialsError, BadStatusCodeError, RequestTimeoutError } from './errors';
import type { ILogger } from './logger';

export interface IServiceConfig {
  /** Controller base URL (e.g. `"http://192.168.2.3"`). Trailing slash optional. */
  controllerUrl: string;
  /** Enable HTTP basic auth (uses {@link username} and {@link password}). */
  basicAuth: boolean;
  /** Optional basic-auth username. */
  username?: string;
  /** Optional basic-auth password. */
  password?: string;
  /** Per-request timeout in milliseconds. */
  timeout: number;
  /** Optional extra headers merged into every request. */
  requestHeaders?: Record<string, string>;
  /** Forward-compatible escape hatch for ad-hoc config keys. */
  [key: string]: unknown;
}

/** HTTP methods accepted by `AbstractService._method`. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export abstract class AbstractService {
  protected _config: IServiceConfig;
  protected _requestHeaders: Record<string, string>;
  protected log: ILogger;

  /** Endpoint path relative to {@link IServiceConfig.controllerUrl}. */
  abstract _endpoint: string;
  /** HTTP method for this endpoint. */
  abstract _method: HttpMethod;

  public constructor(config: IServiceConfig, logger: ILogger) {
    this._config = config;
    this._requestHeaders = { ...(config.requestHeaders ?? {}) };
    this.log = logger;
  }

  public get baseUrl(): string {
    return this._config.controllerUrl;
  }

  public get url(): string {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const path = this._endpoint.startsWith('/') ? this._endpoint.slice(1) : this._endpoint;
    return new URL(path, base).href;
  }

  /**
   * Perform the HTTP request configured for this service.
   *
   * @param init Optional `fetch` init overrides; merged on top of method/headers/auth.
   *   If `init.signal` is provided, the request aborts when either the caller's
   *   signal fires or the configured timeout elapses; an external abort re-throws
   *   the original `AbortError` so callers can distinguish it from a timeout.
   * @returns The raw `Response` for the caller to parse.
   * @throws {@link BadCredentialsError} on HTTP 401 or 403.
   * @throws {@link BadStatusCodeError} on any other 4xx/5xx response.
   * @throws {@link RequestTimeoutError} if the request exceeds the configured timeout.
   */
  protected async request(init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(this._requestHeaders);
    if (init.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (this._config.basicAuth) {
      const creds = `${this._config.username ?? ''}:${this._config.password ?? ''}`;
      headers.set('Authorization', `Basic ${Buffer.from(creds).toString('base64')}`);
    }

    const controller = new AbortController();
    const timeoutMs = this._config.timeout;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // If the caller passed their own AbortSignal, honour both: the request
    // aborts when either signal fires. Distinguishes a caller-driven abort
    // from our timeout below.
    const externalSignal = init.signal ?? null;
    const signal = externalSignal ? AbortSignal.any([externalSignal, controller.signal]) : controller.signal;

    try {
      const res = await fetch(this.url, {
        ...init,
        method: this._method,
        headers,
        signal,
      });
      if (res.status === 401 || res.status === 403) {
        throw new BadCredentialsError(`Authentication failed (${res.status} ${res.statusText})`);
      }
      if (!res.ok) {
        throw new BadStatusCodeError(
          `Request failed: HTTP ${res.status} ${res.statusText}`,
          res.status,
          res.statusText,
        );
      }
      return res;
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // Caller-driven abort: re-throw the original AbortError so consumers
        // can distinguish it from our timeout.
        if (externalSignal?.aborted) throw e;
        throw new RequestTimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}
