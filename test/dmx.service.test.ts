import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DmxService } from '../src/dmx.service';
import { GetDmxData } from '../src/get-dmx-data';
import { Logger } from '../src/logger';
import { mockFetchOnce } from './helpers/fetch-mock';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(resolve(__dirname, 'fixtures/get-dmx.csv'), 'utf8');
const config = { controllerUrl: 'http://example.local', basicAuth: false, timeout: 1000 };

afterEach(() => vi.restoreAllMocks());

describe('DmxService', () => {
  it('POSTs form-encoded DMX state to /usrcfg.cgi', async () => {
    const spy = mockFetchOnce({ status: 200 });
    const svc = new DmxService(config, new Logger());
    await svc.set(new GetDmxData(fixture));
    const call = spy.mock.calls[0];
    if (!call) throw new Error('fetch was not called');
    const [url, init] = call;
    expect(String(url as string | URL)).toContain('/usrcfg.cgi');
    const body = (init as RequestInit).body as string;
    expect(body).toContain('TYPE=0');
    expect(body).toContain('LEN=16');
    expect(body).toContain('DMX512=1');
    // Literal commas: URLSearchParams would send "%2C" and the controller would
    // reject the request (see DmxService.set).
    expect(body).toContain('CH1_8=0,16,32,48,64,80,96,112');
    expect(body).not.toContain('%2C');
  });
});
