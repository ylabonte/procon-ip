import { describe, it, expect, afterEach, vi } from 'vitest';
import { CommandService } from '../src/command.service';
import { Logger } from '../src/logger';
import { mockFetchOnce } from './helpers/fetch-mock';

const config = {
  controllerUrl: 'http://example.local',
  basicAuth: false,
  timeout: 1000,
};

afterEach(() => vi.restoreAllMocks());

describe('CommandService', () => {
  it('encodes MAN_DOSAGE in the URL and resolves with seconds', async () => {
    const spy = mockFetchOnce({ status: 200 });
    const svc = new CommandService(config, new Logger());
    const result = await svc.setChlorineDosage(60);
    expect(result).toBe(60);
    expect(String(spy.mock.calls[0]![0])).toContain('MAN_DOSAGE=0,60');
  });

  it('targets the correct dosage code per helper', async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push(url);
      return Promise.resolve(new Response('', { status: 200 }));
    });
    const svc = new CommandService(config, new Logger());
    await svc.setPhMinusDosage(30);
    await svc.setPhPlusDosage(45);
    expect(calls[0]).toContain('MAN_DOSAGE=1,30');
    expect(calls[1]).toContain('MAN_DOSAGE=2,45');
  });

  it('returns -1 after three failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('', { status: 500, statusText: 'oops' })),
    );
    const svc = new CommandService(config, new Logger());
    expect(await svc.setChlorineDosage(10)).toBe(-1);
  });
});
