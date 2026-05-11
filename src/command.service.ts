/**
 * Manual dosage commands via the controller's `/Command.htm` endpoint.
 * @packageDocumentation
 */

import { AbstractService, type HttpMethod } from './abstract-service';
import { ProconIpError } from './errors';

export enum DosageTarget {
  CHLORINE = 0,
  PH_MINUS = 1,
  PH_PLUS = 2,
}

export class CommandService extends AbstractService {
  public _endpoint = '/Command.htm';
  public _method: HttpMethod = 'GET';

  /**
   * Manual chlorine dosage for `dosageTime` seconds.
   *
   * @example
   * ```ts
   * import { CommandService, Logger } from 'procon-ip';
   *
   * const svc = new CommandService(
   *   { controllerUrl: 'http://192.168.2.3', basicAuth: false, timeout: 5000 },
   *   new Logger(),
   * );
   * const seconds = await svc.setChlorineDosage(60); // dose for 60s
   * ```
   *
   * @returns The dosage duration on success, or `-1` after three failed attempts.
   */
  public async setChlorineDosage(dosageTime: number): Promise<number> {
    return this.setDosage(DosageTarget.CHLORINE, dosageTime);
  }
  /** Manual pH-minus dosage for `dosageTime` seconds. */
  public async setPhMinusDosage(dosageTime: number): Promise<number> {
    return this.setDosage(DosageTarget.PH_MINUS, dosageTime);
  }
  /** Manual pH-plus dosage for `dosageTime` seconds. */
  public async setPhPlusDosage(dosageTime: number): Promise<number> {
    return this.setDosage(DosageTarget.PH_PLUS, dosageTime);
  }

  /**
   * Trigger a manual dosage.
   *
   * Two error modes, distinguished:
   * - **Invalid input** (non-finite `dosageDuration`): throws `ProconIpError`
   *   immediately, before any HTTP traffic. The caller's bug, surface it.
   * - **Per-attempt request failure** (timeout, HTTP 5xx, network error):
   *   caught internally and retried up to three times. Failures are logged
   *   at `debug`; after the third attempt the method returns `-1`.
   *
   * @param dosageTarget Target relay (chlorine / pH-minus / pH-plus).
   * @param dosageDuration Duration in **seconds**. Fractional inputs are
   *   truncated; the returned value reflects the truncated seconds.
   * @returns The (truncated) duration on success, or `-1` after three failures.
   * @throws {@link ProconIpError} if `dosageDuration` is not a finite number.
   */
  public async setDosage(dosageTarget: DosageTarget, dosageDuration: number): Promise<number> {
    if (!Number.isFinite(dosageDuration)) {
      throw new ProconIpError(
        `Invalid dosage duration: ${String(dosageDuration)} (must be a finite number of seconds)`,
      );
    }
    // Normalise once so the value sent to the controller and the value
    // returned to the caller always agree (was previously truncated only in
    // the URL while the original fractional input was returned).
    const seconds = Math.trunc(dosageDuration);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this._setDosage(dosageTarget, seconds);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.debug(`Dosage attempt ${attempt + 1} failed: ${msg}`);
      }
    }
    return -1;
  }

  private async _setDosage(target: DosageTarget, seconds: number): Promise<number> {
    const res = await this.request({ params: { MAN_DOSAGE: `${target},${seconds}` } });
    this.log.info(`Command.htm OK (${res.status})`);
    return seconds;
  }
}
