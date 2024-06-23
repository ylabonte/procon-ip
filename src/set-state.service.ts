/**
 * The {@link SetStateService} uses the `/SetState.pl` endpoint of the ProCon.IP
 * pool controller to turn on relays for a specified time span.
 * @packageDocumentation
 */

import axios, { Method } from 'axios';
import { AbstractService } from './abstract-service';

/**
 * The {@link CommandService} uses the `/SetState.pl` endpoint of the ProCon.IP
 * pool controller to turn on relays for a specified time span.
 */
export class SetStateService extends AbstractService {
  /**
   * Specific service endpoint.
   *
   * A path relative to the {@link IServiceConfig.controllerUrl}.
   */
  public _endpoint = '/SetState.pl';

  /**
   * HTTP request method for this specific service endpoint.
   * See: `axios/Method`
   */
  public _method: Method = 'get';

  /**
   * Set relay on-timer.
   *
   * @param relayNo Target relay number (count starting from 1).
   * @param duration Desired timer duration in seconds.
   */
  public async setTimer(relayNo: number, duration: number): Promise<number> {
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    for (let errors = 0; errors < 3; errors++) {
      try {
        return await this._setTimer(relayNo, duration);
      } catch (e: any) {
        this.log.debug(`Error setting relay timer: ${e}`);
      }
    }

    return -1;
    /* eslint-enable  @typescript-eslint/no-explicit-any */
  }

  private async _setTimer(relayNo: number, duration: number): Promise<number> {
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    return new Promise<number>((resolve, reject) => {
      const requestConfig = this.axiosRequestConfig;
      requestConfig.url += `?R${relayNo}=1&RT${relayNo}=${duration * 1000}`;
      axios
        .request(requestConfig)
        .then((response) => {
          this.log.info(`SetState.pl response: ${JSON.stringify(response.data)}`);
          this.log.info(`SetState.pl status: (${response.status}) ${response.statusText}`);
          if (response.status === 200) {
            resolve(duration);
          } else {
            reject(new Error(`(${response.status}: ${response.statusText}): ${response.data}`));
          }
        })
        .catch((e: any) => {
          reject(e);
        });
    });
    /* eslint-enable  @typescript-eslint/no-explicit-any */
  }
}
