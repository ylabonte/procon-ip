import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GetDmxService } from '../src/get-dmx.service';
import { GetDmxData } from '../src/get-dmx-data';
import { Logger } from '../src/logger';
import { mockFetchOnce } from './helpers/fetch-mock';

// AbstractService.request() uses httpRequest() (node:http); mock that export.
vi.mock('../src/http-transport', async (orig) => ({
  ...(await orig<typeof import('../src/http-transport')>()),
  httpRequest: vi.fn(),
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(resolve(__dirname, 'fixtures/get-dmx.csv'), 'utf8');
const config = { controllerUrl: 'http://example.local', basicAuth: false, timeout: 1000 };

afterEach(() => vi.resetAllMocks()); // resets the persistent httpRequest vi.fn() (call history + impls) between tests

describe('GetDmxService', () => {
  it('GETs /GetDmx.csv and returns GetDmxData', async () => {
    const spy = mockFetchOnce({ body: fixture });
    const svc = new GetDmxService(config, new Logger());
    const data = await svc.update();
    expect(data).toBeInstanceOf(GetDmxData);
    expect(String(spy.mock.calls[0]?.[0] as string | URL)).toContain('/GetDmx.csv');
  });
});
