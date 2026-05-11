import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GetDmxData } from '../src/get-dmx-data';
import { DmxChannelData } from '../src/dmx-channel-data';
import { InvalidPayloadError } from '../src/errors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(resolve(__dirname, 'fixtures/get-dmx.csv'), 'utf8');

describe('GetDmxData', () => {
  it('parses 16 channels from CSV', () => {
    const data = new GetDmxData(fixture);
    expect([...data]).toHaveLength(16);
    expect(data.at(0)).toBeInstanceOf(DmxChannelData);
    expect(data.getValue(15)).toBe(255);
  });

  it('throws InvalidPayloadError on empty input', () => {
    expect(() => new GetDmxData('')).toThrow(InvalidPayloadError);
    expect(() => new GetDmxData('\n\n')).toThrow(InvalidPayloadError);
  });

  it('throws InvalidPayloadError on wrong channel count', () => {
    expect(() => new GetDmxData('1,2,3')).toThrow(InvalidPayloadError);
  });

  it('throws InvalidPayloadError when a channel value is not a valid integer', () => {
    // 16 values, one of them non-numeric -> reject rather than silently
    // storing NaN and later POSTing it back to the controller.
    const bad = '0,16,32,48,oops,80,96,112,128,144,160,176,192,208,224,255';
    expect(() => new GetDmxData(bad)).toThrow(InvalidPayloadError);
  });

  it('clamps set() values to [0, 255]', () => {
    const data = new GetDmxData(fixture);
    data.set(0, -10);
    expect(data.getValue(0)).toBe(0);
    data.set(0, 999);
    expect(data.getValue(0)).toBe(255);
  });

  it('set() throws RangeError on bad index', () => {
    const data = new GetDmxData(fixture);
    expect(() => data.set(-1, 0)).toThrow(RangeError);
    expect(() => data.set(16, 0)).toThrow(RangeError);
  });

  it('toPostData returns the controller-shape form payload', () => {
    const data = new GetDmxData(fixture);
    const post = data.toPostData();
    expect(post.TYPE).toBe('0');
    expect(post.LEN).toBe('16');
    expect(post.DMX512).toBe('1');
    expect(post.CH1_8).toBe('0,16,32,48,64,80,96,112');
    expect(post.CH9_16).toBe('128,144,160,176,192,208,224,255');
  });
});
