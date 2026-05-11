import { AbstractService, type HttpMethod, type IServiceConfig } from './abstract-service';
import { GetDmxData } from './get-dmx-data';
import type { ILogger } from './logger';

export class GetDmxService extends AbstractService {
  public _endpoint = '/GetDmx.csv';
  public _method: HttpMethod = 'GET';

  constructor(config: IServiceConfig, logger: ILogger) {
    super(config, logger);
    this._requestHeaders.Accept = 'text/csv,text/plain';
  }

  /** Fetch and parse the controller's current DMX channel state. */
  async update(): Promise<GetDmxData> {
    const res = await this.request();
    return new GetDmxData(await res.text());
  }
}
