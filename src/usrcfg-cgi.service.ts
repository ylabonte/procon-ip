/**
 * Switches relay state via the controller's `/usrcfg.cgi` endpoint.
 * @packageDocumentation
 */

import { AbstractService, type HttpMethod, type IServiceConfig } from './abstract-service';
import type { GetStateService } from './get-state.service';
import type { GetStateDataObject } from './get-state-data-object';
import type { RelayDataInterpreter } from './relay-data-interpreter';
import type { ILogger } from './logger';

export enum SetStateValue {
  OFF = 0,
  ON = 1,
  AUTO = 2,
}

export class UsrcfgCgiService extends AbstractService {
  public _endpoint = '/usrcfg.cgi';
  public _method: HttpMethod = 'POST';

  private getStateService: GetStateService;
  private relayDataInterpreter: RelayDataInterpreter;

  public constructor(
    config: IServiceConfig,
    logger: ILogger,
    getStateService: GetStateService,
    relayDataInterpreter: RelayDataInterpreter,
  ) {
    super(config, logger);
    this.relayDataInterpreter = relayDataInterpreter;
    this.getStateService = getStateService;
    this._requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  }

  public async setOn(relay: GetStateDataObject): Promise<void> {
    const masks = this.relayDataInterpreter.evaluate(this.getStateService.data).setOn(relay);
    await this.send(masks);
  }

  public async setOff(relay: GetStateDataObject): Promise<void> {
    const masks = this.relayDataInterpreter.evaluate(this.getStateService.data).setOff(relay);
    await this.send(masks);
  }

  public async setAuto(relay: GetStateDataObject): Promise<void> {
    const masks = this.relayDataInterpreter.evaluate(this.getStateService.data).setAuto(relay);
    await this.send(masks);
  }

  private async send(masks: [number, number]): Promise<void> {
    const params = new URLSearchParams();
    params.set('ENA', `${masks[0]},${masks[1]}`);
    params.set('MANUAL', '1');
    await this.request({ body: params.toString() });
  }
}
