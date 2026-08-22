/**
 * Common HTTP base for ProCon.IP service classes.
 * @packageDocumentation
 */

import { request as undiciRequest } from 'undici';
import { BadCredentialsError, BadStatusCodeError, ProconIpError, RequestTimeoutError } from './errors';
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
    // Validate the controllerUrl once at construction time so a misconfigured
    // base URL fails with a clear error here instead of throwing a generic
    // `TypeError: Invalid URL` deep inside the first request().
    try {
      new URL(config.controllerUrl);
    } catch {
      throw new ProconIpError(
        `Invalid controllerUrl: ${JSON.stringify(config.controllerUrl)} — must be a parseable URL (e.g. "http://192.168.2.3")`,
      );
    }
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
   * The HTTP method, `Authorization` header (when `basicAuth` is enabled),
   * and `signal` are **always controlled by this method** and cannot be
   * overridden via `init`: an explicit `init.method` is ignored, and a
   * caller-supplied `init.signal` is composed (via `AbortSignal.any`) with
   * the internal timeout signal rather than replacing it. An external abort
   * re-throws the original `AbortError` so callers can distinguish it from
   * a timeout.
   *
   * Only `body`, `headers`, and `signal` from `init` are honoured — the
   * request is issued via `undici.request()` (not the global `fetch()`, which
   * would inject browser headers the controller mishandles). Caller `headers`
   * are merged on top of the service's `_requestHeaders`.
   *
   * @param init Optional `fetch` init plus a `params` shortcut. `params`,
   *   if provided, is serialised as `key=value&key=value` and appended to
   *   the URL without URL-encoding — values must already be URL-safe
   *   (numbers and ASCII letters are fine; spaces / special chars are not).
   *   This matches the wire format the controller's legacy endpoints expect
   *   (e.g. literal commas in `?MAN_DOSAGE=0,60`).
   * @returns The raw `Response` for the caller to parse.
   * @throws {@link BadCredentialsError} on HTTP 401 or 403.
   * @throws {@link BadStatusCodeError} on any other 4xx/5xx response.
   * @throws {@link RequestTimeoutError} if the request exceeds the configured timeout.
   */
  protected async request(init: RequestInit & { params?: Record<string, string | number> } = {}): Promise<Response> {
    const { params, ...restInit } = init;
    const headers = new Headers(this._requestHeaders);
    if (restInit.headers) new Headers(restInit.headers).forEach((v, k) => headers.set(k, v));
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
    const externalSignal = restInit.signal ?? null;
    const signal = externalSignal ? AbortSignal.any([externalSignal, controller.signal]) : controller.signal;

    // Build the request URL. `params` is appended raw (no URL encoding) to
    // match the controller's wire format on its legacy GET endpoints. Because
    // there's no encoding, keys and values must not contain characters that
    // would alter the query-string structure or fragment boundary.
    let url = this.url;
    if (params && Object.keys(params).length > 0) {
      const qs = Object.entries(params)
        .map(([k, v]) => {
          const val = String(v);
          if (/[&=?#\s]/.test(k) || /[&=?#\s]/.test(val)) {
            throw new ProconIpError(
              `Refusing to build query string with unsafe characters in param "${k}"=${JSON.stringify(val)} (& = ? # whitespace not allowed when raw-concat is in use)`,
            );
          }
          return `${k}=${val}`;
        })
        .join('&');
      url = `${url}?${qs}`;
    }

    try {
      // NOTE: we intentionally use undici.request(), NOT the global fetch().
      // The WHATWG fetch() implementation injects browser-only request headers
      // (`sec-fetch-mode`, `accept-language`, `connection: keep-alive`) that the
      // controller's legacy firmware mishandles: it answers a relay/DMX write
      // with "200 done" but silently ignores it (reads over fetch work fine).
      // Those headers are on the fetch "forbidden header" list and cannot be
      // stripped via the API, so we bypass fetch entirely. undici.request()
      // sends only the headers assembled above. See the regression test in
      // `test/abstract-service.wire.test.ts` that asserts they are absent.
      const res = await undiciRequest(url, {
        method: this._method,
        headers,
        body: (restInit.body ?? undefined) as string | undefined,
        signal,
      });
      const status = res.statusCode;
      if (status === 401 || status === 403) {
        await res.body.dump();
        throw new BadCredentialsError(`Authentication failed (HTTP ${status})`);
      }
      if (status < 200 || status >= 300) {
        await res.body.dump();
        throw new BadStatusCodeError(`Request failed: HTTP ${status}`, status, String(status));
      }
      // Read the body eagerly (consuming the undici stream) and re-wrap it in a
      // standard `Response` so the return contract is unchanged for callers.
      const text = await res.body.text();
      return new Response(text, { status });
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : '';
      const code = (e as { code?: string } | null)?.code;
      if (name === 'AbortError' || code === 'UND_ERR_ABORTED') {
        // Caller-driven abort: re-throw the original error so consumers can
        // distinguish it from our timeout.
        if (externalSignal?.aborted) throw e;
        throw new RequestTimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}
