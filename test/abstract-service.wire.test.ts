// REAL-WIRE regression test — intentionally does NOT mock the transport. It
// drives the real `node:http` path (see src/http-transport.ts) against a local
// server and asserts the exact bytes on the wire.
//
// Guards the concrete bugs that silently broke relay/DMX writes on the
// ProCon.IP's case-sensitive legacy firmware:
//
//   1. Header-name casing. The firmware only honours `Authorization` and
//      `Content-Length` capitalised. WHATWG `fetch()` and `undici` both
//      lowercase the header names they generate (and `fetch()` additionally
//      injects browser-only headers), so writes were dropped with a bogus
//      "200 done". `node:http` preserves our casing. This test asserts
//      `Authorization` and `Content-Length` reach the wire capitalised (via
//      `req.rawHeaders`, since node lowercases `req.headers`) and that no
//      browser-only headers appear.
//
//   2. Comma encoding. The controller needs a LITERAL comma in bodies like
//      `ENA=7,2&MANUAL=1`; a percent-encoded `%2C` makes the firmware reset
//      the connection. This test asserts the received body is byte-for-byte
//      `ENA=7,2&MANUAL=1`.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { AbstractService, type IServiceConfig } from '../src/abstract-service';
import { RequestTimeoutError } from '../src/errors';
import { Logger } from '../src/logger';

/** Minimal concrete service that POSTs a raw body through `request()`. */
class WireService extends AbstractService {
  _endpoint = '/write';
  _method = 'POST' as const;
  async send(body: string): Promise<Response> {
    return this.request({ body });
  }
}

interface Received {
  method?: string;
  headers: http.IncomingHttpHeaders;
  // Original on-the-wire header names/values (node lowercases `headers`), needed
  // to assert case-sensitive header names such as `Authorization`.
  rawHeaders: string[];
  body: string;
}

let server: http.Server;
let baseUrl: string;
let received: Received[];
// Per-test server behaviour (reset in beforeEach); lets a test force a 204 or
// an unresponsive/slow controller.
let behavior: { status: number; body: string | null; delayMs: number };

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      received.push({
        method: req.method,
        headers: req.headers,
        rawHeaders: req.rawHeaders,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      const respond = (): void => {
        res.writeHead(behavior.status, { 'content-type': 'text/plain' });
        res.end(behavior.body ?? undefined);
      };
      if (behavior.delayMs > 0) {
        const t = setTimeout(respond, behavior.delayMs);
        res.on('close', () => clearTimeout(t));
      } else {
        respond();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

beforeEach(() => {
  received = [];
  behavior = { status: 200, body: 'done', delayMs: 0 };
});

describe('AbstractService real-wire request (node:http, no mocks)', () => {
  it('POSTs a clean request: no browser-injected headers, literal comma preserved', async () => {
    const config: IServiceConfig = { controllerUrl: baseUrl, basicAuth: false, timeout: 5000 };
    const svc = new WireService(config, new Logger());

    const res = await svc.send('ENA=7,2&MANUAL=1');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('done');

    expect(received).toHaveLength(1);
    const got = received[0]!;
    expect(got.method).toBe('POST');

    // (1) Body reaches the controller byte-for-byte, with a LITERAL comma
    //     (no `%2C`) — the exact wire format the firmware requires.
    expect(got.body).toBe('ENA=7,2&MANUAL=1');
    expect(got.body).not.toContain('%2C');

    // (2) `Content-Length` must reach the wire CAPITALISED. The firmware ignores
    //     the body of a write carrying a lowercase `content-length` (which undici
    //     emits) — dropping the write while still answering 200. node lowercases
    //     `req.headers`, so assert against the raw wire names.
    expect(got.rawHeaders).toContain('Content-Length');
    expect(got.rawHeaders).not.toContain('content-length');

    // (3) The browser-only headers that WHATWG fetch() injects must be absent.
    //     If someone routes request() through fetch(), these reappear and this
    //     test fails.
    expect(got.headers['sec-fetch-mode']).toBeUndefined();
    expect(got.headers['sec-fetch-dest']).toBeUndefined();
    expect(got.headers['sec-fetch-site']).toBeUndefined();
    expect(got.headers['accept-language']).toBeUndefined();
    expect(got.headers['accept']).toBeUndefined();
    expect(got.headers['user-agent']).toBeUndefined();
  });

  it('sends the basic-auth Authorization header when configured', async () => {
    const config: IServiceConfig = {
      controllerUrl: baseUrl,
      basicAuth: true,
      username: 'pooluser',
      password: 's3cr3t',
      timeout: 5000,
    };
    const svc = new WireService(config, new Logger());

    await svc.send('ENA=7,2&MANUAL=1');

    expect(received).toHaveLength(1);
    const got = received[0]!;
    expect(got.headers['authorization']).toBe('Basic ' + Buffer.from('pooluser:s3cr3t').toString('base64'));

    // The header NAME must reach the wire capitalised as `Authorization`. The
    // controller's legacy firmware is case-sensitive and 401s a write carrying a
    // lowercase `authorization` (which WHATWG `Headers` would produce). node
    // lowercases `req.headers`, so assert against the raw wire names.
    expect(got.rawHeaders).toContain('Authorization');
    expect(got.rawHeaders).not.toContain('authorization');

    // Even with auth on, the browser headers stay absent.
    expect(got.headers['sec-fetch-mode']).toBeUndefined();
    expect(got.headers['accept-language']).toBeUndefined();
  });

  it('returns a null-body Response for a 204 No Content instead of throwing', async () => {
    behavior = { status: 204, body: null, delayMs: 0 };
    const config: IServiceConfig = { controllerUrl: baseUrl, basicAuth: false, timeout: 5000 };
    const svc = new WireService(config, new Logger());
    const res = await svc.send('ENA=7,2&MANUAL=1');
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('maps an unresponsive controller to RequestTimeoutError', async () => {
    behavior = { status: 200, body: 'done', delayMs: 1000 };
    const config: IServiceConfig = { controllerUrl: baseUrl, basicAuth: false, timeout: 50 };
    const svc = new WireService(config, new Logger());
    await expect(svc.send('ENA=7,2&MANUAL=1')).rejects.toBeInstanceOf(RequestTimeoutError);
  });
});
