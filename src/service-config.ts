export interface ServiceConfig {
  requestHeaders?: { [key: string]: string };
  controllerUrl: string;
  username: string;
  password: string;
  basicAuth: boolean;
  timeout: number;

  // Use a catch-all approach to enable array-like iteration with
  // key as a variable...
  [key: string]: any;
}
