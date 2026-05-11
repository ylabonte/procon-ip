# procon-ip

TypeScript client library for the **ProCon.IP** pool controller.
This site is the auto-generated API reference. For installation, examples,
and the changelog, see the project on GitHub.

## Quick links

- [GitHub repository](https://github.com/ylabonte/procon-ip)
- [Issue tracker](https://github.com/ylabonte/procon-ip/issues)
- [Changelog](https://github.com/ylabonte/procon-ip/blob/master/CHANGELOG.md)
- [npm package](https://www.npmjs.com/package/procon-ip)

## What's in this reference

The library exposes a small surface around the controller's HTTP endpoints:

- **State polling** — `GetStateService` reads `/GetState.csv`, `GetStateData`
  parses it, `RelayDataInterpreter` handles the bit-encoded relay state.
- **Relay control** — `UsrcfgCgiService` switches relays via `/usrcfg.cgi`.
- **Manual dosage** — `CommandService` triggers chlorine / pH± dosage timers.
- **Relay timers** — `SetStateService` turns a relay on for a duration.
- **DMX512** — `GetDmxService` + `DmxService` + `GetDmxData` for the 16-channel
  DMX state on `/GetDmx.csv` + `/usrcfg.cgi`.
- **Errors** — typed exception classes (`BadCredentialsError`,
  `BadStatusCodeError`, `RequestTimeoutError`, `InvalidPayloadError`,
  base `ProconIpError`).

Use the sidebar to browse classes, interfaces, and enums.
