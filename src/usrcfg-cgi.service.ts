/**
 * Switches relay state via the controller's `/usrcfg.cgi` endpoint.
 * @packageDocumentation
 */

import { AbstractService, type HttpMethod, type IServiceConfig } from './abstract-service';
import type { GetStateService } from './get-state.service';
import type { GetStateDataObject } from './get-state-data-object';
import type { RelayDataInterpreter } from './relay-data-interpreter';
import type { ILogger } from './logger';

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

  /**
   * Switch the given relay to manual ON.
   *
   * @example
   * ```ts
   * import {
   *   GetStateService, UsrcfgCgiService, RelayDataInterpreter,
   *   GetStateCategory, Logger,
   * } from 'procon-ip';
   *
   * const log = new Logger();
   * const config = { controllerUrl: 'http://192.168.2.3', basicAuth: false,
   *                  timeout: 5000, updateInterval: 5000, errorTolerance: 2 };
   * const get = new GetStateService(config, log);
   * await get.update();
   * const relays = new UsrcfgCgiService(config, log, get, new RelayDataInterpreter(log));
   * const [firstRelay] = get.data.getDataObjectsByCategory(GetStateCategory.RELAYS);
   * if (!firstRelay) throw new Error('no relays in fixture');
   * await relays.setOn(firstRelay);
   * ```
   */
  public async setOn(relay: GetStateDataObject): Promise<void> {
    const masks = this.relayDataInterpreter.evaluate(this.getStateService.data).setOn(relay);
    await this.send(masks);
  }

  /** Switch the given relay to manual OFF. See {@link setOn} for an example. */
  public async setOff(relay: GetStateDataObject): Promise<void> {
    const masks = this.relayDataInterpreter.evaluate(this.getStateService.data).setOff(relay);
    await this.send(masks);
  }

  /** Hand the given relay back to the controller's automatic schedule. See {@link setOn} for an example. */
  public async setAuto(relay: GetStateDataObject): Promise<void> {
    const masks = this.relayDataInterpreter.evaluate(this.getStateService.data).setAuto(relay);
    await this.send(masks);
  }

  private async send(masks: [number, number]): Promise<void> {
    // The controller's legacy /usrcfg.cgi parser requires a LITERAL comma in the
    // ENA value (e.g. "ENA=1,2"). URLSearchParams would percent-encode it to
    // "%2C", which the firmware cannot parse — it answers by resetting the TCP
    // connection (ECONNRESET / "fetch failed") and the relay never switches.
    // Build the body by hand so the comma stays literal (the wire format the
    // controller's own web UI and the pre-2.x client used).
    await this.request({ body: `ENA=${masks[0]},${masks[1]}&MANUAL=1` });
    // Refresh the shared GetStateService snapshot so a follow-up setOn/Off/Auto
    // computes its masks from the post-write state. Without this, sequential
    // calls would all see the pre-write state and the second call's mask would
    // re-assert the first relay's old position, undoing the previous change.
    // See RelayDataInterpreter.evaluate() — "stateData should be as up-to-date
    // as possible". A poll-loop running in parallel would eventually re-sync,
    // but consumers shouldn't have to wait for a tick.
    await this.getStateService.update();
  }
}
