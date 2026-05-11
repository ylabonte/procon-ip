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

  /**
   * Push the given DMX channel state back to the controller. All 16 channels
   * are written in one POST.
   *
   * @example
   * ```ts
   * import { GetDmxService, DmxService, Logger } from 'procon-ip';
   *
   * const log = new Logger();
   * const config = { controllerUrl: 'http://192.168.2.3', basicAuth: false, timeout: 5000 };
   * const reader = new GetDmxService(config, log);
   * const writer = new DmxService(config, log);
   *
   * const dmx = await reader.update();
   * for (const ch of dmx) dmx.set(ch.index, (ch.value + 64) % 256);
   * await writer.set(dmx);
   * ```
   */
  async set(data: GetDmxData): Promise<void> {
    const body = new URLSearchParams(data.toPostData()).toString();
    await this.request({ body });
  }
}
