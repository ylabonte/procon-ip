import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GetStateData, GetStateCategory } from '../src/get-state-data';
import { GetStateDataObject } from '../src/get-state-data-object';
import { GetStateDataSysInfo } from '../src/get-state-data-sys-info';
import { RelayDataObject } from '../src/relay-data-object';
import { InvalidPayloadError } from '../src/errors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(resolve(__dirname, 'fixtures/get-state.csv'), 'utf8');

describe('GetStateData', () => {
  it('default constructor produces empty state without throwing', () => {
    const d = new GetStateData();
    expect(d.raw).toBe('');
    expect(d.objects).toEqual([]);
    expect(d.active).toEqual([]);
    expect(d.sysInfo).toBeInstanceOf(GetStateDataSysInfo);
  });

  it('parses the fixture into objects and sysInfo', () => {
    const d = new GetStateData(fixture);
    expect(d.raw).toBe(fixture);
    expect(d.parsed.length).toBeGreaterThan(0);
    expect(d.sysInfo.version).toBe('1.7.0');
    expect(d.objects.length).toBeGreaterThan(0);
  });

  it('categories getter mirrors the static categories', () => {
    const d = new GetStateData(fixture);
    expect(d.categories).toBe(GetStateData.categories);
  });

  it('getCategory returns the category name for a known column', () => {
    const d = new GetStateData(fixture);
    expect(d.getCategory(0)).toBe('time');
  });

  it('getCategory returns "none" for unknown columns', () => {
    const d = new GetStateData(fixture);
    expect(d.getCategory(9999)).toBe('none');
  });

  it('getDataObjects returns the listed indices', () => {
    const d = new GetStateData(fixture);
    const objs = d.getDataObjects([0, 1, 2]);
    expect(objs).toHaveLength(3);
    expect(objs[0]).toBeInstanceOf(GetStateDataObject);
  });

  it('getDataObjects with activeOnly filters to active columns', () => {
    const d = new GetStateData(fixture);
    const all = d.getDataObjects([0, 1, 2, 3, 4]);
    const active = d.getDataObjects([0, 1, 2, 3, 4], true);
    expect(active.length).toBeLessThanOrEqual(all.length);
    for (const o of active) expect(o.active).toBe(true);
  });

  it('getDataObject returns the parsed object for a known id', () => {
    const d = new GetStateData(fixture);
    expect(d.getDataObject(0)).toBeInstanceOf(GetStateDataObject);
  });

  it('getDataObject returns an empty placeholder for unknown ids', () => {
    const d = new GetStateData(fixture);
    const o = d.getDataObject(9999);
    expect(o).toBeInstanceOf(GetStateDataObject);
    expect(o.id).toBe(9999);
    expect(o.label).toBe('');
  });

  it('getDataObjectsByCategory returns array for every known category', () => {
    const d = new GetStateData(fixture);
    for (const cat of Object.values(GetStateCategory)) {
      expect(Array.isArray(d.getDataObjectsByCategory(cat))).toBe(true);
    }
  });

  it('dosage-control id getters mirror sysInfo', () => {
    const d = new GetStateData(fixture);
    expect(d.getChlorineDosageControlId()).toBe(d.sysInfo.chlorineDosageRelay);
    expect(d.getPhMinusDosageControlId()).toBe(d.sysInfo.phMinusDosageRelay);
    expect(d.getPhPlusDosageControlId()).toBe(d.sysInfo.phPlusDosageRelay);
  });

  it('dosage-control object getters return RelayDataObject instances', () => {
    const d = new GetStateData(fixture);
    expect(d.getChlorineDosageControl()).toBeInstanceOf(RelayDataObject);
    expect(d.getPhMinusDosageControl()).toBeInstanceOf(RelayDataObject);
    expect(d.getPhPlusDosageControl()).toBeInstanceOf(RelayDataObject);
  });

  it('isDosageControl identifies dosage-relay ids', () => {
    const d = new GetStateData(fixture);
    expect(d.isDosageControl(d.getChlorineDosageControlId())).toBe(true);
    expect(d.isDosageControl(d.getPhMinusDosageControlId())).toBe(true);
    expect(d.isDosageControl(d.getPhPlusDosageControlId())).toBe(true);
    expect(d.isDosageControl(9999)).toBe(false);
  });

  it('parseCsv on a populated instance updates existing objects in place', () => {
    const d = new GetStateData(fixture);
    const objectCountBefore = d.objects.length;
    d.parseCsv(fixture);
    // Re-parsing should not add new object slots — it should re-set existing ones.
    expect(d.objects.length).toBe(objectCountBefore);
  });

  it('throws InvalidPayloadError on a truncated CSV (missing rows)', () => {
    // SYSINFO row only -- no names / units / offsets / gains / measures.
    // Silently leaving the previous `objects` array intact would let
    // consumers read stale values while raw/parsed already reflect the
    // new bad payload. Make it loud instead.
    expect(() => new GetStateData('SYSINFO,1.7.0,17132,1,65536,99,257,4,4,5')).toThrow(InvalidPayloadError);
  });

  it('clears objects on a re-parse failure so callers cannot observe stale state', () => {
    const d = new GetStateData(fixture);
    expect(d.objects.length).toBeGreaterThan(0);
    expect(() => d.parseCsv('SYSINFO,1.7.0,17132,1,65536,99,257,4,4,5')).toThrow(InvalidPayloadError);
    expect(d.objects.length).toBe(0);
  });
});
