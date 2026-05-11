import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GetStateService, type IGetStateServiceConfig } from '../src/get-state.service';
import { Logger } from '../src/logger';
import { GetStateData } from '../src/get-state-data';
import { mockFetchOnce, mockFetchNetworkError } from './helpers/fetch-mock';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixture = readFileSync(resolve(__dirname, 'fixtures/get-state.csv'), 'utf8');
const config: IGetStateServiceConfig = {
  controllerUrl: 'http://example.local',
  basicAuth: false,
  timeout: 1000,
  updateInterval: 5000,
  errorTolerance: 2,
};

afterEach(() => vi.restoreAllMocks());

describe('GetStateService', () => {
  it('parses a valid CSV response into GetStateData', async () => {
    mockFetchOnce({ body: fixture });
    const svc = new GetStateService(config, new Logger());
    const data = await svc.update();
    expect(data).toBeInstanceOf(GetStateData);
    expect(svc.hasData()).toBe(true);
  });

  it('counts consecutive errors and raises only after tolerance reached', async () => {
    const svc = new GetStateService({ ...config, errorTolerance: 2 }, new Logger());
    mockFetchNetworkError('boom');
    await svc.update(); // first failure swallowed
    expect(svc.hasData()).toBe(false);
    mockFetchNetworkError('boom');
    // second consecutive same error -> rethrow
    await expect(svc.update()).rejects.toBeInstanceOf(TypeError);
  });

  it('clamps a 0/negative errorTolerance to 1 so the modulo check stays valid', async () => {
    // Without the clamp, errorTolerance: 0 makes `_consecutiveFails % 0` NaN,
    // which is never === 0, so the service would silently swallow failures
    // forever. With Math.max(1, ...) the modulo math stays sane and consecutive
    // same-message failures re-throw at the second occurrence.
    const svc = new GetStateService({ ...config, errorTolerance: 0 }, new Logger());
    mockFetchNetworkError('boom');
    await svc.update(); // first failure: not yet consecutive, swallowed
    mockFetchNetworkError('boom');
    await expect(svc.update()).rejects.toBeInstanceOf(TypeError);
  });

  it('stop() prevents the error callback from firing for in-flight requests', async () => {
    // Race: start a poll, fail the in-flight request, but call stop() BEFORE
    // the rejection lands. The error callback must not fire afterwards.
    let rejectFetch!: (e: Error) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((_resolve, reject) => (rejectFetch = reject)),
    );
    const onError = vi.fn();
    const svc = new GetStateService(config, new Logger());
    svc.start(undefined, onError, true);
    svc.stop();
    rejectFetch(new TypeError('after-stop failure'));
    await new Promise((r) => setTimeout(r, 0)); // flush microtasks
    expect(onError).not.toHaveBeenCalled();
  });

  it('serialises in-flight updates — next tick scheduled only after settle', async () => {
    // A slow update (200ms) must not be overtaken by the next tick (50ms).
    // Without the .finally()-based scheduling this would fire twice and we'd
    // see overlapping callbacks. With it, only one tick fires before stop().
    vi.useFakeTimers();
    let resolveFetch!: (r: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>((r) => (resolveFetch = r)));
    const cb = vi.fn();
    const svc = new GetStateService({ ...config, updateInterval: 50 }, new Logger());
    svc.start(cb);
    // Advance well past the would-be next-tick boundary while the first
    // request is still in flight.
    await vi.advanceTimersByTimeAsync(500);
    expect(cb).not.toHaveBeenCalled(); // first update hasn't resolved yet
    // Now resolve the first update.
    resolveFetch(new Response(fixture, { status: 200 }));
    await vi.advanceTimersByTimeAsync(0); // flush microtasks
    expect(cb).toHaveBeenCalledTimes(1);
    svc.stop();
    vi.useRealTimers();
  });

  it('start() invokes successCallback on each update', async () => {
    vi.useFakeTimers();
    mockFetchOnce({ body: fixture });
    const cb = vi.fn();
    const svc = new GetStateService(config, new Logger());
    svc.start(cb);
    await vi.advanceTimersByTimeAsync(0);
    svc.stop();
    vi.useRealTimers();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
