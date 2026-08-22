import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { UsrcfgCgiService } from '../src/usrcfg-cgi.service';
import { GetStateService, type IGetStateServiceConfig } from '../src/get-state.service';
import { RelayDataInterpreter } from '../src/relay-data-interpreter';
import { GetStateCategory } from '../src/get-state-data';
import { Logger } from '../src/logger';
import { mockFetchOnce } from './helpers/fetch-mock';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(resolve(__dirname, 'fixtures/get-state.csv'), 'utf8');
const config: IGetStateServiceConfig = {
  controllerUrl: 'http://example.local',
  basicAuth: false,
  timeout: 1000,
  updateInterval: 5000,
  errorTolerance: 2,
};

afterEach(() => vi.restoreAllMocks());

async function buildService() {
  mockFetchOnce({ body: fixture });
  const log = new Logger();
  const getStateService = new GetStateService(config, log);
  await getStateService.update();
  const interpreter = new RelayDataInterpreter(log);
  return { svc: new UsrcfgCgiService(config, log, getStateService, interpreter), getStateService };
}

describe('UsrcfgCgiService', () => {
  it('POSTs ENA=<on>,<auto>&MANUAL=1 form-encoded body to /usrcfg.cgi', async () => {
    const { svc, getStateService } = await buildService();
    // Each set* call fires TWO fetches: the POST + a subsequent GetState refresh.
    const calls: Array<[unknown, RequestInit | undefined]> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      calls.push([input, init]);
      const u = input as string;
      const body = u.includes('/usrcfg.cgi') ? '' : fixture;
      return Promise.resolve(new Response(body, { status: 200 }));
    });
    const relay = getStateService.data.getDataObjectsByCategory(GetStateCategory.RELAYS)[0];
    if (!relay) throw new Error('fixture has no relays');
    await svc.setOff(relay);
    // First call: POST to /usrcfg.cgi with the right body.
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const [url, init] = calls[0]!;
    expect(String(url as string | URL)).toContain('/usrcfg.cgi');
    expect(init?.method).toBe('POST');
    const body = init?.body as string;
    // The controller needs a LITERAL comma in ENA; a percent-encoded "%2C"
    // makes the firmware reset the connection (see UsrcfgCgiService.send).
    expect(body).toMatch(/^ENA=\d+,\d+&MANUAL=1$/);
    expect(body).not.toContain('%2C');
  });

  it('refreshes the shared GetStateService snapshot after a successful POST', async () => {
    // Sequential setOn / setOff calls compute masks from the GetStateService
    // snapshot; without a refresh in between the second call would see the
    // pre-first-write state and could undo it (see RelayDataInterpreter.evaluate
    // warning). Verify that each set* call performs a GET to /GetState.csv
    // immediately after the /usrcfg.cgi POST.
    const { svc, getStateService } = await buildService();
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const u = input as string;
      calls.push(u);
      const body = u.includes('/usrcfg.cgi') ? '' : fixture;
      return Promise.resolve(new Response(body, { status: 200 }));
    });
    const relay = getStateService.data.getDataObjectsByCategory(GetStateCategory.RELAYS)[0];
    if (!relay) throw new Error('fixture has no relays');
    await svc.setOff(relay);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('/usrcfg.cgi');
    expect(calls[1]).toContain('/GetState.csv');
  });

  it('setOn / setOff / setAuto all reach the endpoint', async () => {
    const { svc, getStateService } = await buildService();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const u = input as string;
      const body = u.includes('/usrcfg.cgi') ? '' : fixture;
      return Promise.resolve(new Response(body, { status: 200 }));
    });
    const relay = getStateService.data.getDataObjectsByCategory(GetStateCategory.RELAYS)[0];
    if (!relay) throw new Error('fixture has no relays');
    await expect(svc.setOn(relay)).resolves.toBeUndefined();
    await expect(svc.setOff(relay)).resolves.toBeUndefined();
    await expect(svc.setAuto(relay)).resolves.toBeUndefined();
  });
});
