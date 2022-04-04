/**
 * This file exports the [[`GetStateService`]] as central status update service
 * and the corresponding [[`IGetStateServiceConfig`]].
 * @packageDocumentation
 */

import axios, { AxiosPromise, Method } from 'axios';
import { AbstractService, IServiceConfig } from './abstract-service';
import { GetStateData } from './get-state-data';
import { ILogger } from './logger';

/**
 * Extend common [[`IServiceConfig`]] with special parameters that only apply to
 * the polling characteristics of this service.
 */
export interface IGetStateServiceConfig extends IServiceConfig {
  /**
   * Interval [ms] between two webservice polling requests.
   */
  updateInterval: number;

  /**
   * Define how many HTTP request errors to tolerate before raising an error.
   */
  errorTolerance: number;
}

/**
 * The [[`GetStateService`]] implements the [[`AbstractService`]] for the
 * `/GetState.csv` endpoint.
 */
export class GetStateService extends AbstractService {
  /**
   * Specific service endpoint.
   *
   * A path relative to the [[`IServiceConfig.controllerUrl`]].
   */
  public _endpoint = '/GetState.csv';

  /**
   * HTTP request method for this specific service endpoint.
   * See: `axios/Method`
   */
  public _method: Method = 'get';

  /**
   * The actual service data object.
   */
  public data: GetStateData;

  /**
   * False until the service retrieved its first data.
   * @internal
   */
  private _hasData = false;

  /**
   * @internal
   */
  private next?: number;

  /**
   * Initially set via [[`IGetStateServiceConfig`]].
   * Can be adjusted using the [[`setUpdateInterval`]] method.
   */
  private _updateInterval: number;

  /**
   * An optional callback, that can be passed when calling the
   * [[`start`]] method.
   */
  private _updateCallback?: (data: GetStateData) => any;

  /**
   * @internal
   */
  private _errorCallback?: (e: Error) => any;

  /**
   * @internal
   */
  private _consecutiveFailsLimit = 10;

  /**
   * @internal
   */
  private _consecutiveFails: number;

  /**
   * @internal
   */
  private _recentError: any;

  /**
   * @internal
   */
  private _stopOnError: boolean;

  /**
   * Initialize a new [[`GetStateService`]].
   *
   * @param config Service configuration.
   * @param logger Service logger.
   */
  public constructor(config: IGetStateServiceConfig, logger: ILogger) {
    super(config, logger);
    this._stopOnError = false;
    this._updateInterval = config.updateInterval;
    this._consecutiveFailsLimit = config.errorTolerance;
    this._consecutiveFails = 0;
    this._requestHeaders.Accept = 'text/csv,text/plain';
    this._updateCallback = () => {};
    this.data = new GetStateData();
  }

  /**
   * Get the update interval [ms].
   */
  public getUpdateInterval(): number {
    return this._updateInterval;
  }

  /**
   * Set the update interval.
   *
   * @param milliseconds Update interval in milliseconds [ms].
   */
  public setUpdateInterval(milliseconds: number): void {
    this._updateInterval = milliseconds;
  }

  /**
   * Check whether the service is running.
   */
  public isRunning(): boolean {
    return !Number.isNaN(this.next);
  }

  /**
   * Start the service.
   *
   * This will periodically update the internal data and invoke the optional
   * callables each time new data is received.
   *
   * @param successCallback Will be triggered everytime the service receives
   *  new data. The current [[`GetStateData`]] object is passed as parameter
   *  to the callback.
   * @param errorCallback Error callback receives the most recent error as
   *  parameter, in case the consecutive error tolerance is hit.
   * @param stopOnError Whether to stop in case the consecutive error tolerance
   *  is hit. Default behavior (for backward compatibility) is to keep running
   *  in any case.
   */
  public start(
    successCallback?: (data: GetStateData) => void,
    errorCallback?: (e: Error) => void,
    stopOnError?: boolean,
  ): void {
    if (successCallback !== undefined) {
      this._updateCallback = successCallback;
    }
    if (errorCallback !== undefined) {
      this._errorCallback = errorCallback;
    }
    if (stopOnError) {
      this._stopOnError = stopOnError;
    }
    this.autoUpdate();
  }

  /**
   * Stop the service.
   */
  public stop(): void {
    clearTimeout(this.next);
    delete this.next;
    delete this._updateCallback;
  }

  /**
   * Recursive wrapper for the polling mechanism. The next request/interval
   * starts after the preceding one has ended. That means a big timeout
   * ([[`IGetStateServiceConfig.timeout`]]) could cause an actual higher update
   * interval ([[`IGetStateServiceConfig.updateInterval`]]).
   */
  public autoUpdate(): void {
    this.update().catch((e) => {
      if (this._stopOnError) this.stop();
      if (this._errorCallback !== undefined) this._errorCallback(e);
    });
    if (this.next === undefined) {
      this.next = Number(
        setTimeout(() => {
          delete this.next;
          this.autoUpdate();
        }, this.getUpdateInterval()),
      );
    }
  }

  /**
   * Update data by staging a HTTP request to the pool controller.
   *
   * This method will be triggered periodically once the service
   * has been started (see [[`GetStateService.start`]]). It also
   * includes the part responsible for the execution of the
   * [[`_updateCallback`]] (see [[`start`]]).
   */
  public async update(): Promise<GetStateData> {
    try {
      const response = await this.getData();
      this._consecutiveFails = 0;
      this._recentError = null;
      this.data = new GetStateData(response.data);
      this._hasData = true;
      if (this._updateCallback !== undefined) {
        this._updateCallback(this.data);
      }
    } catch (e: any) {
      this._consecutiveFails += 1;
      let isConsecutiveError: boolean;
      let errorMessage: string;
      if (e.isAxiosError && e.response && e.response.status) {
        errorMessage = `${e.response.status} / ${e.response.statusMessage}`;
        isConsecutiveError =
          this._recentError &&
          this._recentError.isAxiosError &&
          this._recentError.response &&
          this._recentError.response.status &&
          this._recentError.response.status === e.response.status;
      } else {
        errorMessage = e.message;
        isConsecutiveError = this._recentError && this._recentError.message && this._recentError === e.message;
      }

      if (isConsecutiveError && this._consecutiveFails % this._consecutiveFailsLimit === 0) {
        this.log.warn(`${this._consecutiveFails} consecutive requests failed with error "${errorMessage}"`);
        this._hasData = false;
        throw e;
      } else if (isConsecutiveError) {
        this.log.debug(`${this._consecutiveFails} request(s) failed: ${errorMessage}`);
      } else {
        this.log.warn(`request failed with error "${errorMessage}"`);
        this._recentError = e;
        this._consecutiveFails = 1;
      }
    }

    return this.data;
  }

  /**
   * Stage request and return the corresponding `AxiosPromise`.
   */
  public getData(): AxiosPromise<string> {
    return axios.request(this.axiosRequestConfig);
  }

  /**
   * Tells you whether the service has most recent status information or not.
   *
   * More accurately it tells you whether the most recent request succeeded or
   * not. So it will return `true` if the reuqest succeeded and your data is
   * up to date. It will return `false` until the service retrieved its first
   * data and again if a subsequent request fails.
   */
  public hasData(): boolean {
    return this._hasData;
  }
}
