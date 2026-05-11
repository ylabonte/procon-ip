/** Base class for all errors thrown by the procon-ip library. */
export class ProconIpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Thrown when the controller returns HTTP 401 or 403. */
export class BadCredentialsError extends ProconIpError {}

/** Thrown when the controller returns a non-success HTTP status that isn't 401/403. */
export class BadStatusCodeError extends ProconIpError {
  readonly status: number;
  readonly statusText: string;
  constructor(message: string, status: number, statusText: string) {
    super(message);
    this.status = status;
    this.statusText = statusText;
  }
}

/** Thrown when a request exceeds the configured timeout. */
export class RequestTimeoutError extends ProconIpError {
  readonly timeoutMs: number;
  constructor(message: string, timeoutMs: number) {
    super(message);
    this.timeoutMs = timeoutMs;
  }
}

/** Thrown when a controller response cannot be parsed (e.g. malformed CSV). */
export class InvalidPayloadError extends ProconIpError {}
