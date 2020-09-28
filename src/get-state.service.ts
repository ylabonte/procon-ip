import axios, { AxiosPromise, Method } from 'axios';
import { AbstractService } from './abstract-service';
import { GetStateData } from './get-state-data';
import { Log } from './logger';
import { ServiceConfig } from './service-config';

export interface GetStateServiceConfig extends ServiceConfig {
  updateInterval: number;
  errorTolerance: number;
}

export class GetStateService extends AbstractService {
  public _endpoint = '/GetState.csv';
  public _method: Method = 'get';

  public data: GetStateData;

  private _hasData = false;

  private next?: number;

  private _updateInterval: number;

  private _updateCallback?: (data: GetStateData) => any;

  private _consecutiveFailsLimit = 10;

  private _consecutiveFails: number;

  private _recentError: any;

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

  public getUpdateInterval(): number {
    return this._updateInterval;
  }

  public setUpdateInterval(milliseconds: number): void {
    this._updateInterval = milliseconds;
  }

  public isRunning(): boolean {
    return !Number.isNaN(this.next);
  }

  public start(callable: (data: GetStateData) => any): void {
    this._updateCallback = callable;
    this.autoUpdate();
  }

  public stop(): void {
    clearTimeout(this.next);
    delete this.next;
    delete this._updateCallback;
  }

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

  public getData(): AxiosPromise<string> {
    return axios.request(this.axiosRequestConfig);
  }

  public hasData(): boolean {
    return this._hasData;
  }
}
