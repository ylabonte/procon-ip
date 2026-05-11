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
   * Two error modes, distinguished:
   * - **Invalid input** (non-finite `duration`): throws `ProconIpError`
   *   immediately, before any HTTP traffic. The caller's bug, surface it.
   * - **Per-attempt request failure** (timeout, HTTP 5xx, network error):
   *   caught internally and retried up to three times. Failures are logged
   *   at `debug`; after the third attempt the method returns `-1`.
   *
   * @param relayNo Target relay number (1-based, matches the controller UI).
   * @param duration Timer duration in **seconds**. Fractional inputs are
   *   truncated; the returned value reflects the truncated seconds that were
   *   actually sent to the controller.
   * @returns The (truncated) duration on success, or `-1` after three failures.
   * @throws {@link ProconIpError} if `duration` is not a finite number.
   */
  public async setTimer(relayNo: number, duration: number): Promise<number> {
    if (!Number.isFinite(duration)) {
      throw new ProconIpError(`Invalid timer duration: ${String(duration)} (must be a finite number of seconds)`);
    }
    // Normalise once: integer seconds, then multiply by 1000 with integer-only
    // arithmetic to avoid floating-point artefacts like `0.3 * 1000` producing
    // "300.00000000000006" which would land verbatim in the query string.
    const seconds = Math.trunc(duration);
    const milliseconds = seconds * 1000;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await this.request({
          params: {
            [`R${relayNo}`]: 1,
            [`RT${relayNo}`]: milliseconds,
          },
        });
        this.log.info(`SetState.pl OK (${res.status})`);
        return seconds;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.debug(`SetState attempt ${attempt + 1} failed: ${msg}`);
      }
    }
    return -1;
  }
}
