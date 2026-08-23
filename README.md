# procon-ip

[![NPM](https://nodei.co/npm/procon-ip.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/procon-ip)

Package info  
[![npm version](https://badge.fury.io/js/procon-ip.svg)](https://www.npmjs.com/package/procon-ip)
[![GitHub](https://img.shields.io/github/license/ylabonte/procon-ip)](https://github.com/ylabonte/procon-ip/blob/master/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues-raw/ylabonte/procon-ip)](https://github.com/ylabonte/procon-ip/issues)
[![Known Vulnerabilities](https://snyk.io/test/github/ylabonte/procon-ip/badge.svg)](https://snyk.io/test/github/ylabonte/procon-ip)  
[![CI Workflow](https://github.com/ylabonte/procon-ip/actions/workflows/ci.yml/badge.svg)](https://github.com/ylabonte/procon-ip/actions/workflows/ci.yml)
[![Docs](https://github.com/ylabonte/procon-ip/actions/workflows/docs.yml/badge.svg)](https://github.com/ylabonte/procon-ip/actions/workflows/docs.yml)
[![CodeQL](https://github.com/ylabonte/procon-ip/actions/workflows/codeql.yml/badge.svg)](https://github.com/ylabonte/procon-ip/actions/workflows/codeql.yml)  
[![Buy me a coffee](https://img.shields.io/badge/donation-buy%20me%20a%20coffee-yellow.svg?style=flat)](https://www.buymeacoffee.com/ylabonte)

![ProCon.IP TypeScript library](./logo.png)

> **Migrating from 1.x?** See [`CHANGELOG.md`](./CHANGELOG.md) — v2.0.0 drops
> Node ≤ 18, replaces `axios` with native `fetch`, removes deep imports, and
> adds DMX512 support. Migration snippets are at the bottom of the changelog.

## Overview

* [Introduction](#introduction)
* [Installation](#installation)
* [Examples](#examples)
  * [Requesting data](#requesting-data)
  * [Switching relays](#switching-relays)
  * [Manual dosage](#manual-dosage)
  * [DMX512](#dmx512)
* [Error handling](#error-handling)
* [Full API docs](#full-api-docs)
* [A brief description of the ProCon.IP pool controller](#a-brief-description-of-the-proconip-pool-controller)
* [Changelog](#changelog)
* [Disclaimer](#disclaimer)

---

## Introduction

`procon-ip` is a TypeScript client library for the **ProCon.IP** pool controller.
It wraps the controller's small HTTP surface (`/GetState.csv`, `/usrcfg.cgi`,
`/Command.htm`, `/SetState.pl`, `/GetDmx.csv`) in typed services with a clean
error model and a read-mutate-write idiom for DMX512.

Feel free to ask questions on
[GitHub Issues](https://github.com/ylabonte/procon-ip/issues) — discussions
there are searchable for everyone with a similar question.

## Installation

Requires **Node 22 LTS or newer**.

```bash
pnpm add procon-ip
# or
npm install procon-ip
# or
yarn add procon-ip
```

The package ships dual ESM + CJS via the `exports` map — both
`import { GetStateService } from 'procon-ip'` and
`const { GetStateService } = require('procon-ip')` work.

## Examples

The runnable forms of the snippets below live under
[`examples/`](./examples).

### Requesting data

```ts
import { GetStateService, GetStateCategory, Logger } from 'procon-ip';

const logger = new Logger();
const config = {
  controllerUrl: 'http://192.168.2.3', // <-- your pool controller's address
  basicAuth: true,
  username: 'admin',
  password: 'admin',
  updateInterval: 5000,
  timeout: 5000,
  errorTolerance: 2,
};

const dataSource = new GetStateService(config, logger);

// One-shot fetch:
const data = await dataSource.update();
logger.info(`Uptime: ${data.sysInfo.uptime}`);

// Or poll continuously:
dataSource.start((data) => {
  for (const obj of data.getDataObjectsByCategory(GetStateCategory.ELECTRODES)) {
    logger.info(`${obj.label}: ${obj.displayValue}`);
  }
});
```

### Switching relays

```ts
import {
  GetStateService,
  UsrcfgCgiService,
  RelayDataInterpreter,
  GetStateCategory,
  Logger,
} from 'procon-ip';

const logger = new Logger();
const config = {
  controllerUrl: 'http://192.168.2.3',
  basicAuth: true,
  username: 'admin',
  password: 'admin',
  timeout: 5000,
  updateInterval: 5000,
  errorTolerance: 2,
};

const dataSource = new GetStateService(config, logger);
const interpreter = new RelayDataInterpreter(logger);
const relays = new UsrcfgCgiService(config, logger, dataSource, interpreter);

await dataSource.update();

// Switch a known dosage relay off:
await relays.setOff(dataSource.data.getChlorineDosageControl());

// Or hand a relay back to the controller's automatic schedule by label:
for (const relay of dataSource.data.getDataObjectsByCategory(GetStateCategory.RELAYS)) {
  if (relay.label === 'Gartenlicht') await relays.setAuto(relay);
}
```

`setOn` / `setOff` / `setAuto` return `Promise<void>` in v2 — failures throw
the typed error classes from `'procon-ip'` instead of returning a numeric
response code (see [Error handling](#error-handling)).

### Manual dosage

```ts
import { CommandService, Logger } from 'procon-ip';

const svc = new CommandService(
  { controllerUrl: 'http://192.168.2.3', basicAuth: false, timeout: 5000 },
  new Logger(),
);

const seconds = await svc.setChlorineDosage(60); // dose for 60s
// `seconds` === 60 on success, -1 after three retries.
```

### DMX512

```ts
import { GetDmxService, DmxService, Logger } from 'procon-ip';

const logger = new Logger();
const config = { controllerUrl: 'http://192.168.2.3', basicAuth: false, timeout: 5000 };

const reader = new GetDmxService(config, logger);
const writer = new DmxService(config, logger);

const dmx = await reader.update();
for (const ch of dmx) dmx.set(ch.index, (ch.value + 64) % 256); // shift each channel
await writer.set(dmx);
```

`GetDmxData` is iterable, indexable via `at(index)`, mutable via
`set(index, value)` (clamps to `[0, 255]`), and produces the controller's
form payload via `toPostData()`. The controller only accepts full 16-channel
writes, so `DmxService.set` always sends every channel.

## Error handling

All HTTP calls throw typed errors from `'procon-ip'`:

```ts
import {
  BadCredentialsError,
  BadStatusCodeError,
  RequestTimeoutError,
  InvalidPayloadError,
  ProconIpError,
} from 'procon-ip';

try {
  await getStateService.update();
} catch (e) {
  if (e instanceof BadCredentialsError) console.error('check basicAuth');
  else if (e instanceof RequestTimeoutError) console.error(`timeout: ${e.timeoutMs}ms`);
  else if (e instanceof BadStatusCodeError) console.error(`HTTP ${e.status}`);
  else throw e;
}
```

Network-level failures (DNS, connection refused, etc.) propagate as native
`TypeError` from `fetch`.

## Full API docs

Auto-generated TypeDoc reference, deployed on every push to master:
<https://ylabonte.github.io/procon-ip/>.

## A brief description of the ProCon.IP pool controller

The ProCon.IP pool controller is a low-budget network-attached control unit
for home swimming pools. With its software-switched relays it can drive
multiple pumps (filter and dosage) either on a time schedule or based on
sensor readings (i/o flow sensors, Dallas 1-Wire thermometers, redox / pH
electrodes), and it can also switch arbitrary relays on demand for things
like garden lighting. Its DMX512 extension drives 16 channels of lighting
or other DMX-compatible gear.

Not all of its functionality is reachable via the documented HTTP API, so
this library reverse-engineers the parts the web UI uses (`/usrcfg.cgi` for
relay + DMX writes, `/Command.htm` for manual dosage, `/SetState.pl` for
relay timers).

For more information (German only):

* [pooldigital.de webshop](https://pooldigital.de/poolsteuerungen/procon.ip/35/procon.ip-webbasierte-poolsteuerung-/-dosieranlage)
* [pooldigital.de forum](https://www.poolsteuerung.de/)

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).

## Disclaimer

I have nothing to do with the development, sales, marketing, or support of
the pool controller unit itself. This is a community library that originated
from my own [ioBroker integration](https://github.com/ylabonte/ioBroker.procon-ip),
later split out for reuse.
