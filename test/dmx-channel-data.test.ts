import { describe, it, expect } from 'vitest';
import { DmxChannelData } from '../src/dmx-channel-data';

describe('DmxChannelData', () => {
  it('formats name as CH01..CH16', () => {
    expect(new DmxChannelData(0, 0).name).toBe('CH01');
    expect(new DmxChannelData(15, 0).name).toBe('CH16');
  });
  it('exposes index', () => {
    expect(new DmxChannelData(7, 0).index).toBe(7);
  });
  it('stores value verbatim (no clamping in constructor)', () => {
    expect(new DmxChannelData(0, 999).value).toBe(999);
    expect(new DmxChannelData(0, -5).value).toBe(-5);
  });
  it('toString returns the bare integer', () => {
    expect(String(new DmxChannelData(0, 128))).toBe('128');
  });
});
