# procon-ip

[![NPM](https://nodei.co/npm/procon-ip.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/procon-ip/)

Package info  
[![npm version](https://badge.fury.io/js/procon-ip.svg)](https://badge.fury.io/js/procon-ip)
![GitHub](https://img.shields.io/github/license/ylabonte/procon-ip)
![GitHub issues](https://img.shields.io/github/issues-raw/ylabonte/procon-ip)  
[![Known Vulnerabilities](https://snyk.io/test/github/ylabonte/procon-ip/badge.svg)](https://snyk.io/test/github/ylabonte/procon-ip)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/ylabonte/procon-ip.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/ylabonte/procon-ip/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/ylabonte/procon-ip.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/ylabonte/procon-ip/context:javascript)  
![CI Workflow](https://github.com/ylabonte/procon-ip/workflows/CI%20Workflow/badge.svg)
![CodeQL](https://github.com/ylabonte/procon-ip/workflows/CodeQL/badge.svg)
![Github Package release](https://github.com/ylabonte/procon-ip/workflows/Github%20Package%20Release/badge.svg)
![NPM Package release](https://github.com/ylabonte/procon-ip/workflows/NPM%20Package%20Release/badge.svg)

## Overview

* [Changelog](#changelog)
* [Introduction (_What is this library for?_)](#introduction)
* [Examples](#examples)
  * [Requesting data](#requesting-data)
  * [Switching relays](#switching-relays)
* [Full API docs (auto generated)](#full-api-docs)
* [A brief description of the ProCon.IP pool controller](#a-brief-description-of-the-proconip-pool-controller)
* [Disclaimer](#disclaimer)

---

## Changelog

### Release v1.5.0
* Use Node 18 for builds/releases.
* Drop Node 14 from compatibility/ci build test list.
* Update dependencies.
* Merge pull-request to make `GetStateData.categories` static  
  (while keeping backward compatibility).

### Release v1.4.2
* Fix condition for identifying similar consecutive errors in `GetStateService`
  in case no status code is available.

### Release v1.4.1
* Fine tune error behavior of the `GetStateService.start()`.
  * Add documentation for `errorCallback` parameter.
  * Add new optional parameter `stopOnError: boolean`.
  * Pass original `Error` (mostly `AxiosError`) instead of an own error
    as parameter to the `errorCallback` (parameter of the
    `GetStateService.start()` method).
  * New method signature + documentation:  
  ```TypeScript
   /**
    * Start the service.
    * 
    * This will periodically update the internal data and invoke the optional
    * callables each time new data is received.
    * 
    * @param successCallback Will be triggered everytime the service receives
    * new data. The current [[`GetStateData`]] object is passed as parameter
    * to the callback.
    * @param errorCallback Error callback receives the most recent error as
    * parameter, in case the consecutive error tolerance is hit.
    * @param stopOnError Whether to stop in case the consecutive error tolerance
    * is hit. Default behavior (for backward compatibility) is to keep running
    * in any case.
    */
    start(
        successCallback?: (data: GetStateData) => void,
        errorCallback?: (e: Error) => void,
        stopOnError?: boolean);
    ```

### Release v1.4.0

* Change build parameters making the default build an ES-Module
  * There is nothing to change if you want to keep using the CommonJS build.
    But you can also make use of the index.js also added with this release
    (see next bullet point).
* Introduce the commonly used index.js to ease `import`/`require` statements.
  This means you can import all classes and interfaces from the index module.
  * For the CommonJS variant you can simply your imports by using 
    `import { GetStateService } from 'procon-ip/lib` instead of 
    `import { GetStateService } from 'procon-ip/lib/get-state.service'`.
  * For the new ES Module variant just use 
    `import { GetStateService } from 'procon-ip'`.
* Add new property `RelayDataObject.isExternal`.
* Migrate from `tslint` to `eslint`.
* Update dependencies.

### Release v1.3.3

* Fix `RelayDataObject.bitMask` (was broken since `categoryId` refactoring).

### Release v1.3.2

* Fix `UsrcfgCgiService.send()` method for switching relays.

### Release v1.3.1

* Fix `GetStateDataObject.categoryId` to start counting from 0 as stated in the
  documentation.

### Release v1.3.0

* **Breaking changes:** Some properties of the `GetStateDataSysInfo` have been
  renamed fixing a typo: 
  * `phPlusDosageRelais` --> `phPlusDosageRelay`
  * `phMinusDosageRelais` --> `phMinusDosageRelay`
  * `chlorineDosageRelais` --> `chlorineDosageRelay`
* New methods have been added to the `GetStateDataSysInfo()` class (credits go to
  @kriede for this):
  * `isElectrolysis(): boolean`
  * `getDosageRelais(object: GetStateDataObject): number`
  * `isAvatarEnabled(): boolean`
  * `isFlowSensorEnabled(): boolean`
  * `isDmxEnabled(): boolean`
* Some typos in documentation and debug output have been fixed. 
* Various dependencies have been updated.

---

## Introduction

The name of this library refers to the [ProCon.IP pool controller](#what-is-procon-ip).
Documentation might follow. Until this please take a look at the sources. I
tried to keep the interfaces readable. An IDE with proper auto-completion should
help understand and use the library without further documentation.

Feel free to ask questions by using githubs issues system, so others can take
part and are able to find the answer if they have a similar question. Thanks! :)

## Examples

### Requesting data

First you have to initialize the `GetStateService`, which is responsible for
receiving information from the ProCon.IP controller.

```javascript
const ProconIp = require('procon-ip');
const GetStateService = ProconIp.GetStateService
const GetStateCategory = ProconIp.GetStateCategory
const Logger = ProconIp.Logger

const logger = new Logger();
const config = {
    "controllerUrl": "http://192.168.2.3", // <-- replace with your pool controller's address
    "basicAuth": true,
    "username": "admin",
    "password": "admin",
    "updateInterval": 5000,
    "timeout": 5000,
    "errorTolerance": 2
}

const dataSource = new GetStateService(config, logger)
```

In **TypeScript** you would write the following instead.

```typescript
import { GetStateService, GetStateCategory, Logger } from 'procon-ip'

// Just continue as in the snippet above...
```

You will have to replace the `controllerUrl` with the one pointing at your
ProCon.IP device, but except that it should just work.

With the `GetStateService` initialized you can simply request fresh data by
calling the `update()` or `start()` methods.

```javascript
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
```

Be aware of the the asynchronous character of this functions. Executing the
code above might produce an output like this:

```shell
(2020-10-31T03:19:36.844Z) INFO: Got new data from pool controller
(2020-10-31T03:19:36.847Z) INFO: Redox: 927.75 mV
(2020-10-31T03:19:36.847Z) INFO: pH: 3.43 pH
(2020-10-31T03:19:36.847Z) INFO: Uptime: 1105292
(2020-10-31T03:19:36.848Z) INFO: Got new data from pool controller
(2020-10-31T03:19:36.848Z) INFO: Redox: 927.88 mV
(2020-10-31T03:19:36.848Z) INFO: pH: 3.43 pH
```

Actually I got this output during a test run ensuring the exmaple code would
work.

### Switching relays

```javascript
const ProconIp = require('procon-ip');
const UsrcfgCgiService = ProconIp.UsrcfgCgiService
const RelayDataInterpreter = ProconIp.RelayDataInterpreter
const GetStateCategory = ProconIp.GetStateCategory
const GetStateService = ProconIp.GetStateService
const Logger = ProconIp.Logger

const logger = new Logger();
const config = {
    "controllerUrl": "http://192.168.2.3",
    "basicAuth": true,
    "username": "admin",
    "password": "admin",
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
    // object id of the relay you want to switch (e.g. by its label):
    data.getDataObjectsByCategory(GetStateCategory.RELAYS).forEach(relay => {
        if (relay.label === "Gartenlicht") {
            relaySwitcher.setAuto(relay).then(r => {
                logger.info(`${relay.label} has been turned on (response code: ${r})`)
            })
        }
    })
})
```

The examples above can also be found in the `examples` directory of this repository.

## Full API docs

Find the [full API documentation](https://ylabonte.github.io/procon-ip/)
published via Github Pages.

## A brief description of the ProCon.IP pool controller

![Picture from pooldigital.de](https://www.pooldigital.de/shop/media/image/66/47/a5/ProConIP1_720x600.png)

The ProCon.IP pool controller is a low budget network attached control unit for
home swimming pools. With its software switched relays, it can control
multiple pumps (for the pool filter and different dosage aspects) either
simply planned per time schedule or depending on a reading/value from one of
its many input channels for measurements (eg. i/o flow sensors, Dallas 1-Wire
termometers, redox and pH electrodes). At least there is also the option to
switch these relays on demand, which makes them also applicable for switching
lights (or anything else you want) on/off.
Not all of its functionality is reachable via API. In fact there is one
documented API for reading (polling) values as CSV (`/GetState.csv`). In my
memories there was another one for switching the relays on/off and on with
timer. But I cannot find the second one anymore. So not even pretty, but
functional: The ProCon.IP has two native web interfaces, which can be
analyzed, to some kind of reverse engineer a given functionality (like
switching the relays).

For more information see the following links (sorry it's only in german;
haven't found an english documentation/information so far):

* [pooldigital.de webshop](https://www.pooldigital.de/shop/poolsteuerungen/procon.ip/35/procon.ip-webbasierte-poolsteuerung-/-dosieranlage)
* [pooldigital.de forum](http://forum.pooldigital.de/)

## Disclaimer

**Just to be clear: I have nothing to do with the development, sellings,
marketing or support of the pool controller unit itself. I just developed a
solution to integrate such with [ioBroker](https://github.com/ylabonte/ioBroker.procon-ip)
and now decoupled the library part to make it cleaner.**
