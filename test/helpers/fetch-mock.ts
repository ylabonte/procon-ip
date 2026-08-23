import { vi, type MockInstance } from 'vitest';
import { httpRequest, type HttpResponse } from '../../src/http-transport';

export interface MockResponse {
  status?: number;
  statusText?: string;
  body?: string;
  delayMs?: number;
}

/**
 * The value {@link httpRequest} resolves to. `AbstractService.request()` consumes
 * `res.statusCode` and `res.text`, so the mocks are driven with that shape.
 */
export type MockedResponse = HttpResponse;

/**
 * Historical alias — the transport used to be `undici`; the tests still refer to
 * the resolved value by this name. Kept to avoid churn across the service tests.
 * @deprecated Use {@link MockedResponse}.
 */
export type UndiciResponse = HttpResponse;

type HttpSpy = MockInstance<typeof httpRequest>;

/** Build the object {@link httpRequest} resolves to for the code under test. */
export function mockHttpResponse(status: number, text = ''): HttpResponse {
  return { statusCode: status, text };
}

/**
 * Historical alias of {@link mockHttpResponse}.
 * @deprecated Use {@link mockHttpResponse}.
 */
export const mockUndiciResponse = mockHttpResponse;

/**
 * Queue a single successful (or arbitrary-status) response on the mocked
 * `httpRequest`. Returns the mock instance so callers can inspect
 * `mock.calls[i]` = `[url, opts]` where `opts` = `{ method, headers, body, signal }`.
 */
export function mockFetchOnce(res: MockResponse): HttpSpy {
  const spy = vi.mocked(httpRequest);
  spy.mockImplementationOnce(async (): Promise<HttpResponse> => {
    if (res.delayMs) await new Promise((r) => setTimeout(r, res.delayMs));
    return mockHttpResponse(res.status ?? 200, res.body ?? '');
  });
  return spy;
}

/**
 * Queue a single network-layer failure. The transport surfaces such errors as a
 * plain `Error`; `AbstractService.request()` re-throws it unchanged.
 */
export function mockFetchNetworkError(message = 'network'): HttpSpy {
  const spy = vi.mocked(httpRequest);
  spy.mockImplementationOnce((): never => {
    throw new Error(message);
  });
  return spy;
}

/**
 * Queue a response that resolves only after `delayMs`, but which rejects
 * immediately (with an `AbortError`) if the request's `signal` fires first.
 * Lets a test drive the timeout / abort paths of `AbstractService.request()`.
 */
export function mockFetchAbortable(delayMs: number): HttpSpy {
  const spy = vi.mocked(httpRequest);
  spy.mockImplementationOnce(
    (_url, opts) =>
      new Promise<HttpResponse>((resolve, reject) => {
        const t = setTimeout(() => resolve(mockHttpResponse(200, 'late')), delayMs);
        opts.signal?.addEventListener('abort', () => {
          clearTimeout(t);
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }),
  );
  return spy;
}
