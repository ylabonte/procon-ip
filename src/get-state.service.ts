/**
 * Polling service for the controller's `/GetState.csv` endpoint.
 * @packageDocumentation
 */

import { AbstractService, type HttpMethod, type IServiceConfig } from './abstract-service';
import { GetStateData } from './get-state-data';
import type { ILogger } from './logger';

export interface IGetStateServiceConfig extends IServiceConfig {
  /** Interval between polls, in milliseconds. */
  updateInterval: number;
  /** Number of consecutive identical failures tolerated before re-throwing. */
  errorTolerance: number;
}

export class GetStateService extends AbstractService {
  public _endpoint = '/GetState.csv';
  public _method: HttpMethod = 'GET';

  public data: GetStateData;
  private _hasData = false;
  private _next?: ReturnType<typeof setTimeout>;
  private _updateInterval: number;
  private _consecutiveFailsLimit: number;
  private _consecutiveFails = 0;
  private _stopOnError = false;
  private _recentErrorMessage: string | null = null;
  private _updateCallback?: (data: GetStateData) => void;
  private _errorCallback?: (e: Error) => void;

  public constructor(config: IGetStateServiceConfig, logger: ILogger) {
    super(config, logger);
    this._updateInterval = config.updateInterval;
    this._consecutiveFailsLimit = config.errorTolerance;
    this._requestHeaders.Accept = 'text/csv,text/plain';
    this.data = new GetStateData();
  }

  public getUpdateInterval(): number {
    return this._updateInterval;
  }
  public setUpdateInterval(ms: number): void {
    this._updateInterval = ms;
  }
  public isRunning(): boolean {
    return this._next !== undefined;
  }
  public hasData(): boolean {
    return this._hasData;
  }

  /**
   * Start the polling loop. Calls `successCallback` on every successful update
   * and `errorCallback` once the consecutive-failure tolerance is hit.
   *
   * @param successCallback Invoked with the freshly parsed {@link GetStateData}
   *   after every successful poll.
   * @param errorCallback Invoked with the most recent `Error` when the
   *   `errorTolerance` is reached. The error is one of the typed classes
   *   from `'procon-ip'` ({@link BadCredentialsError}, {@link BadStatusCodeError},
   *   {@link RequestTimeoutError}) or a `TypeError` on network failure.
   * @param stopOnError When `true`, calling the error callback also stops
   *   the polling loop. Default `false` (loop keeps running, callback fires
   *   each time the tolerance is hit).
   *
   * @example
   * ```ts
   * import { GetStateService, Logger } from 'procon-ip';
   *
   * const svc = new GetStateService(
   *   { controllerUrl: 'http://192.168.2.3', basicAuth: false,
   *     timeout: 5000, updateInterval: 5000, errorTolerance: 3 },
   *   new Logger(),
   * );
   *
   * svc.start(
   *   (data) => console.log('uptime:', data.sysInfo.uptime),
   *   (e) => console.error('poll failed:', e.message),
   * );
   * ```
   */
  public start(
    successCallback?: (data: GetStateData) => void,
    errorCallback?: (e: Error) => void,
    stopOnError = false,
  ): void {
    this._updateCallback = successCallback;
    this._errorCallback = errorCallback;
    this._stopOnError = stopOnError;
    this.autoUpdate();
  }

  public stop(): void {
    if (this._next) clearTimeout(this._next);
    this._next = undefined;
    this._updateCallback = undefined;
  }

  public autoUpdate(): void {
    void this.update().catch((e: Error) => {
      if (this._stopOnError) this.stop();
      this._errorCallback?.(e);
    });
    if (this._next === undefined) {
      this._next = setTimeout(() => {
        this._next = undefined;
        this.autoUpdate();
      }, this._updateInterval);
    }
  }

  public async update(): Promise<GetStateData> {
    try {
      const res = await this.request();
      const text = await res.text();
      this._consecutiveFails = 0;
      this._recentErrorMessage = null;
      this.data = new GetStateData(text);
      this._hasData = true;
      this._updateCallback?.(this.data);
    } catch (e: unknown) {
      this._consecutiveFails += 1;
      const msg = e instanceof Error ? e.message : String(e);
      const consecutive = this._recentErrorMessage === msg;
      if (consecutive && this._consecutiveFails % this._consecutiveFailsLimit === 0) {
        this.log.warn(`${this._consecutiveFails} consecutive requests failed: ${msg}`);
        this._hasData = false;
        throw e;
      }
      if (consecutive) {
        this.log.debug(`${this._consecutiveFails} request(s) failed: ${msg}`);
      } else {
        this.log.warn(`request failed: ${msg}`);
        this._recentErrorMessage = msg;
        this._consecutiveFails = 1;
      }
    }
    return this.data;
  }
}
