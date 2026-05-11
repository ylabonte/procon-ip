import { vi, type MockInstance } from 'vitest';

export interface MockResponse {
  status?: number;
  statusText?: string;
  body?: string;
  delayMs?: number;
}

type FetchSpy = MockInstance<typeof globalThis.fetch>;

export function mockFetchOnce(res: MockResponse): FetchSpy {
  return vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
    if (res.delayMs) await new Promise((r) => setTimeout(r, res.delayMs));
    return new Response(res.body ?? '', {
      status: res.status ?? 200,
      statusText: res.statusText ?? 'OK',
    });
  });
}

export function mockFetchNetworkError(message = 'network'): FetchSpy {
  return vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
    throw new TypeError(message);
  });
}

export function mockFetchAbortable(delayMs: number): FetchSpy {
  return vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
    (_input, init) =>
      new Promise<Response>((resolve, reject) => {
        const t = setTimeout(() => resolve(new Response('late', { status: 200 })), delayMs);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new DOMException('aborted', 'AbortError'));
        });
      }),
  );
}
