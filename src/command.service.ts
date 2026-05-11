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
   * Trigger a manual dosage. Retries up to three times before giving up.
   *
   * @param dosageTarget Target relay (chlorine / pH-minus / pH-plus).
   * @param dosageDuration Duration in **seconds**.
   * @returns The duration on success, or `-1` after three failures.
   * @throws {@link ProconIpError} subclasses on per-attempt failures (caught internally for retry).
   */
  public async setDosage(dosageTarget: DosageTarget, dosageDuration: number): Promise<number> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this._setDosage(dosageTarget, dosageDuration);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.debug(`Dosage attempt ${attempt + 1} failed: ${msg}`);
      }
    }
    return -1;
  }

  private async _setDosage(target: DosageTarget, duration: number): Promise<number> {
    const url = `${this.url}?MAN_DOSAGE=${target},${Math.trunc(duration)}`;
    const headers = new Headers(this._requestHeaders);
    if (this._config.basicAuth) {
      const creds = `${this._config.username ?? ''}:${this._config.password ?? ''}`;
      headers.set('Authorization', `Basic ${Buffer.from(creds).toString('base64')}`);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._config.timeout);
    try {
      const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
      if (!res.ok) {
        throw new ProconIpError(`Command.htm responded ${res.status} ${res.statusText}`);
      }
      this.log.info(`Command.htm OK (${res.status})`);
      return duration;
    } finally {
      clearTimeout(timer);
    }
  }
}
