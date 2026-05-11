/**
 * Read the current DMX512 state from the controller, mutate every channel,
 * and push the new state back. The controller only accepts full 16-channel
 * writes, so DmxService.set always sends every channel.
 *
 * Requires:
 *   PROCON_IP_BASE_URL=http://192.168.2.3
 *   PROCON_IP_USERNAME=admin   (only if basic auth is enabled on the controller)
 *   PROCON_IP_PASSWORD=admin
 */

import 'dotenv/config';
import { GetDmxService, DmxService, Logger } from 'procon-ip';

const logger = new Logger();
const config = {
  controllerUrl: process.env.PROCON_IP_BASE_URL,
  basicAuth: !!process.env.PROCON_IP_USERNAME,
  username: process.env.PROCON_IP_USERNAME,
  password: process.env.PROCON_IP_PASSWORD,
  timeout: 5000,
};

const reader = new GetDmxService(config, logger);
const writer = new DmxService(config, logger);

const dmx = await reader.update();
logger.info(`Current DMX state: ${[...dmx].map((c) => `${c.name}=${c.value}`).join(' ')}`);

// Shift every channel by 64 (clamped to [0, 255] by .set()):
for (const ch of dmx) dmx.set(ch.index, (ch.value + 64) % 256);

await writer.set(dmx);
logger.info('DMX state pushed back to controller.');
