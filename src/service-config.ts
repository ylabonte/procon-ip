/**
 * Shared service configuration. In this context _service_ means a web service
 * or endpoint of the ProCon.IP pool controller. The following parameters are
 * those that all services (in this library) have in common.
 * @packageDocumentation
 */

export interface ServiceConfig {
  requestHeaders?: { [key: string]: string };
  /**
   * Controller URL must be a valid URL string with leading protocol scheme
   * (e.g. 'http://') and should point to the ProCon.IP HTTP root. This address
   * will be combined with the endpoint (e.g. `"/GetState.csv"`) to build the
   * request address. A trailing slash will be added automatically if needed.
   */
  controllerUrl: string;

  /**
   * HTTP basic auth username. Optional.
   */
  username?: string;

  /**
   * HTTP basic auth pass. Optional.
   */
  password?: string;

  /**
   * Enable HTTP basic auth.
   */
  basicAuth: boolean;

  /**
   * Define request timeout.
   */
  timeout: number;

  /**
   * Configurations might contain any other values/keys, that do not conflict
   * with valid configuration parameters.
   */
  // Use a catch-all approach to enable array-like iteration with
  // key as a variable...
  [key: string]: any;
}
