export interface ServiceConfig {
  requestHeaders: { [key: string]: string };
  baseUrl: string;
  username: string;
  password: string;
  basicAuth: boolean;
  timeout: number;
}
