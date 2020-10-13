/**
 * This file exports the `GetStateService` as central status update service and
 * the corresponding `GetStateServiceConfig`.
 * @packageDocumentation
 */

import axios, { AxiosPromise, Method } from 'axios';
import { AbstractService } from './abstract-service';
import { GetStateData } from './get-state-data';
import { Log } from './logger';
import { ServiceConfig } from './service-config';

/**
 * Extend common `ServiceConfig` with special parameters that only apply to
 * the polling characteristics of this service.
 */
export interface GetStateServiceConfig extends ServiceConfig {
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
 * The `GetStateService` implements the `AbstractService` for 
 */
export class GetStateService extends AbstractService {
  /**
   * Specific service endpoint.
   * 
   * A path relative to the `ServiceConfig.controllerUrl`.
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
   * @internal
   */
  private _updateInterval: number;

  /**
   * @internal
   */
  private _updateCallback?: (data: GetStateData) => any;

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
   * Initialize a new `GetStateService`.
   * 
   * @param config Service configuration.
   * @param logger Service logger.
   */
  public constructor(config: GetStateServiceConfig, logger: Log) {
    super(config, logger);
    this._updateInterval = config.updateInterval;
    this._consecutiveFailsLimit = config.errorTolerance;
    this._consecutiveFails = 0;
    this._requestHeaders.Accept = 'text/csv,text/plain';
    this._updateCallback = () => {
      return;
    };
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
   * @param callable 
   */
  public start(callable: (data: GetStateData) => any): void {
    this._updateCallback = callable;
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
   * (`GetStateServiceConfig.timeout`) could cause an actual higher update
   * interval (`GetStateServiceConfig.updateInterval`).
   */
  public autoUpdate(): void {
    this.update();
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
   * Update data. This method will be triggered periodically once the service
   * has been started (`this.start((data) => {...})`).
   */
  public update(): void {
    this.getData().then(
      (response) => {
        this._consecutiveFails = 0;
        this._recentError = null;
        this.data = new GetStateData(response.data);
        this._hasData = true;
        if (this._updateCallback !== undefined) {
          this._updateCallback(this.data);
        }
      },
      (e) => {
        this._consecutiveFails += 1;
        if (this._consecutiveFails % this._consecutiveFailsLimit === 0 && this._recentError === e.response) {
          this.log.warn(`${this._consecutiveFails} consecutive requests failed: ${e.response ? e.response : e}`);
          this._recentError = null;
          this._hasData = false;
          this._consecutiveFails = 0;
        } else {
          if (this._recentError !== e.response) {
            this.log.info(`${this._consecutiveFails} request(s) failed: ${e.response ? e.response : e}`);
            this._recentError = e.response;
            this._consecutiveFails = 1;
          } else {
            this.log.debug(`${this._consecutiveFails} request(s) failed: ${e.response ? e.response : e}`);
          }
        }
      },
    );
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
