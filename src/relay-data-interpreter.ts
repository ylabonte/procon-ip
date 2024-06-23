/**
 * The {@link RelayDataInterpreter} is a helper for all the binary operations
 * that are necessary to read and write relay states.
 * @packageDocumentation
 */

import { GetStateCategory, GetStateData } from './get-state-data';
import { RelayDataObject } from './relay-data-object';
import { GetStateDataObject } from './get-state-data-object';
import { ILogger } from './logger';

/**
 * The relay state is a two bit value in decimal representation:
 * - lsb: 0 = off, 1 = on
 * - msb: 0 = auto, 1 = manual
 *
 * It is used by the {@link RelayDataInterpreter} and the {@link UsrcfgCgiService}.
 */
export enum RelayStateBitMask {
  on = 1,
  manual = 2,
}

/**
 * The {@link RelayDataInterpreter} is a helper for all the binary operations
 * that are necessary to read and write relay states.
 */
export class RelayDataInterpreter {
  /**
   * A pair of bit patterns in decimal representation according to the way the
   * `/usrcfg.cgi` endpoints wants its values.
   */
  public bitStates!: [number, number];

  private log: ILogger;

  /**
   * Initialize a new {@link RelayDataInterpreter}.
   *
   * @param logger
   */
  public constructor(logger: ILogger) {
    this.log = logger;
  }

  /**
   * Evaluate the current relay states and set the {@link bitStates} accordingly.
   *
   * The determined values are used to set the switching parameters. Therefore,
   * the input values should be as up-to-date as possible. Otherwise, a change
   * on one relay will reset all other relays based on the `stateData`.
   *
   * **Important**
   * This method should be called before using any of the set operations
   * ({@link setOn}, {@link setOff}, {@link setAuto}).
   *
   * @param stateData The most recent {@link GetStateData} instance.
   */
  public evaluate(stateData: GetStateData): RelayDataInterpreter {
    let relays = stateData.getDataObjectsByCategory(GetStateCategory.RELAYS);
    if (stateData.sysInfo.isExtRelaysEnabled()) {
      relays = relays.concat(stateData.getDataObjectsByCategory(GetStateCategory.EXTERNAL_RELAYS));
      this.bitStates = [65535, 0];
    } else {
      this.bitStates = [255, 0];
    }
    relays.forEach((data: GetStateDataObject) => {
      const relay = new RelayDataObject(data);
      this.log.debug(JSON.stringify(relay));
      /* tslint:disable: no-bitwise */
      if (this.isAuto(relay)) {
        this.bitStates[0] &= ~relay.bitMask;
      }
      if (this.isOn(relay)) {
        this.bitStates[1] |= relay.bitMask;
      }
      /* tslint:enable: no-bitwise */
    });
    return this;
  }

  /**
   * True if the given relay ({@link GetStateDataObject}) is currently switched
   * on.
   *
   * @param relay
   */
  public isOn(relay: GetStateDataObject): boolean {
    /* eslint-disable  @typescript-eslint/no-unsafe-enum-comparison */
    return (relay.raw & RelayStateBitMask.on) === RelayStateBitMask.on;
    /* eslint-enable  @typescript-eslint/no-unsafe-enum-comparison */
  }

  /**
   * True if the given relay ({@link GetStateDataObject}) is currently switched
   * off.
   *
   * @param relay
   */
  public isOff(relay: GetStateDataObject): boolean {
    return !this.isOn(relay);
  }

  /**
   * True if the given relay ({@link GetStateDataObject}) is currently not in
   * auto mode.
   *
   * @param relay
   */
  public isManual(relay: GetStateDataObject): boolean {
    /* eslint-disable  @typescript-eslint/no-unsafe-enum-comparison */
    return (relay.raw & RelayStateBitMask.manual) === RelayStateBitMask.manual;
    /* eslint-enable  @typescript-eslint/no-unsafe-enum-comparison */
  }

  /**
   * True if the given relay ({@link GetStateDataObject}) is currently in auto
   * mode.
   *
   * @param relay
   */
  public isAuto(relay: GetStateDataObject): boolean {
    return !this.isManual(relay);
  }

  /**
   * Return the appropriate bit patterns for the `/usrcfg.cgi` endpoint to
   * switch the given relay ({@link GetStateDataObject}) on.
   *
   * @param relay
   */
  public setOn(relay: GetStateDataObject): [number, number] {
    this.log.debug(`Relay byte state: ${JSON.stringify(this.bitStates)}`);
    const relayObject = new RelayDataObject(relay);
    /* tslint:disable: no-bitwise */
    this.bitStates[0] |= relayObject.bitMask;
    this.bitStates[1] |= relayObject.bitMask;
    /* tslint:enable: no-bitwise */

    return this.bitStates;
  }

  /**
   * Return the appropriate bit patterns for the `/usrcfg.cgi` endpoint to
   * switch the given relay ({@link GetStateDataObject}) off.
   *
   * @param relay
   */
  public setOff(relay: GetStateDataObject): [number, number] {
    this.log.debug(`Relay byte state: ${JSON.stringify(this.bitStates)}`);
    const relayObject = new RelayDataObject(relay);
    /* tslint:disable: no-bitwise */
    this.bitStates[0] |= relayObject.bitMask;
    this.bitStates[1] &= ~relayObject.bitMask;
    /* tslint:enable: no-bitwise */

    return this.bitStates;
  }

  /**
   * Return the appropriate bit patterns for the `/usrcfg.cgi` endpoint to
   * switch the given relay ({@link GetStateDataObject}) into auto mode.
   *
   * @param relay
   */
  public setAuto(relay: GetStateDataObject): [number, number] {
    this.log.debug(`Relay byte state: ${JSON.stringify(this.bitStates)}`);
    const relayObject = new RelayDataObject(relay);
    /* tslint:disable: no-bitwise */
    this.bitStates[0] &= ~relayObject.bitMask;
    this.bitStates[1] &= ~relayObject.bitMask;
    /* tslint:enable: no-bitwise */

    return this.bitStates;
  }
}
