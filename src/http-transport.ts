/**
 * Low-level HTTP transport for the ProCon.IP service classes.
 *
 * Uses Node's built-in `http`/`https` — **not** `undici` and **not** the global
 * `fetch()`. The controller runs a legacy HTTP/1.0 firmware that is
 * **case-sensitive on request header names**: it only honours `Authorization`
 * and `Content-Length` spelled with that exact capitalisation.
 *
 *   - `fetch()` lowercases header names *and* injects browser-only headers
 *     (`sec-fetch-*`, `accept-language`, `user-agent`, …) that the firmware
 *     mishandles.
 *   - `undici.request()` lowercases the header names it generates
 *     (`content-length`, `host`, `connection`) and overrides an explicit
 *     `Content-Length`. A lowercase `content-length` makes the firmware ignore
 *     the request body entirely — the write is dropped but still answered
 *     `200 "done"`, so relay/DMX writes silently no-op.
 *
 * Node's `http.request()` sends only the headers we set, preserving their case,
 * plus a capitalised `Host`. We set `Content-Length` (capitalised) explicitly
 * for requests that carry a body, and `Connection: close` (the controller
 * closes the socket anyway) — the exact minimal, case-correct request the
 * firmware accepts, verified on a real ProCon.IP V.1.7.6.
 *
 * @packageDocumentation
 */

import http from 'node:http';
import https from 'node:https';

/** Options for {@link httpRequest}. */
export interface HttpRequestOptions {
  /** HTTP method (e.g. `"GET"` / `"POST"`). */
  method: string;
  /** Request headers, sent with their exact name casing preserved. */
  headers: Record<string, string>;
  /** Optional string request body. */
  body?: string;
  /** Optional abort signal (fires on timeout or caller abort). */
  signal?: AbortSignal;
}

/** The subset of the HTTP response the services consume. */
export interface HttpResponse {
  /** Numeric HTTP status code. */
  statusCode: number;
  /** The fully-read response body as text. */
  text: string;
}

/**
 * Issue a single HTTP request via Node's built-in `http`/`https`, preserving the
 * exact casing of every request header name (required by the controller's
 * case-sensitive firmware). Reads the whole response body into a string.
 *
 * @param url the absolute request URL.
 * @param opts method, headers, optional body and abort signal.
 * @returns the status code and the response body text.
 */
export function httpRequest(url: string, opts: HttpRequestOptions): Promise<HttpResponse> {
  const target = new URL(url);
  const transport = target.protocol === 'https:' ? https : http;
  const headers: Record<string, string> = { ...opts.headers };

  // The firmware needs a capitalised `Content-Length` to read the body; set it
  // ourselves so Node emits exactly that header (never a lowercase or chunked
  // framing). Only for requests that actually carry a body.
  if (opts.body != null && headers['Content-Length'] === undefined) {
    headers['Content-Length'] = String(Buffer.byteLength(opts.body));
  }
  // Legacy HTTP/1.0 server: close the connection per request rather than reuse a
  // pooled keep-alive socket.
  if (headers['Connection'] === undefined) {
    headers['Connection'] = 'close';
  }

  return new Promise<HttpResponse>((resolve, reject) => {
    const req = transport.request(target, { method: opts.method, headers, signal: opts.signal }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject);
    if (opts.body != null) {
      req.write(opts.body);
    }
    req.end();
  });
}
