import { describe, it, expect, afterEach, vi } from 'vitest';
import { AbstractService, type IServiceConfig } from '../src/abstract-service';
import { Logger } from '../src/logger';
import { BadCredentialsError, RequestTimeoutError } from '../src/errors';
import { mockFetchOnce, mockFetchNetworkError, mockFetchAbortable } from './helpers/fetch-mock';

class TestService extends AbstractService {
  _endpoint = '/test';
  _method = 'GET' as const;
  async run(): Promise<Response> {
    return this.request();
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
    const init = spy.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Basic ' + Buffer.from('u:p').toString('base64'));
  });
});
