export class ProconIpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadCredentialsError extends ProconIpError {}

export class BadStatusCodeError extends ProconIpError {
  readonly status: number;
  readonly statusText: string;
  constructor(message: string, status: number, statusText: string) {
    super(message);
    this.status = status;
    this.statusText = statusText;
  }
}

export class RequestTimeoutError extends ProconIpError {
  readonly timeoutMs: number;
  constructor(message: string, timeoutMs: number) {
    super(message);
    this.timeoutMs = timeoutMs;
  }
}

export class InvalidPayloadError extends ProconIpError {}
