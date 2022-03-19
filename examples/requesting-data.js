/**
 * This example assumes you have a .env file in this directory or set the
 * appropriate environment vars manually.
 */

require('dotenv').config();
const ProconIp = require('procon-ip/lib');
const GetStateService = ProconIp.GetStateService
const GetStateCategory = ProconIp.GetStateCategory

const logger = new ProconIp.Logger();
const config = {
    "controllerUrl": process.env.PROCON_IP_BASE_URL,
    "basicAuth": true,
    "username": process.env.PROCON_IP_USERNAME,
    "password": process.env.PROCON_IP_PASSWORD,
    "updateInterval": 5000,
    "timeout": 5000,
    "errorTolerance": 2
}

const dataSource = new GetStateService(config, logger)

// You can easily request fresh data on demand using the update...
dataSource.update().then((data) => {
    logger.info(`Uptime: ${data.sysInfo.uptime}`)
})

// ...or periodically
dataSource.start((data) => {
    logger.info("Got new data from pool controller")
    data.getDataObjectsByCategory(GetStateCategory.ELECTRODES).forEach((dataObject) => {
        logger.info(`${dataObject.label}: ${dataObject.displayValue}`)
    })
})
