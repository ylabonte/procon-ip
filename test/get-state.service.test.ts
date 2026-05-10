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
