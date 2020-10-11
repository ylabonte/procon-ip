/**
 * Interface for compatible loggers.
 * 
 * Must at least support the log levels `debug`, `info`, `warn` and `error`.
 */
export interface Log {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Console logger as default fallback.
 * 
 * This logger uses the `console.log` method and simply prepends a timestamp
 * plus the used log level in uppercase. You can write your own custom logger 
 * or pass any other (e.g. ioBroker has a suitable logger on board), that 
 * matches the `Log` interface.
 */
export class Logger implements Log {
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
