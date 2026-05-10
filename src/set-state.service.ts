/**
 * Relay on-timer via the controller's `/SetState.pl` endpoint.
 * @packageDocumentation
 */

import { AbstractService, type HttpMethod } from './abstract-service';
import { ProconIpError } from './errors';

export class SetStateService extends AbstractService {
  public _endpoint = '/SetState.pl';
  public _method: HttpMethod = 'GET';

  /**
   * Turn relay `relayNo` on for `duration` seconds via the controller's on-timer.
   *
   * @param relayNo Target relay number (1-based, matches the controller UI).
   * @param duration Timer duration in **seconds** (controller wants ms — we multiply).
   * @returns The duration on success, or `-1` after three failures.
   */
  public async setTimer(relayNo: number, duration: number): Promise<number> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this._setTimer(relayNo, duration);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.debug(`SetState attempt ${attempt + 1} failed: ${msg}`);
      }
    }
    return -1;
  }

  private async _setTimer(relayNo: number, duration: number): Promise<number> {
    const url = `${this.url}?R${relayNo}=1&RT${relayNo}=${duration * 1000}`;
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
        throw new ProconIpError(`SetState.pl responded ${res.status} ${res.statusText}`);
      }
      this.log.info(`SetState.pl OK (${res.status})`);
      return duration;
    } finally {
      clearTimeout(timer);
    }
  }
}
