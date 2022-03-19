/**
 * This example assumes you have a .env file in this directory or set the
 * appropriate environment vars manually.
 */
require('dotenv').config();
const GetStateCategory = require('procon-ip/lib').GetStateCategory;
const UsrcfgCgiService = require('procon-ip/lib').UsrcfgCgiService;
const RelayDataInterpreter = require('procon-ip/lib').RelayDataInterpreter;
const GetStateService = require('procon-ip/lib').GetStateService;
const Logger = require('procon-ip/lib').Logger;

const logger = new Logger();
const config = {
    "controllerUrl": process.env.PROCON_IP_BASE_URL,
    "basicAuth": true,
    "username": process.env.PROCON_IP_USERNAME,
    "password": process.env.PROCON_IP_PASSWORD,
    "timeout": 5000,
    "updateInterval": 5000,
    "errorTolerance": 2
}

const interpreter = new RelayDataInterpreter(logger)
const dataSource = new GetStateService(config, logger)
const relaySwitcher = new UsrcfgCgiService(config, logger, dataSource, interpreter)

dataSource.update().then(data => {
    // Let's just switch the chlorine dosage relay off to keep it easy...
    relaySwitcher.setOff(data.getChlorineDosageControl()).then(r => {
        logger.info(`Chlorine dosage control has been turned off (response code: ${r})`)
    })

    // ...to switch arbitrary relays you will have to determine the acutal
    // object id of the relay you want to switch:
    data.getDataObjectsByCategory(GetStateCategory.RELAYS).forEach(relay => {
        if (relay.label === "Gartenlicht") {
            relaySwitcher.setAuto(relay).then(r => {
                logger.info(`${relay.label} has been turned on (response code: ${r})`)
            })
        }
    })
})
