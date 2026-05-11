import { describe, it, expect } from 'vitest';
import { GetStateDataSysInfo } from '../src/get-state-data-sys-info';
import { GetStateDataObject } from '../src/get-state-data-object';

/**
 * Build a 2D-array shape that GetStateDataSysInfo accepts.
 * Field order matches setValuesFromArray:
 * data[0] = [time, version, uptime, resetRootCause, ntpFaultState,
 *            configOtherEnable, dosageControl,
 *            phPlusDosageRelay, phMinusDosageRelay, chlorineDosageRelay]
 */
function sysInfoFrom(opts: {
  configOther?: number;
  dosage?: number;
  phPlus?: number;
  phMinus?: number;
  chlorine?: number;
}): GetStateDataSysInfo {
  return new GetStateDataSysInfo([
    [
      'SYSINFO',
      '1.7.0',
      '17132',
      '1',
      '65536',
      String(opts.configOther ?? 0),
      String(opts.dosage ?? 0),
      String(opts.phPlus ?? 38),
      String(opts.phMinus ?? 37),
      String(opts.chlorine ?? 36),
    ],
  ]);
}

function relay(id: number): GetStateDataObject {
  return new GetStateDataObject(id, 'relay', '--', '0', '1', '0');
}

describe('GetStateDataSysInfo', () => {
  it('default constructor produces an empty instance without throwing', () => {
    const s = new GetStateDataSysInfo();
    expect(s).toBeInstanceOf(GetStateDataSysInfo);
  });

  it('parses scalar fields out of the SYSINFO row', () => {
    const s = sysInfoFrom({ dosage: 4097 });
    expect(s.version).toBe('1.7.0');
    expect(s.uptime).toBe(17132);
    expect(s.resetRootCause).toBe(1);
    expect(s.ntpFaultState).toBe(65536);
    expect(s.dosageControl).toBe(4097);
  });

  describe('dosage flags', () => {
    it('isChlorineDosageEnabled = bit 0', () => {
      expect(sysInfoFrom({ dosage: 1 }).isChlorineDosageEnabled()).toBe(true);
      expect(sysInfoFrom({ dosage: 0 }).isChlorineDosageEnabled()).toBe(false);
    });
    it('isElectrolysis = bit 4 (mask 16)', () => {
      expect(sysInfoFrom({ dosage: 16 }).isElectrolysis()).toBe(true);
      expect(sysInfoFrom({ dosage: 0 }).isElectrolysis()).toBe(false);
    });
    it('isPhMinusDosageEnabled = bit 8 (mask 256)', () => {
      expect(sysInfoFrom({ dosage: 256 }).isPhMinusDosageEnabled()).toBe(true);
      expect(sysInfoFrom({ dosage: 0 }).isPhMinusDosageEnabled()).toBe(false);
    });
    it('isPhPlusDosageEnabled = bit 12 (mask 4096)', () => {
      expect(sysInfoFrom({ dosage: 4096 }).isPhPlusDosageEnabled()).toBe(true);
      expect(sysInfoFrom({ dosage: 0 }).isPhPlusDosageEnabled()).toBe(false);
    });
  });

  describe('configOtherEnable flags', () => {
    it('isAvatarEnabled = bit 3 (mask 8)', () => {
      expect(sysInfoFrom({ configOther: 8 }).isAvatarEnabled()).toBe(true);
      expect(sysInfoFrom({ configOther: 0 }).isAvatarEnabled()).toBe(false);
    });
    it('isExtRelaysEnabled = bit 4 (mask 16)', () => {
      expect(sysInfoFrom({ configOther: 16 }).isExtRelaysEnabled()).toBe(true);
      expect(sysInfoFrom({ configOther: 0 }).isExtRelaysEnabled()).toBe(false);
    });
    it('isFlowSensorEnabled = bit 6 (mask 64)', () => {
      expect(sysInfoFrom({ configOther: 64 }).isFlowSensorEnabled()).toBe(true);
      expect(sysInfoFrom({ configOther: 0 }).isFlowSensorEnabled()).toBe(false);
    });
    it('isDmxEnabled = bit 8 (mask 256)', () => {
      expect(sysInfoFrom({ configOther: 256 }).isDmxEnabled()).toBe(true);
      expect(sysInfoFrom({ configOther: 0 }).isDmxEnabled()).toBe(false);
    });
  });

  describe('isDosageEnabled', () => {
    it('returns chlorine flag for ids 36 and 39', () => {
      const s = sysInfoFrom({ dosage: 1 });
      expect(s.isDosageEnabled(relay(36))).toBe(true);
      expect(s.isDosageEnabled(relay(39))).toBe(true);
    });
    it('returns pH- flag for ids 37 and 40', () => {
      const s = sysInfoFrom({ dosage: 256 });
      expect(s.isDosageEnabled(relay(37))).toBe(true);
      expect(s.isDosageEnabled(relay(40))).toBe(true);
    });
    it('returns pH+ flag for ids 38 and 41', () => {
      const s = sysInfoFrom({ dosage: 4096 });
      expect(s.isDosageEnabled(relay(38))).toBe(true);
      expect(s.isDosageEnabled(relay(41))).toBe(true);
    });
    it('returns false for non-dosage relay ids', () => {
      const s = sysInfoFrom({ dosage: 0xffff });
      expect(s.isDosageEnabled(relay(0))).toBe(false);
    });
  });

  describe('getDosageRelay', () => {
    it('maps ids 36/39 to chlorineDosageRelay', () => {
      const s = sysInfoFrom({ chlorine: 7 });
      expect(s.getDosageRelay(relay(36))).toBe(7);
      expect(s.getDosageRelay(relay(39))).toBe(7);
    });
    it('maps ids 37/40 to phMinusDosageRelay', () => {
      const s = sysInfoFrom({ phMinus: 11 });
      expect(s.getDosageRelay(relay(37))).toBe(11);
      expect(s.getDosageRelay(relay(40))).toBe(11);
    });
    it('maps ids 38/41 to phPlusDosageRelay', () => {
      const s = sysInfoFrom({ phPlus: 13 });
      expect(s.getDosageRelay(relay(38))).toBe(13);
      expect(s.getDosageRelay(relay(41))).toBe(13);
    });
    it('returns 0 for non-dosage relay ids', () => {
      expect(sysInfoFrom({}).getDosageRelay(relay(0))).toBe(0);
    });
  });

  it('toArrayOfObjects flattens own keys to {key, value} pairs', () => {
    const s = sysInfoFrom({ dosage: 4097 });
    const arr = s.toArrayOfObjects();
    const keys = arr.map((e) => e.key);
    expect(keys).toEqual(
      expect.arrayContaining(['version', 'uptime', 'dosageControl', 'phPlusDosageRelay']),
    );
    const dosage = arr.find((e) => e.key === 'dosageControl');
    expect(dosage?.value).toBe('4097');
  });
});
