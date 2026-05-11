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
  private _polling = false;
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
    // errorTolerance is used as a modulo divisor in update(); clamp to >=1 so
    // 0 or negative values don't produce NaN/Infinity behaviour silently.
    this._consecutiveFailsLimit = Math.max(1, Math.trunc(config.errorTolerance));
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
    return this._polling;
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
    this._polling = true;
    this.autoUpdate();
  }

  public stop(): void {
    this._polling = false;
    if (this._next !== undefined) {
      clearTimeout(this._next);
      this._next = undefined;
    }
    // Clear both callbacks so a request in flight at stop() time can't fire
    // either a success or error notification after the service is "stopped".
    // The autoUpdate() catch handler also guards on _polling for the case
    // where the callback hasn't been cleared yet (race between stop() and
    // the rejection landing).
    this._updateCallback = undefined;
    this._errorCallback = undefined;
  }

  /**
   * Run one update, then (while the poll loop is active) schedule the next
   * tick *after* the current request settles. This serialises requests so a
   * slow update can't trigger overlapping in-flight fetches and skew
   * `_consecutiveFails` bookkeeping. Effective interval becomes
   * `max(updateInterval, request_time)`.
   *
   * Calling `autoUpdate()` directly also enters the poll loop; call
   * {@link stop} to leave it.
   */
  public autoUpdate(): void {
    this._polling = true;
    void this.update()
      .catch((e: unknown) => {
        // Coerce to Error so the typed errorCallback signature holds at runtime
        // even if a non-Error value made it this far (e.g. a thrown string).
        const err = e instanceof Error ? e : new Error(String(e));
        if (this._stopOnError) this.stop();
        // Don't fire the error callback if stop() was called while this
        // request was in flight — once "stopped" the consumer expects no
        // further notifications, success or error.
        if (this._polling) this._errorCallback?.(err);
      })
      .finally(() => {
        if (!this._polling) return;
        this._next = setTimeout(() => {
          this._next = undefined;
          this.autoUpdate();
        }, this._updateInterval);
      });
  }

  public async update(): Promise<GetStateData> {
    let succeeded = false;
    try {
      const res = await this.request();
      const text = await res.text();
      this._consecutiveFails = 0;
      this._recentErrorMessage = null;
      this.data = new GetStateData(text);
      this._hasData = true;
      succeeded = true;
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
    // The success callback runs outside the request try/catch — a consumer
    // bug in the callback must not be mistaken for a polling failure and
    // must not advance _consecutiveFails or flip _hasData.
    if (succeeded && this._updateCallback) {
      try {
        this._updateCallback(this.data);
      } catch (cbErr) {
        const msg = cbErr instanceof Error ? cbErr.message : String(cbErr);
        this.log.warn(`successCallback threw, swallowed: ${msg}`);
      }
    }
    return this.data;
  }
}
