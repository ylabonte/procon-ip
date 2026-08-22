import { vi, type MockInstance } from 'vitest';
import { request as undiciRequest } from 'undici';

export interface MockResponse {
  status?: number;
  statusText?: string;
  body?: string;
  delayMs?: number;
}

/**
 * The value `undici.request()` resolves to (`Dispatcher.ResponseData`). Used to
 * type the mock implementations so `AbstractService.request()` — which consumes
 * `res.statusCode` and `res.body.{text,dump}()` — is driven with a faithful shape.
 */
export type UndiciResponse = Awaited<ReturnType<typeof undiciRequest>>;

type UndiciSpy = MockInstance<typeof undiciRequest>;

/**
 * Build an object shaped like undici's response with just enough of `body`
 * implemented for the code under test to consume it. Cast because we only
 * populate the fields `AbstractService.request()` actually touches.
 */
export function mockUndiciResponse(status: number, body = ''): UndiciResponse {
  return {
    statusCode: status,
    headers: {},
    body: {
      text: (): Promise<string> => Promise.resolve(body),
      json: (): Promise<unknown> => Promise.resolve(JSON.parse(body) as unknown),
      arrayBuffer: (): Promise<ArrayBufferLike> => Promise.resolve(new TextEncoder().encode(body).buffer),
      dump: (): Promise<undefined> => Promise.resolve(undefined),
    },
  } as unknown as UndiciResponse;
}

/**
 * Queue a single successful (or arbitrary-status) response on the mocked
 * `undici.request`. Returns the mock instance so callers can inspect
 * `mock.calls[i]` = `[url, opts]` where `opts` = `{ method, headers, body, signal }`.
 */
export function mockFetchOnce(res: MockResponse): UndiciSpy {
  const spy = vi.mocked(undiciRequest);
  spy.mockImplementationOnce(async (): Promise<UndiciResponse> => {
    if (res.delayMs) await new Promise((r) => setTimeout(r, res.delayMs));
    return mockUndiciResponse(res.status ?? 200, res.body ?? '');
  });
  return spy;
}

/**
 * Queue a single network-layer failure. undici surfaces transport errors as a
 * plain `Error` (unlike WHATWG `fetch`, which throws `TypeError`), so that is
 * what we throw here; `AbstractService.request()` re-throws it unchanged.
 */
export function mockFetchNetworkError(message = 'network'): UndiciSpy {
  const spy = vi.mocked(undiciRequest);
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
export function mockFetchAbortable(delayMs: number): UndiciSpy {
  const spy = vi.mocked(undiciRequest);
  spy.mockImplementationOnce(
    (_url, opts) =>
      new Promise<UndiciResponse>((resolve, reject) => {
        const t = setTimeout(() => resolve(mockUndiciResponse(200, 'late')), delayMs);
        const signal = opts?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => {
          clearTimeout(t);
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }),
  );
  return spy;
}
