/**
 * This file exports the common basis of the webservice interfaces.
 * 
 * This abstract class builds a common basis for the [[`GetStateService`]] and 
 * the [[`UsrcfgCgiService`]] classes. These two classes are the actual
 * webservice interfaces to the ProCon.IP pool controller.
 * @packageDocumentation
 */

import { AxiosRequestConfig, Method } from 'axios';
import { Log } from './logger';
import { ServiceConfig } from './service-config';

/**
 * Abstract service implementing the common base setup for the _axios_ requests
 * of the specific service implementations.
 */
export abstract class AbstractService {
  protected _config: ServiceConfig;

  /**
   * Specific webservice endpoint.
   * 
   * An _absolute URL_, which means a path with leading slash ('/') relative to
   * the [[`ServiceConfig.controllerUrl`]] (ProCon.IP base address).
   */
  abstract _endpoint: string;

  /**
   * HTTP request method.
   * 
   * Must be one of the valid HTTP request methods like _GET_, _POST_, etc.
   * See `axios/Method` type:
   * ```
   * export type Method =
   *   | 'get' | 'GET'
   *   | 'delete' | 'DELETE'
   *   | 'head' | 'HEAD'
   *   | 'options' | 'OPTIONS'
   *   | 'post' | 'POST'
   *   | 'put' | 'PUT'
   *   | 'patch' | 'PATCH'
   *   | 'purge' | 'PURGE'
   *   | 'link' | 'LINK'
   *   | 'unlink' | 'UNLINK'
   * ```
   */
  abstract _method: Method;

  /**
   * Custom HTTP headers.
   * 
   * Custom headers can be defined in form of a key value pair.
   * ```
   * this._requestHeaders["Cache-Control"] = "no-cache";
   * ```
   */
  protected _requestHeaders: { [key: string]: string };

  /**
   * Logger which will be used for all logging events.
   */
  protected log: Log;

  /**
   * Constructor.
   * 
   * @param config Service config.
   * @param logger Service logger.
   */
  protected constructor(config: ServiceConfig, logger: Log) {
    this._requestHeaders = {};
    this._config = config;
    this.log = logger;
  }

  /**
   * Get the base url.
   * 
   * @returns The [[`ServiceConfig.controllerUrl`]] string.
   */
  public get baseUrl(): string {
    return this._config.controllerUrl;
  }

  // public get requestHeaders(): object {
  //     // if (this._basicAuth) {
  //     //     this.setHttpHeader("Authorization", `Basic ${this.base64Credentials}`)
  //     // }
  //
  //     return this._requestHeaders;
  // }

  /**
   * Get the webservice url (joined base url and endpoint).
   * 
   * @throws TypeError [ERR_INVALID_URL]: Invalid URL
   * @returns URL string (joined base url and endpoint).
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

  /**
   * Get an `axios/AxiosRequestConfig` object.
   */
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
        username: this._config.username || "",
        password: this._config.password || "",
      };
    }

    return config;
  }
}
