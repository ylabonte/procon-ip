import { DmxChannelData } from './dmx-channel-data';
import { InvalidPayloadError } from './errors';

/** Parsed and mutable representation of all 16 DMX512 channels. */
export class GetDmxData implements Iterable<DmxChannelData> {
  /** Original CSV body the instance was parsed from. */
  readonly raw: string;
  private readonly _channels: DmxChannelData[];

  /**
   * Parse a `/GetDmx.csv` body into 16 channels.
   *
   * @throws {@link InvalidPayloadError} if the payload is empty or doesn't contain
   *  exactly 16 comma-separated channel values.
   */
  constructor(raw: string) {
    this.raw = raw;
    const line = raw.split(/\r?\n/).find((l) => l.trim().length > 0);
    if (!line) throw new InvalidPayloadError('Empty or missing DMX payload');
    const values = line.split(',');
    if (values.length !== 16) {
      throw new InvalidPayloadError(`GetDmx.csv must contain exactly 16 channels; got ${values.length}`);
    }
    this._channels = values.map((v, i) => new DmxChannelData(i, Number.parseInt(v, 10)));
  }

  [Symbol.iterator](): Iterator<DmxChannelData> {
    return this._channels[Symbol.iterator]();
  }

  /** Return the channel at the given zero-based index. Throws `RangeError` outside `[0, 15]`. */
  at(index: number): DmxChannelData {
    const ch = this._channels[index];
    if (!ch) throw new RangeError('DMX index must be in [0, 15]');
    return ch;
  }

  /** Read the current value at `index`. */
  getValue(index: number): number {
    return this.at(index).value;
  }

  /** Update channel `index` to `value`, clamping to `[0, 255]`. */
  set(index: number, value: number): void {
    const ch = this.at(index);
    ch.value = Math.max(0, Math.min(255, value));
  }

  /** Form payload accepted by `/usrcfg.cgi` for a DMX512 update. */
  toPostData(): Record<string, string> {
    return {
      TYPE: '0',
      LEN: '16',
      CH1_8: this._channels
        .slice(0, 8)
        .map((c) => c.value)
        .join(','),
      CH9_16: this._channels
        .slice(8)
        .map((c) => c.value)
        .join(','),
      DMX512: '1',
    };
  }
}
