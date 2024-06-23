/**
 * The {@link CommandService} uses the `/Command.htm` endpoint of the ProCon.IP
 * pool controller to enable manual dosage.
 * @packageDocumentation
 */

import axios, { AxiosError, AxiosPromise, Method } from 'axios';
import { AbstractService } from './abstract-service';

/**
 * This enum can be used with the {@link CommandService.setDosage} method. But
 * there are also shorthand wrappers for all states ({@link CommandService.setChlorineDosage},
 * {@link CommandService.setPhPlusDosage}, {@link CommandService.setPhMinusDosage}) that can be used.
 */
export enum DosageTarget {
  CHLORINE = 0,
  PH_MINUS = 1,
  PH_PLUS = 2,
}

/**
 * The {@link CommandService} uses the `/Command.htm` endpoint of the ProCon.IP
 * pool controller to turn on manual dosage for a given amount of time/seconds.
 */
export class CommandService extends AbstractService {
  /**
   * Specific service endpoint.
   *
   * A path relative to the {@link IServiceConfig.controllerUrl}.
   */
  public _endpoint = '/Command.htm';

  /**
   * HTTP request method for this specific service endpoint.
   * See: `axios/Method`
   */
  public _method: Method = 'get';

  /**
   * Set manuel chlorine dosage for given amount of time in seconds.
   *
   * @param dosageTime Dosage duration in seconds.
   */
  public async setChlorineDosage(dosageTime: number): Promise<number> {
    return this.setDosage(DosageTarget.CHLORINE, dosageTime);
  }

  /**
   * Set manuel pH minus dosage for given amount of time in seconds.
   *
   * @param dosageTime Dosage duration in seconds.
   */
  public async setPhMinusDosage(dosageTime: number): Promise<number> {
    return this.setDosage(DosageTarget.PH_MINUS, dosageTime);
  }

  /**
   * Set manuel pH plus dosage for given amount of time in seconds.
   *
   * @param dosageTime Dosage duration in seconds.
   */
  public async setPhPlusDosage(dosageTime: number): Promise<number> {
    return this.setDosage(DosageTarget.PH_PLUS, dosageTime);
  }

  /**
   * Set the desired relay state.
   *
   * @param dosageTarget Dosage target (0 = chlorine, 1 = pH minus, 2 = pH plus).
   * @param dosageDuration Desired duration in seconds.
   */
  public async setDosage(dosageTarget: DosageTarget, dosageDuration: number): Promise<number> {
    for (let errors = 0; errors < 3; errors++) {
      try {
        return await this._setDosage(dosageTarget, dosageDuration);
      } catch (e: unknown) {
        this.log.debug(`Error sending relay control command: ${String(e)}`);
      }
    }

    return -1;
  }

  private async _setDosage(dosageTarget: DosageTarget, dosageDuration: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.sendManualDosage(dosageTarget, dosageDuration)
        .then((response) => {
          this.log.info(`Command.htm response: ${JSON.stringify(response.data)}`);
          this.log.info(`Command.htm status: (${response.status}) ${response.statusText}`);
          if (response.status === 200) {
            resolve(dosageDuration);
          } else {
            reject(
              new Error(
                `(${response.status}: ${response.statusText}) Error sending dosage control command: ${response.data}`,
              ),
            );
          }
        })
        .catch((e: AxiosError) => {
          reject(new Error(`Error sending dosage control command: ${e.response?.statusText ?? String(e)}`));
        });
    });
  }

  private sendManualDosage(dosageTarget: DosageTarget, dosageDuration: number): AxiosPromise {
    const requestConfig = this.axiosRequestConfig;
    requestConfig.url += `?MAN_DOSAGE=${dosageTarget},${Math.trunc(dosageDuration)}`;

    return axios.request(requestConfig);
  }
}
