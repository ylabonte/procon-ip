import { describe, it, expect, afterEach, vi } from 'vitest';
import { request as undiciRequest } from 'undici';
import { AbstractService, type IServiceConfig, type RequestOptions } from '../src/abstract-service';
import { Logger } from '../src/logger';
import { BadCredentialsError, ProconIpError, RequestTimeoutError } from '../src/errors';
import { mockFetchOnce, mockFetchNetworkError, mockFetchAbortable, type UndiciResponse } from './helpers/fetch-mock';

// AbstractService.request() now uses undici.request() (not global fetch), so we
// mock undici's `request` export while keeping its other exports intact.
vi.mock('undici', async (orig) => ({ ...(await orig<typeof import('undici')>()), request: vi.fn() }));

class TestService extends AbstractService {
  _endpoint = '/test';
  _method = 'GET' as const;
  async run(init?: RequestOptions): Promise<Response> {
    return this.request(init);
  }
}

const baseConfig: IServiceConfig = {
  controllerUrl: 'http://example.local',
  basicAuth: false,
  timeout: 1000,
};

afterEach(() => vi.resetAllMocks()); // resets the persistent undici vi.fn() (call history + impls) between tests

describe('AbstractService', () => {
  it('joins base url and endpoint correctly', () => {
    const svc = new TestService(baseConfig, new Logger());
    expect(svc.url).toBe('http://example.local/test');
  });

  it('rejects a malformed controllerUrl at construction time with a clear ProconIpError', () => {
    // Catching the failure here -- rather than letting `new URL()` blow up
    // with a generic TypeError on the first request -- makes misconfig easy
    // to diagnose.
    expect(() => new TestService({ ...baseConfig, controllerUrl: 'not a url' }, new Logger())).toThrow(ProconIpError);
    expect(() => new TestService({ ...baseConfig, controllerUrl: '' }, new Logger())).toThrow(ProconIpError);
  });

  it('refuses params with unsafe characters in the value to prevent query-string injection', async () => {
    class WithBadParams extends AbstractService {
      _endpoint = '/test';
      _method = 'GET' as const;
      async run(): Promise<Response> {
        return this.request({ params: { foo: 'a&b=c' } });
      }
    }
    const svc = new WithBadParams(baseConfig, new Logger());
    await expect(svc.run()).rejects.toBeInstanceOf(ProconIpError);
  });

  it('returns the Response on 2xx', async () => {
    mockFetchOnce({ status: 200, body: 'hi' });
    const svc = new TestService(baseConfig, new Logger());
    const res = await svc.run();
    expect(await res.text()).toBe('hi');
  });

  it('throws BadCredentialsError on 401', async () => {
    mockFetchOnce({ status: 401, statusText: 'Unauthorized' });
    const svc = new TestService(baseConfig, new Logger());
    await expect(svc.run()).rejects.toBeInstanceOf(BadCredentialsError);
  });

  it('throws BadCredentialsError on 403', async () => {
    mockFetchOnce({ status: 403, statusText: 'Forbidden' });
    const svc = new TestService(baseConfig, new Logger());
    await expect(svc.run()).rejects.toBeInstanceOf(BadCredentialsError);
  });

  it('throws BadStatusCodeError on 5xx with status fields populated', async () => {
    // undici gives us only a numeric status (no reason phrase), so request()
    // formats the error as `HTTP <status>` and fills statusText with the
    // stringified status. Assert on the error TYPE and numeric status.
    mockFetchOnce({ status: 503 });
    const svc = new TestService(baseConfig, new Logger());
    await expect(svc.run()).rejects.toMatchObject({
      name: 'BadStatusCodeError',
      status: 503,
      statusText: '503',
    });
  });

  it('throws RequestTimeoutError when fetch outlasts timeout', async () => {
    mockFetchAbortable(50);
    const svc = new TestService({ ...baseConfig, timeout: 5 }, new Logger());
    await expect(svc.run()).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it('passes a network-layer failure through unchanged (not rewrapped as a Procon error)', async () => {
    mockFetchNetworkError('econnrefused');
    const svc = new TestService(baseConfig, new Logger());
    const pending = svc.run();
    // The original transport error propagates with its message intact...
    await expect(pending).rejects.toThrow('econnrefused');
    // ...and is NOT rewrapped as one of our typed errors (e.g. RequestTimeoutError).
    await expect(pending).rejects.not.toBeInstanceOf(ProconIpError);
  });

  it('attaches a capitalised Authorization header when basicAuth enabled', async () => {
    const spy = mockFetchOnce({ status: 200 });
    const svc = new TestService({ ...baseConfig, basicAuth: true, username: 'u', password: 'p' }, new Logger());
    await svc.run();
    // request() passes a PLAIN OBJECT as undici's `headers` so header-name case
    // is preserved on the wire — the controller is case-sensitive on the
    // `Authorization` name and 401s a lowercase `authorization`.
    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Basic ' + Buffer.from('u:p').toString('base64'));
    expect(Object.keys(headers)).toContain('Authorization');
    expect(Object.keys(headers)).not.toContain('authorization');
  });

  it('appends params raw (no URL encoding) so literal commas survive', async () => {
    const spy = mockFetchOnce({ status: 200 });

    class WithParams extends AbstractService {
      _endpoint = '/test';
      _method = 'GET' as const;
      async run(): Promise<Response> {
        return this.request({ params: { foo: 1, MAN_DOSAGE: '0,60' } });
      }
    }
    const svc = new WithParams(baseConfig, new Logger());
    await svc.run();
    const url = spy.mock.calls[0]?.[0] as string;
    expect(url).toBe('http://example.local/test?foo=1&MAN_DOSAGE=0,60');
  });

  it('always uses _method — RequestOptions has no `method` to override it', async () => {
    const spy = mockFetchOnce({ status: 200 });

    class TryOverride extends AbstractService {
      _endpoint = '/test';
      _method = 'GET' as const;
      async run(): Promise<Response> {
        // @ts-expect-error RequestOptions intentionally omits `method`; if this
        // ever compiles, request() no longer controls the HTTP method exclusively.
        return this.request({ method: 'POST' });
      }
    }
    const svc = new TryOverride(baseConfig, new Logger());
    await svc.run();
    expect(spy.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('honours an external AbortSignal and re-throws the original AbortError', async () => {
    // A long-running mock that the test will abort externally.
    vi.mocked(undiciRequest).mockImplementationOnce(
      (_url, opts) =>
        new Promise<UndiciResponse>((_resolve, reject) => {
          const signal = opts?.signal as AbortSignal | undefined;
          signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    const external = new AbortController();
    const svc = new TestService({ ...baseConfig, timeout: 10_000 }, new Logger());
    const pending = svc.run({ signal: external.signal });
    external.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    // Importantly: external abort must NOT be rewrapped as RequestTimeoutError.
    await expect(pending).rejects.not.toBeInstanceOf(RequestTimeoutError);
  });
});
