/**
 * The [[`GetStateDataObject`]] class is part of the [[`GetStateData`]]
 * class, which is kind of an object representation of the `/GetState.csv`
 * API endpoint response of the ProCon.IP pool controller.
 * @packageDocumentation
 */

/**
 * An object representation of a single CSV response column _(ignoring the first
 * row of the raw input!)_.
 */
export class GetStateDataObject {
  /**
   * Making [[`GetStateDataObject`]] objects extensible, also allows accessing
   * object keys using string variables.
   */
  [key: string]: any; // eslint-disable-line no-undef

  /**
   * Object id aka column index.
   */
  public id!: number;

  /**
   * Object label.
   */
  public label!: string;

  /**
   * Raw object input value.
   */
  public raw!: number;

  /**
   * Object value offset.
   */
  public offset!: number;

  /**
   * Object value gain.
   */
  public gain!: number;

  /**
   * Plain (calculated) object value.
   */
  public value!: string | number;

  /**
   * Object display value.
   */
  public displayValue!: string;

  /**
   * Object unit.
   */
  public unit!: string;

  /**
   * Object instance category string.
   */
  public category!: string;

  /**
   * Sub-index for each category.
   *
   * Starts counting from `0` at the first object of the instances category.
   * Used to determine e.g. the relay IDs.
   */
  public categoryId!: number;

  /**
   * Indicates whether the object is considered to be active.
   *
   * Indeed this only means the name is not '_n.a._'.
   */
  public active!: boolean;

  /**
   * Passthru all parameters to [[`GetStateDataObject.set`]].
   *
   * @param index Column id/index
   * @param name Column or data portion name
   * @param unit Column or data portion unit (if applicable in any way)
   * @param offset Column value offset
   * @param gain Column value gain
   * @param measure Column value raw measurement
   */
  public constructor(index: number, name: string, unit: string, offset: string, gain: string, measure: string) {
    this.set(index, name, unit, offset, gain, measure);
  }

  /**
   * Set object values based on the raw input values.
   *
   * The input values correspond to the data rows of the represented column
   * (except the `index` paramter which indeed is the column id/index itself).
   *
   * @param index Column id/index
   * @param name Column or data portion name
   * @param unit Column or data portion unit (if applicable in any way)
   * @param offset Column value offset
   * @param gain Column value gain
   * @param measure Column value raw measurement
   */
  public set(index: number, name: string, unit: string, offset: string, gain: string, measure: string): void {
    // Set basic object values.
    this.id = index;
    this.label = name;
    this.displayValue = '';
    this.unit = unit;
    this.offset = Number(offset);
    this.gain = Number(gain);
    this.raw = Number(measure);
    this.value = this.offset + this.gain * this.raw;
    this.category = this.category === undefined ? 'none' : this.category;
    this.categoryId = this.categoryId === undefined ? 0 : this.categoryId;
    this.active = name !== 'n.a.'; // Mark object as active if it is not labeled with 'n.a.'.

    // Set display value according to the object unit.
    switch (this.unit) {
      case 'C':
      case 'F':
        this.displayValue = `${Number(this.value).toFixed(2)} °${this.unit}`;
        break;
      case 'h':
        /* tslint:disable: no-bitwise */
        this.displayValue =
          (Number(this.value) >> 8 < 10 ? 0 : '') +
          '' +
          (Number(this.value) >> 8) +
          ':' +
          ((Number(this.value) & 0xff) < 10 ? 0 : '') +
          '' +
          (Number(this.value) & 0xff);
        /* tslint:enable: no-bitwise */
        break;
      // case "pH":
      //     this.displayValue = `${this.unit} ${this.value}`;
      //     break;
      case '--':
        this.displayValue = String(this.value);
        break;
      default:
        this.displayValue = `${Number(this.value).toFixed(2)} ${this.unit}`;
    }
  }

  /**
   * Iterate all fields of this object.
   *
   * @param callback A user-defined callback.
   */
  public forFields(callback: (field: string) => any): void {
    Object.keys(this).forEach(callback);
  }
}
