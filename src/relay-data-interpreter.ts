import { GetStateCategory, GetStateData } from './get-state-data';
import { RelayDataObject } from './relay-data-object';
import { GetStateDataObject } from './get-state-data-object';
import { Log } from './logger';

/**
 * The relay state is a two bit value in decimal representation:
 * - lsb: 0 = off, 1 = on
 * - msb: 0 = auto, 1 = manual
 */
export enum RelayStateBitMask {
  on = 1,
  manual = 2,
  // off = 2,
  // on = 3,
  // autoOff = 0,
  // autoOn = 1
}

export class RelayDataInterpreter {
  public byteState!: [number, number];
  private log: Log;

  public constructor(logger: Log) {
    this.log = logger;
  }

  public evaluate(stateData: GetStateData): RelayDataInterpreter {
    let relays = stateData.getDataObjectsByCategory(GetStateCategory.RELAYS);
    if (stateData.sysInfo.isExtRelaysEnabled()) {
      relays = relays.concat(stateData.getDataObjectsByCategory(GetStateCategory.EXTERNAL_RELAYS));
      this.byteState = [65535, 0];
    } else {
      this.byteState = [255, 0];
    }
    relays.forEach((data: GetStateDataObject) => {
      const relay = new RelayDataObject(data);
      this.log.debug(JSON.stringify(relay));
      /* tslint:disable: no-bitwise */
      if (this.isAuto(relay)) {
        this.byteState[0] &= ~relay.bitMask;
      }
      if (this.isOn(relay)) {
        this.byteState[1] |= relay.bitMask;
      }
      /* tslint:enable: no-bitwise */
    });
    return this;
  }

  public isOn(relay: GetStateDataObject): boolean {
    /* tslint:disable: no-bitwise */
    return (relay.raw & RelayStateBitMask.on) === RelayStateBitMask.on;
    /* tslint:enable: no-bitwise */
  }

  public isOff(relay: GetStateDataObject): boolean {
    return !this.isOn(relay);
  }

  public isManual(relay: GetStateDataObject): boolean {
    /* tslint:disable: no-bitwise */
    return (relay.raw & RelayStateBitMask.manual) === RelayStateBitMask.manual;
    /* tslint:enable: no-bitwise */
  }

  public isAuto(relay: GetStateDataObject): boolean {
    return !this.isManual(relay);
  }

  public setOn(relay: GetStateDataObject): [number, number] {
    this.log.debug(`Relay byte sate: ${JSON.stringify(this.byteState)}`);
    const relayObject = new RelayDataObject(relay);
    /* tslint:disable: no-bitwise */
    this.byteState[0] |= relayObject.bitMask;
    this.byteState[1] |= relayObject.bitMask;
    /* tslint:enable: no-bitwise */

    return this.byteState;
  }

  public setOff(relay: GetStateDataObject): [number, number] {
    this.log.debug(`Relay byte sate: ${JSON.stringify(this.byteState)}`);
    const relayObject = new RelayDataObject(relay);
    /* tslint:disable: no-bitwise */
    this.byteState[0] |= relayObject.bitMask;
    this.byteState[1] &= ~relayObject.bitMask;
    /* tslint:enable: no-bitwise */

    return this.byteState;
  }

  public setAuto(relay: GetStateDataObject): [number, number] {
    this.log.debug(`Relay byte sate: ${JSON.stringify(this.byteState)}`);
    const relayObject = new RelayDataObject(relay);
    /* tslint:disable: no-bitwise */
    this.byteState[0] &= ~relayObject.bitMask;
    this.byteState[1] &= ~relayObject.bitMask;
    /* tslint:enable: no-bitwise */

    return this.byteState;
  }
}
