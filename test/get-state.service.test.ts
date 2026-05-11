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

  it('start() is idempotent — calling it twice does not overlap requests or timers', async () => {
    // If start() weren't idempotent the second call would set _polling=true
    // again and call autoUpdate(), spawning a parallel in-flight update()
    // and a second timer chain. We assert only ONE fetch fires before the
    // first settles.
    vi.useFakeTimers();
    let pending!: () => void;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        () => new Promise<Response>((resolve) => (pending = () => resolve(new Response(fixture, { status: 200 })))),
      );
    const svc = new GetStateService(config, new Logger());
    svc.start();
    svc.start(); // second call: must be a no-op while in-flight
    await vi.advanceTimersByTimeAsync(0); // flush microtasks; first fetch is still in flight
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    pending();
    await vi.advanceTimersByTimeAsync(0); // let the first settle
    svc.stop();
    vi.useRealTimers();
  });

  it('start() refreshes callbacks but does not duplicate the poll loop when already running', () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>(() => {
          /* never resolves */
        }),
    );
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const svc = new GetStateService(config, new Logger());
    svc.start(cb1);
    // Now swap the callback while still in-flight; the swap must take effect
    // for any subsequent successful update, without spawning a duplicate loop.
    svc.start(cb2);
    expect(svc.isRunning()).toBe(true);
    svc.stop();
    vi.useRealTimers();
  });

  it('isolates the success callback — a throwing callback is NOT a polling failure', async () => {
    // A consumer bug in their success callback must not advance
    // _consecutiveFails or flip hasData -- the HTTP request succeeded.
    mockFetchOnce({ body: fixture });
    const cb = vi.fn(() => {
      throw new Error('consumer-side bug');
    });
    const svc = new GetStateService(config, new Logger());
    svc.start(cb);
    // Drain microtasks so the in-flight update settles.
    await new Promise((r) => setTimeout(r, 0));
    svc.stop();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(svc.hasData()).toBe(true); // request succeeded
  });

  it('defaults a non-finite errorTolerance (NaN / Infinity) to 1', async () => {
    // Without Number.isFinite guard, Math.max(1, Math.trunc(NaN)) is NaN,
    // and `_consecutiveFails % NaN` never equals 0 -> failures swallowed
    // indefinitely. Same with Infinity.
    const svc = new GetStateService({ ...config, errorTolerance: Number.NaN }, new Logger());
    mockFetchNetworkError('boom');
    await svc.update(); // first failure: swallowed (not yet consecutive)
    mockFetchNetworkError('boom');
    // With the default of 1, the second consecutive same-message failure throws.
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
