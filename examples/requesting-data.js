/**
 * This example assumes you have a .env file in this directory or set the
 * appropriate environment vars manually.
 *
 *   PROCON_IP_BASE_URL=http://192.168.2.3
 *   PROCON_IP_USERNAME=admin
 *   PROCON_IP_PASSWORD=admin
 */

import 'dotenv/config';
import {
  GetStateService,
  GetStateCategory,
  Logger,
  BadCredentialsError,
} from 'procon-ip';

const logger = new Logger();
const config = {
  controllerUrl: process.env.PROCON_IP_BASE_URL,
  basicAuth: true,
  username: process.env.PROCON_IP_USERNAME,
  password: process.env.PROCON_IP_PASSWORD,
  updateInterval: 5000,
  timeout: 5000,
  errorTolerance: 2,
};

const dataSource = new GetStateService(config, logger);

// One-shot fetch:
try {
  const data = await dataSource.update();
  logger.info(`Uptime: ${data.sysInfo.uptime}`);
} catch (e) {
  if (e instanceof BadCredentialsError) {
    logger.error('Wrong basic-auth credentials.');
  } else {
    throw e;
  }
}

// Or poll continuously:
dataSource.start(
  (data) => {
    logger.info('Got new data from pool controller');
    for (const obj of data.getDataObjectsByCategory(GetStateCategory.ELECTRODES)) {
      logger.info(`${obj.label}: ${obj.displayValue}`);
    }
  },
  (e) => logger.error(`Polling error: ${e.message}`),
);
