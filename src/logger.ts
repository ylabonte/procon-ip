export interface Log {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export class Logger implements Log {
  public loglevel: 'debug' | 'info' | 'warn' | 'error' = 'warn';

  public debug(message: string): void {
    console.log(`(${this.timestamp}) DEBUG: ${message}`); // tslint:disable-line: no-console
  }

  public info(message: string): void {
    console.log(`(${this.timestamp}) INFO: ${message}`); // tslint:disable-line: no-console
  }

  public warn(message: string): void {
    console.log(`(${this.timestamp}) WARNING: ${message}`); // tslint:disable-line: no-console
  }

  public error(message: string): void {
    console.error(`(${this.timestamp}) ERROR: ${message}`); // tslint:disable-line: no-console
  }

  private get timestamp(): string {
    return new Date().toISOString();
  }
}
