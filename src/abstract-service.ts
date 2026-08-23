/**
 * Common HTTP base for ProCon.IP service classes.
 * @packageDocumentation
 */

import { httpRequest } from './http-transport';
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

/**
 * Options for {@link AbstractService.request}. Deliberately narrower than
 * `RequestInit`: only a string `body`, `headers` and `signal` are honoured
 * (for these legacy endpoints a body must never be percent-encoded), plus the
 * raw `params` query-string shortcut.
 */
export interface RequestOptions {
  body?: string;
  headers?: HeadersInit;
  signal?: AbortSignal | null;
  params?: Record<string, string | number>;
}

/**
 * Normalise a {@link HeadersInit} into `[name, value]` pairs, preserving the
 * caller's original name casing for the plain-object and tuple-array forms. A
 * WHATWG `Headers` instance has already lowercased its names (unavoidable), but
 * the service classes never pass one, so case-sensitive headers such as
 * `Authorization` are unaffected in practice.
 *
 * @param init the headers to normalise.
 * @returns the header entries as `[name, value]` tuples.
 */
function toHeaderEntries(init: HeadersInit): [string, string][] {
  if (init instanceof Headers) return [...init.entries()];
  if (Array.isArray(init)) return init.map((pair) => [pair[0], pair[1]] as [string, string]);
  return Object.entries(init);
}

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
   * request is issued via Node's built-in http/https (`httpRequest`), not the
   * global `fetch()` or `undici`, both of which mangle header-name casing the
   * controller's firmware depends on. Caller `headers` are merged on top of the
   * service's `_requestHeaders`.
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
  protected async request(init: RequestOptions = {}): Promise<Response> {
    const { params, ...restInit } = init;
    // Assemble the outgoing headers as a plain object so their exact name casing
    // reaches the wire. The controller's legacy firmware is case-sensitive on
    // header names: it 401s a write carrying `authorization` (only `Authorization`
    // is honoured) and ignores the body of a write carrying `content-length`
    // (only `Content-Length` is honoured). `httpRequest` preserves the casing of
    // this plain-object map, so we build it by hand.
    const headers: Record<string, string> = { ...this._requestHeaders };
    if (restInit.headers) {
      for (const [name, value] of toHeaderEntries(restInit.headers)) {
        headers[name] = value;
      }
    }
    if (this._config.basicAuth) {
      const creds = `${this._config.username ?? ''}:${this._config.password ?? ''}`;
      headers['Authorization'] = `Basic ${Buffer.from(creds).toString('base64')}`;
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
      // Issue the request via Node's built-in http/https (see ./http-transport).
      // The controller's legacy firmware is case-sensitive on header names, which
      // both the global fetch() and undici break by lowercasing the header names
      // they generate (a lowercase `content-length` makes the firmware drop the
      // body and silently no-op the write while still answering 200 "done").
      const res = await httpRequest(url, {
        method: this._method,
        headers,
        body: restInit.body,
        signal,
      });
      const status = res.statusCode;
      if (status === 401 || status === 403) {
        throw new BadCredentialsError(`Authentication failed (HTTP ${status})`);
      }
      if (status < 200 || status >= 300) {
        throw new BadStatusCodeError(`Request failed: HTTP ${status}`, status, String(status));
      }
      // 204/205 are "null body status" codes: `new Response()` rejects a
      // non-null body for them, so return an explicit null body.
      if (status === 204 || status === 205) {
        return new Response(null, { status });
      }
      // Re-wrap the already-read body in a standard `Response` so the return
      // contract is unchanged for callers.
      return new Response(res.text, { status });
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : '';
      const code = (e as { code?: string } | null)?.code;
      if (name === 'AbortError' || code === 'ABORT_ERR') {
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
