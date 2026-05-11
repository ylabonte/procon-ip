/**
 * Relay on-timer via the controller's `/SetState.pl` endpoint.
 * @packageDocumentation
 */

import { AbstractService, type HttpMethod } from './abstract-service';

export class SetStateService extends AbstractService {
  public _endpoint = '/SetState.pl';
  public _method: HttpMethod = 'GET';

  /**
   * Turn relay `relayNo` on for `duration` seconds via the controller's on-timer.
   * Retries up to three times internally before giving up; no error is surfaced
   * to the caller — per-attempt failures (timeouts, HTTP errors, etc.) are
   * caught and logged.
   *
   * @param relayNo Target relay number (1-based, matches the controller UI).
   * @param duration Timer duration in **seconds** (controller wants ms — we multiply).
   * @returns The duration on success, or `-1` after three failures.
   */
  public async setTimer(relayNo: number, duration: number): Promise<number> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await this.request({
          params: {
            [`R${relayNo}`]: 1,
            [`RT${relayNo}`]: duration * 1000,
          },
        });
        this.log.info(`SetState.pl OK (${res.status})`);
        return duration;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.debug(`SetState attempt ${attempt + 1} failed: ${msg}`);
      }
    }
    return -1;
  }
}
