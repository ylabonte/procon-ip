import { describe, it, expect, afterEach, vi } from 'vitest';
import { SetStateService } from '../src/set-state.service';
import { Logger } from '../src/logger';
import { mockFetchOnce } from './helpers/fetch-mock';

const config = {
  controllerUrl: 'http://example.local',
  basicAuth: false,
  timeout: 1000,
};

afterEach(() => vi.restoreAllMocks());

describe('SetStateService', () => {
  it('sends R{n}=1 and RT{n}=duration*1000', async () => {
    const spy = mockFetchOnce({ status: 200 });
    const svc = new SetStateService(config, new Logger());
    const result = await svc.setTimer(3, 60);
    expect(result).toBe(60);
    const u = String(spy.mock.calls[0]![0]);
    expect(u).toContain('R3=1');
    expect(u).toContain('RT3=60000');
  });
});
