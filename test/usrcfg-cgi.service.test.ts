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
    const spy = mockFetchOnce({ status: 200 });
    const relay = getStateService.data.getDataObjectsByCategory(GetStateCategory.RELAYS)[0];
    if (!relay) throw new Error('fixture has no relays');
    await svc.setOff(relay);
    expect(spy).toHaveBeenCalled();
    const call = spy.mock.calls[0];
    if (!call) throw new Error('fetch was not called');
    const [url, init] = call;
    expect(String(url as string | URL)).toContain('/usrcfg.cgi');
    expect((init as RequestInit).method).toBe('POST');
    const body = (init as RequestInit).body as string;
    expect(body).toMatch(/^ENA=\d+%2C\d+&MANUAL=1$/);
  });

  it('setOn / setOff / setAuto all reach the endpoint', async () => {
    const { svc, getStateService } = await buildService();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const relay = getStateService.data.getDataObjectsByCategory(GetStateCategory.RELAYS)[0];
    if (!relay) throw new Error('fixture has no relays');
    await expect(svc.setOn(relay)).resolves.toBeUndefined();
    await expect(svc.setOff(relay)).resolves.toBeUndefined();
    await expect(svc.setAuto(relay)).resolves.toBeUndefined();
  });
});
