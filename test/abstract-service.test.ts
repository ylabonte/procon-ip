import { describe, it, expect, afterEach, vi } from 'vitest';
import { AbstractService, type IServiceConfig } from '../src/abstract-service';
import { Logger } from '../src/logger';
import { BadCredentialsError, ProconIpError, RequestTimeoutError } from '../src/errors';
import { mockFetchOnce, mockFetchNetworkError, mockFetchAbortable } from './helpers/fetch-mock';

class TestService extends AbstractService {
  _endpoint = '/test';
  _method = 'GET' as const;
  async run(init?: RequestInit): Promise<Response> {
    return this.request(init);
  }
}

const baseConfig: IServiceConfig = {
  controllerUrl: 'http://example.local',
  basicAuth: false,
  timeout: 1000,
};

afterEach(() => vi.restoreAllMocks());

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
    mockFetchOnce({ status: 503, statusText: 'Service Unavailable' });
    const svc = new TestService(baseConfig, new Logger());
    await expect(svc.run()).rejects.toMatchObject({
      name: 'BadStatusCodeError',
      status: 503,
      statusText: 'Service Unavailable',
    });
  });

  it('throws RequestTimeoutError when fetch outlasts timeout', async () => {
    mockFetchAbortable(50);
    const svc = new TestService({ ...baseConfig, timeout: 5 }, new Logger());
    await expect(svc.run()).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it('passes through TypeError network failures unchanged', async () => {
    mockFetchNetworkError('econnrefused');
    const svc = new TestService(baseConfig, new Logger());
    await expect(svc.run()).rejects.toBeInstanceOf(TypeError);
  });

  it('attaches Authorization header when basicAuth enabled', async () => {
    const spy = mockFetchOnce({ status: 200 });
    const svc = new TestService({ ...baseConfig, basicAuth: true, username: 'u', password: 'p' }, new Logger());
    await svc.run();
    const init = spy.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Basic ' + Buffer.from('u:p').toString('base64'));
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

  it('forces _method even if init.method is provided', async () => {
    const spy = mockFetchOnce({ status: 200 });

    class TryOverride extends AbstractService {
      _endpoint = '/test';
      _method = 'GET' as const;
      async run(): Promise<Response> {
        return this.request({ method: 'POST' });
      }
    }
    const svc = new TryOverride(baseConfig, new Logger());
    await svc.run();
    expect((spy.mock.calls[0]?.[1] as RequestInit).method).toBe('GET');
  });

  it('honours an external AbortSignal and re-throws the original AbortError', async () => {
    // A long-running mock that the test will abort externally.
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
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
