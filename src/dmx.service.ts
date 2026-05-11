import { AbstractService, type HttpMethod, type IServiceConfig } from './abstract-service';
import type { GetDmxData } from './get-dmx-data';
import type { ILogger } from './logger';

export class DmxService extends AbstractService {
  public _endpoint = '/usrcfg.cgi';
  public _method: HttpMethod = 'POST';

  constructor(config: IServiceConfig, logger: ILogger) {
    super(config, logger);
    this._requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  }

  /** Push the given DMX channel state back to the controller. All 16 channels are written. */
  async set(data: GetDmxData): Promise<void> {
    const body = new URLSearchParams(data.toPostData()).toString();
    await this.request({ body });
  }
}
