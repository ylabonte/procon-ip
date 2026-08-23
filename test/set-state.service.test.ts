import { describe, it, expect, afterEach, vi } from 'vitest';
import { SetStateService } from '../src/set-state.service';
import { Logger } from '../src/logger';
import { mockFetchOnce } from './helpers/fetch-mock';

// AbstractService.request() uses httpRequest() (node:http); mock that export.
vi.mock('../src/http-transport', async (orig) => ({
  ...(await orig<typeof import('../src/http-transport')>()),
  httpRequest: vi.fn(),
}));

const config = {
  controllerUrl: 'http://example.local',
  basicAuth: false,
  timeout: 1000,
};

afterEach(() => vi.resetAllMocks()); // resets the persistent httpRequest vi.fn() (call history + impls) between tests

describe('SetStateService', () => {
  it('sends R{n}=1 and RT{n}=duration*1000', async () => {
    const spy = mockFetchOnce({ status: 200 });
    const svc = new SetStateService(config, new Logger());
    const result = await svc.setTimer(3, 60);
    expect(result).toBe(60);
    const u = spy.mock.calls[0]?.[0] as string;
    expect(u).toContain('R3=1');
    expect(u).toContain('RT3=60000');
  });

  it('truncates fractional durations and uses integer-only ms arithmetic', async () => {
    // Without truncation, 0.3 * 1000 produces 300.00000000000006 in JS and
    // that exact string would land in the URL since params are raw-concat.
    const spy = mockFetchOnce({ status: 200 });
    const svc = new SetStateService(config, new Logger());
    const result = await svc.setTimer(5, 0.3);
    expect(result).toBe(0); // Math.trunc(0.3)
    const u = spy.mock.calls[0]?.[0] as string;
    expect(u).toContain('RT5=0');
    expect(u).not.toMatch(/RT5=\d*\.\d/); // no decimals in the ms string
  });

  it('throws ProconIpError on a non-finite duration', async () => {
    const svc = new SetStateService(config, new Logger());
    await expect(svc.setTimer(1, Number.NaN)).rejects.toThrow(/Invalid timer duration/);
    await expect(svc.setTimer(1, Number.POSITIVE_INFINITY)).rejects.toThrow(/Invalid timer duration/);
  });
});
