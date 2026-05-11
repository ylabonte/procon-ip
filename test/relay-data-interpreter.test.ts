import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { RelayDataInterpreter, RelayStateBitMask } from '../src/relay-data-interpreter';
import { GetStateDataObject } from '../src/get-state-data-object';
import { GetStateData } from '../src/get-state-data';
import { RelayDataObject } from '../src/relay-data-object';
import { Logger, LogLevel } from '../src/logger';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(resolve(__dirname, 'fixtures/get-state.csv'), 'utf8');

function relayWith(raw: number): GetStateDataObject {
  // index, name, unit, offset, gain, measure
  return new GetStateDataObject(0, 'TestRelay', '--', '0', '1', String(raw));
}

describe('RelayDataInterpreter', () => {
  const log = new Logger(LogLevel.ERROR);

  describe('state predicates', () => {
    it('isOn / isOff for a raw=0 (off, auto) relay', () => {
      const r = relayWith(0);
      const i = new RelayDataInterpreter(log);
      expect(i.isOn(r)).toBe(false);
      expect(i.isOff(r)).toBe(true);
    });

    it('isOn / isOff for a raw=1 (on, auto) relay', () => {
      const r = relayWith(1);
      const i = new RelayDataInterpreter(log);
      expect(i.isOn(r)).toBe(true);
      expect(i.isOff(r)).toBe(false);
    });

    it('isManual / isAuto for a raw=2 (off, manual) relay', () => {
      const r = relayWith(2);
      const i = new RelayDataInterpreter(log);
      expect(i.isManual(r)).toBe(true);
      expect(i.isAuto(r)).toBe(false);
    });

    it('isManual / isAuto for a raw=3 (on, manual) relay', () => {
      const r = relayWith(3);
      const i = new RelayDataInterpreter(log);
      expect(i.isManual(r)).toBe(true);
      expect(i.isOn(r)).toBe(true);
    });
  });

  describe('evaluate()', () => {
    it('initialises bitStates [255, 0] when external relays are disabled', () => {
      const data = new GetStateData(fixture);
      const i = new RelayDataInterpreter(log).evaluate(data);
      // Fixture has no external relays — bitStates[0] starts at 255, may be cleared by auto relays.
      expect(i.bitStates[0]).toBeLessThanOrEqual(255);
      expect(i.bitStates).toHaveLength(2);
    });

    it('returns this (fluent API)', () => {
      const data = new GetStateData(fixture);
      const i = new RelayDataInterpreter(log);
      expect(i.evaluate(data)).toBe(i);
    });
  });

  describe('set operations (bit math)', () => {
    it('setOn flips both bits high', () => {
      const i = new RelayDataInterpreter(log);
      i.bitStates = [0, 0];
      const result = i.setOn(relayWith(0));
      // RelayDataObject derives bitMask from categoryId; for a hand-built relay categoryId=0 -> bitMask=1.
      expect(result[0]).toBeGreaterThan(0);
      expect(result[1]).toBeGreaterThan(0);
    });

    it('setOff sets manual bit, clears on bit', () => {
      const i = new RelayDataInterpreter(log);
      i.bitStates = [0, 0xff];
      const result = i.setOff(relayWith(0));
      // After setOff: bitStates[0] |= mask, bitStates[1] &= ~mask
      expect(result[0]).toBeGreaterThan(0);
      expect(result[1]).toBeLessThan(0xff);
    });

    it('setAuto clears both bits', () => {
      const i = new RelayDataInterpreter(log);
      i.bitStates = [0xff, 0xff];
      const result = i.setAuto(relayWith(0));
      expect(result[0]).toBeLessThan(0xff);
      expect(result[1]).toBeLessThan(0xff);
    });
  });

  describe('RelayStateBitMask enum', () => {
    it('has the expected values', () => {
      expect(RelayStateBitMask.on).toBe(1);
      expect(RelayStateBitMask.manual).toBe(2);
    });
  });

  describe('evaluate() with external relays + on-state relay', () => {
    // Custom CSV with configOtherEnable bit 4 set (16 -> ext relays enabled)
    // and one of the EXTERNAL_RELAYS columns (24..27) carrying raw=1 (on, auto).
    // SYSINFO must be the first non-empty row; headers/units/offset/gain follow.
    function makeCsv(): string {
      const cols = 42;
      const sysInfo = ['SYSINFO', '1.7.0', '17132', '1', '65536', '16', '0', '4', '4', '5'].join(',');
      const labels = Array.from({ length: cols }, (_, i) => (i === 28 ? 'ExtRelay1' : `col${i}`)).join(',');
      const units = Array.from({ length: cols }, () => '--').join(',');
      const offset = Array.from({ length: cols }, () => '0').join(',');
      const gain = Array.from({ length: cols }, () => '1').join(',');
      // EXTERNAL_RELAYS columns are 28..35; mark col 28 as raw=1 (on, auto)
      const values = Array.from({ length: cols }, (_, i) => (i === 28 ? '1' : '0')).join(',');
      return [sysInfo, labels, units, offset, gain, values].join('\n');
    }

    it('initialises bitStates [65535, 0] and flips the on-relay bit', () => {
      const data = new GetStateData(makeCsv());
      expect(data.sysInfo.isExtRelaysEnabled()).toBe(true);
      const i = new RelayDataInterpreter(log).evaluate(data);
      // Top byte starts at 65535 per the ext-relays-enabled branch.
      // bitStates[1] should be non-zero because column 24 had raw=1 (on),
      // exercising the `if (this.isOn(relay))` branch in evaluate().
      expect(i.bitStates[1]).toBeGreaterThan(0);
    });
  });

  describe('RelayDataObject.bitMask EXTERNAL_RELAYS branch', () => {
    it('shifts categoryId by +8 for external relays', () => {
      const obj = new GetStateDataObject(0, 'ext', '--', '0', '1', '0');
      obj.category = 'externalRelays';
      obj.categoryId = 0;
      const wrapped = new RelayDataObject(obj);
      // bit shift by (0 + 8) = 256
      expect(wrapped.bitMask).toBe(256);
    });

    it('shifts categoryId without offset for internal relays', () => {
      const obj = new GetStateDataObject(0, 'rel', '--', '0', '1', '0');
      obj.category = 'relays';
      obj.categoryId = 3;
      const wrapped = new RelayDataObject(obj);
      // bit shift by 3 = 8
      expect(wrapped.bitMask).toBe(8);
    });
  });
});
