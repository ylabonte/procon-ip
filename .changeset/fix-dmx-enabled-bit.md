---
'procon-ip': patch
---

Fix `GetStateDataSysInfo.isDmxEnabled()`: DMX512 output is bit 2 (mask 4) of `configOtherEnable`, not bit 8 (mask 256). Verified against a real ProCon.IP (`configOtherEnable` reads 0 with DMX off and 4 with DMX on). The old mask reported the separate SPI/DMX *extension* flag, now exposed as the new `isDmxExtensionEnabled()`. This matches the proconip-pypi / Home Assistant behaviour.
