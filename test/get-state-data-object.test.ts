import { describe, it, expect } from 'vitest';
import { GetStateDataObject } from '../src/get-state-data-object';

describe('GetStateDataObject', () => {
  it('parses raw inputs and computes value = offset + gain * raw', () => {
    const o = new GetStateDataObject(3, 'sensor', 'C', '0.5', '2', '10');
    expect(o.id).toBe(3);
    expect(o.label).toBe('sensor');
    expect(o.unit).toBe('C');
    expect(o.offset).toBe(0.5);
    expect(o.gain).toBe(2);
    expect(o.raw).toBe(10);
    expect(o.value).toBe(20.5);
    expect(o.active).toBe(true);
  });

  it('marks `n.a.` columns as inactive', () => {
    const o = new GetStateDataObject(0, 'n.a.', '--', '0', '1', '0');
    expect(o.active).toBe(false);
  });

  it('formats a Celsius display value with two decimals', () => {
    const o = new GetStateDataObject(0, 'temp', 'C', '0', '1', '21');
    expect(o.displayValue).toBe('21.00 °C');
  });

  it('formats a Fahrenheit display value with two decimals', () => {
    const o = new GetStateDataObject(0, 'temp', 'F', '0', '1', '70');
    expect(o.displayValue).toBe('70.00 °F');
  });

  it('formats an `h` unit value as packed hours:minutes', () => {
    // value = 0x010A = 256 + 10  -> "01:10"
    const o = new GetStateDataObject(0, 'uptime', 'h', '0', '1', String(0x010a));
    expect(o.displayValue).toBe('01:10');
  });

  it('formats an h-unit value with both halves >= 10', () => {
    // value = 0x1234 = 18*256 + 52 -> "18:52"
    const o = new GetStateDataObject(0, 'uptime', 'h', '0', '1', String(0x1234));
    expect(o.displayValue).toBe('18:52');
  });

  it('formats a `--` unit value as the bare number', () => {
    const o = new GetStateDataObject(0, 'relay', '--', '0', '1', '7');
    expect(o.displayValue).toBe('7');
  });

  it('formats unknown units with the unit suffix and two decimals', () => {
    const o = new GetStateDataObject(0, 'pressure', 'Bar', '0', '1', '3');
    expect(o.displayValue).toBe('3.00 Bar');
  });

  it('forFields invokes the callback for every key on the instance', () => {
    const o = new GetStateDataObject(0, 'x', '--', '0', '1', '0');
    const seen: string[] = [];
    o.forFields((f) => seen.push(f));
    // Must include the documented public fields.
    expect(seen).toEqual(expect.arrayContaining(['id', 'label', 'raw', 'offset', 'gain', 'value']));
  });
});
