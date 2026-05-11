/** A single DMX512 channel value. */
export class DmxChannelData {
  /** Zero-based channel index (0 = channel 1). */
  readonly index: number;
  /** Human-friendly channel name (`"CH01"` … `"CH16"`). */
  readonly name: string;
  /** Channel intensity. Expected range `[0, 255]`. Clamping happens in {@link GetDmxData.set}. */
  value: number;

  constructor(index: number, value: number) {
    this.index = index;
    this.value = value;
    this.name = `CH${String(index + 1).padStart(2, '0')}`;
  }

  toString(): string {
    return String(this.value);
  }
}
