// REAL-WIRE regression test — intentionally does NOT mock undici.
//
// This guards against the two concrete bugs that silently broke relay/DMX
// writes on the ProCon.IP controller's legacy firmware:
//
//   1. Browser-only request headers. When AbstractService.request() used the
//      WHATWG `fetch()`, Node injected `sec-fetch-mode`, `accept`,
//      `accept-language`, `user-agent`, `content-type`, etc. onto the wire.
//      The firmware answered such writes with "200 done" but silently ignored
//      them. Switching to `undici.request()` sends ONLY the headers we set.
//      This test drives the *real* undici path against a local node:http
//      server and asserts those fetch-injected headers are absent — so it goes
//      red the moment anyone switches `request()` back to `fetch()`.
//
//   2. Comma encoding. The controller needs a LITERAL comma in bodies like
//      `ENA=7,2&MANUAL=1`; a percent-encoded `%2C` makes the firmware reset
//      the connection. This test asserts the received body is byte-for-byte
//      `ENA=7,2&MANUAL=1`.
//
// NOTE on `connection: keep-alive`: undici sends that header too (verified
// against a real socket), so it is NOT a fetch-vs-undici discriminator and is
// deliberately not asserted here. The `sec-fetch-*` / `accept-language` /
// `accept` / `user-agent` headers below ARE fetch-only and do the guarding.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { AbstractService, type IServiceConfig } from '../src/abstract-service';
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
  body: string;
}

let server: http.Server;
let baseUrl: string;
let received: Received[];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      received.push({
        method: req.method,
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('done');
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
});

describe('AbstractService real-wire request (undici, no mocks)', () => {
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

    // (2) The headers that WHATWG fetch() injects and undici does NOT must be
    //     absent. If someone reverts request() to fetch(), these reappear and
    //     this test fails.
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
    // Even with auth on, the browser headers stay absent.
    expect(got.headers['sec-fetch-mode']).toBeUndefined();
    expect(got.headers['accept-language']).toBeUndefined();
  });
});
