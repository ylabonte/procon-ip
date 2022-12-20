/**
 * An derived class of {@link RelayDataObject} for relays.
 * @packageDocumentation
 */

import { GetStateDataObject } from './get-state-data-object';
import { GetStateCategory } from './get-state-data';

/**
 * The {@link RelayDataObject} extends the {@link GetStateDataObject} by an
 * additional magic {@link bitMask} attribute, that determines the correct bitmask
 * to toggle the relay's state.
 */
export class RelayDataObject extends GetStateDataObject {
  /**
   * Initialize a new {@link RelayDataObject} from a given {@link GetStateDataObject}.
   *
   * @param data Just
   */
  public constructor(data: GetStateDataObject) {
    super(data.id, data.label, data.unit, data.offset.toString(), data.gain.toString(), data.raw.toString());
    Object.keys(data).forEach((key) => {
      this[key] = data[key];
    });
  }

  /**
   * Returns the bit mask for toggling the relay's state using the `/usrcfg.cgi`
   * endpoint (see: {@link UsrcfgCgiService}).
   *
   * The service endpoint expects two input values, one defining on/off states
   * and another one for the auto-mode on/off. Both values are simple bit
   * patterns, where every relay has one bit according to its {@link categoryId},
   * which sets its individual state.
   *
   * Ultimately this means, you have to consider the current on/off and auto
   * state of every single relay to determine the values you need to change a
   * single relays state. This is, where the {@link RelayDataInterpreter} comes
   * in.
   */
  public get bitMask(): number {
    /* tslint:disable: no-bitwise */
    return (
      0x01 <<
      ((this.category as GetStateCategory) === GetStateCategory.EXTERNAL_RELAYS ? this.categoryId + 8 : this.categoryId)
    );
    /* tslint:enable: no-bitwise */
  }
}
