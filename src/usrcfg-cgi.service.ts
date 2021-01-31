/**
 * The [[`UsrcfgCgiService`]] uses the `/usrcfg.cgi` endpoint of the ProCon.IP
 * pool controller to switch its relay states. The actual states can be read
 * from the [[`GetStateService`]].
 * @packageDocumentation
 */

import axios, { AxiosPromise, Method } from 'axios';
import { AbstractService, IServiceConfig } from './abstract-service';
import { GetStateService } from './get-state.service';
import { GetStateData } from './get-state-data';
import { GetStateDataObject } from './get-state-data-object';
import { RelayDataInterpreter, RelayStateBitMask } from './relay-data-interpreter';
import { ILogger } from './logger';

/**
 * This enum can be used with the [[`UsrcfgCgiService.setState`]] method. But
 * there are also shorthand wrappers for all states ([[`setOn`]], [[`setOff`]],
 * [[`setAuto`]]) that can be used.
 */
export enum SetStateValue {
  OFF = 0,
  ON = 1,
  AUTO = 2,
}

/**
 * The [[`UsrcfgCgiService`]] uses the `/usrcfg.cgi` endpoint of the ProCon.IP
 * pool controller to switch its relay states.
 *
 * It uses two bit patterns in decimal representation, to set on/off and auto
 * states for all relays at once. This means considering the states of all
 * relays, those which states should be changed as well as the ones which
 * states not gonna to be changed.
 */
export class UsrcfgCgiService extends AbstractService {
  /**
   * Specific service endpoint.
   *
   * A path relative to the [[`IServiceConfig.controllerUrl`]].
   */
  public _endpoint = '/usrcfg.cgi';

  /**
   * HTTP request method for this specific service endpoint.
   * See: `axios/Method`
   */
  public _method: Method = 'post';

  private stateData: GetStateData;

  private getStateService: GetStateService;

  private relayDataInterpreter: RelayDataInterpreter;

  /**
   * Initialize a new [[`UsrcfgCgiService`]]
   *
   * @param config The service config.
   * @param logger The service logger.
   * @param getStateService A corresponding [[`GetStateService`]] (must address
   *                        the same pool controller)
   * @param relayDataInterpreter An instance of [[`RelayDataInterpreter`]].
   */
  public constructor(
    config: IServiceConfig,
    logger: ILogger,
    getStateService: GetStateService,
    relayDataInterpreter: RelayDataInterpreter,
  ) {
    super(config, logger);
    this.relayDataInterpreter = relayDataInterpreter;
    this.getStateService = getStateService;
    this.stateData = this.getStateService.data;
    this._requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  }

  /**
   * Switch the given relay on.
   *
   * @param relayData Relay data object.
   */
  public async setOn(relayData: GetStateDataObject): Promise<number> {
    return this.setState(relayData, SetStateValue.ON);
  }

  /**
   * Switch the given relay off.
   *
   * @param relayData Relay data object.
   */
  public async setOff(relayData: GetStateDataObject): Promise<number> {
    return this.setState(relayData, SetStateValue.OFF);
  }

  /**
   * Set the given relay in auto mode.
   *
   * @param relayData Relay data object.
   */
  public async setAuto(relayData: GetStateDataObject): Promise<number> {
    return this.setState(relayData, SetStateValue.AUTO);
  }

  /**
   * Set the desired relay state.
   *
   * @param relay Relay data object.
   * @param state The desired state.
   */
  private async setState(relay: GetStateDataObject, state: SetStateValue | number): Promise<number> {
    for (let errors = 0; errors < 3; errors++) {
      try {
        const returnValue = await this._setState(relay, state);
        // return new Promise<number>(() => returnValue);
        return returnValue;
      } catch (e) {
        this.log.debug(`Error sending relay control command: ${e}`);
      }
    }

    // return new Promise<number>(() => -1);
    return -1;
  }

  private async _setState(relay: GetStateDataObject, state: SetStateValue | number): Promise<number> {
    let data: [number, number] | undefined;
    let desiredValue: number;
    /* tslint:disable: no-bitwise */
    switch (state) {
      case SetStateValue.AUTO:
        data = this.relayDataInterpreter.evaluate(this.getStateService.data).setAuto(relay);
        desiredValue = relay.raw & ~RelayStateBitMask.manual;
        break;
      case SetStateValue.ON:
        data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOn(relay);
        desiredValue = RelayStateBitMask.manual | RelayStateBitMask.on;
        break;
      case SetStateValue.OFF:
      default:
        data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOff(relay);
        desiredValue = RelayStateBitMask.manual | ~RelayStateBitMask.on;
        break;
    }
    /* tslint:enable: no-bitwise */

    this.log.info(`usrcfg.cgi data: ${JSON.stringify(data)}`);
    return new Promise<number>((resolve, reject) => {
      if (data === undefined) {
        return reject('Cannot determine request data for relay switching');
      }

      this.send(data)
        .then((response) => {
          this.log.info(`usrcfg.cgi response: ${JSON.stringify(response.data)}`);
          this.log.info(`usrcfg.cgi status: (${response.status}) ${response.statusText}`);
          // if (["continue", "done"].indexOf(response.data.toLowerCase()) >= 0) {
          if (response.status === 200) {
            this.getStateService.update();
            resolve(desiredValue);
          } else {
            reject(
              `(${response.status}: ${response.statusText}) Error sending relay control command: ${response.data}`,
            );
          }
        })
        .catch((e) => {
          reject(`Error sending relay control command: ${e.response ? e.response : e}`);
        });
    });
  }

  private send(bitTupel: [number, number]): AxiosPromise /*<{data: string; status: number; statusText: string}>*/ {
    // private send(bitTupel: [number, number]): /*Axios*/Promise<{data: string; status: number; statusText: string}> {
    const requestConfig = this.axiosRequestConfig;
    requestConfig.data = `ENA=${encodeURIComponent(bitTupel.join(','))}&MANUAL=1`;

    return axios.request(requestConfig);
  }
}
