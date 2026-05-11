/**
 * This example assumes you have a .env file in this directory or set the
 * appropriate environment vars manually.
 */

import 'dotenv/config';
import {
  GetStateService,
  UsrcfgCgiService,
  RelayDataInterpreter,
  GetStateCategory,
  Logger,
} from 'procon-ip';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}. Set it in .env or your shell.`);
    process.exit(1);
  }
  return v;
}

const logger = new Logger();
const config = {
  controllerUrl: requireEnv('PROCON_IP_BASE_URL'),
  basicAuth: true,
  username: requireEnv('PROCON_IP_USERNAME'),
  password: requireEnv('PROCON_IP_PASSWORD'),
  timeout: 5000,
  updateInterval: 5000,
  errorTolerance: 2,
};

const interpreter = new RelayDataInterpreter(logger);
const dataSource = new GetStateService(config, logger);
const relays = new UsrcfgCgiService(config, logger, dataSource, interpreter);

const data = await dataSource.update();

// Switch the chlorine dosage relay off:
await relays.setOff(data.getChlorineDosageControl());
logger.info('Chlorine dosage control has been turned off');

// Hand a relay back to the controller's automatic schedule by label:
for (const relay of data.getDataObjectsByCategory(GetStateCategory.RELAYS)) {
  if (relay.label === 'Gartenlicht') {
    await relays.setAuto(relay);
    logger.info(`${relay.label} is back on auto schedule`);
  }
}
