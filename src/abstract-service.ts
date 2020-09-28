import { AxiosRequestConfig, Method } from 'axios';
import { Log } from './logger';
import { ServiceConfig } from './service-config';

export abstract class AbstractService {
  protected _config: ServiceConfig;
  abstract _endpoint: string;
  abstract _method: Method;
  protected _requestHeaders: { [key: string]: string };

  protected log: Log;

  protected constructor(config: ServiceConfig, logger: Log) {
    this._requestHeaders = {};
    this._config = config;
    this.log = logger;
  }

  public get baseUrl(): string {
    return this._config.baseUrl;
  }

  // public get requestHeaders(): object {
  //     // if (this._basicAuth) {
  //     //     this.setHttpHeader("Authorization", `Basic ${this.base64Credentials}`)
  //     // }
  //
  //     return this._requestHeaders;
  // }

  /**
   * @throws TypeError [ERR_INVALID_URL]: Invalid URL
   */
  public get url(): string {
    try {
      return new URL(
        (this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`) +
          (this._endpoint.startsWith('/') ? this._endpoint.substr(1) : this._endpoint),
      ).href;
    } catch (e) {
      this.log.error(e);
      return this._endpoint;
    }
  }

  // public setHttpHeader(name: string, value: string) {
  //     this._requestHeaders.set(name, value);
  // }
  //
  // private get base64Credentials(): string {
  //     return atob(`${this._username}:${this._password}`);
  // }

  protected get axiosRequestConfig(): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      // baseURL: this._baseUrl,
      timeout: this._config.timeout,
      url: this.url,
      method: this._method,
      headers: this._requestHeaders,
      // httpAgent: new Agent({
      //   /**
      //    * Socket timeout in milliseconds. This will set the timeout after the socket is connected.
      //    */
      //   timeout: this._config.timeout,
      //   /**
      //    * Maximum number of sockets to allow per host. Default for Node 0.10 is 5, default for Node 0.12 is Infinity
      //    */
      //   maxSockets: 5,
      //   /**
      //    * Maximum number of sockets to leave open in a free state. Only relevant if keepAlive is set to true. Default = 256.
      //    */
      //   maxFreeSockets: 3,
      //   /**
      //    * Keep sockets around in a pool to be used by other requests in the future. Default = false
      //    */
      //   keepAlive: false,
      //   /**
      //    * When using HTTP KeepAlive, how often to send TCP KeepAlive packets over sockets being kept alive. Default = 1000.
      //    * Only relevant if keepAlive is set to true.
      //    */
      //   keepAliveMsecs: this._config.timeout,
      // }),
    };

    if (this._config.basicAuth) {
      config.auth = {
        username: this._config.username,
        password: this._config.password,
      };
    }

    return config;
  }
}
