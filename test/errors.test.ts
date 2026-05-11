import { describe, it, expect } from 'vitest';
import {
  ProconIpError,
  BadCredentialsError,
  BadStatusCodeError,
  RequestTimeoutError,
  InvalidPayloadError,
} from '../src/errors';

describe('errors', () => {
  it('all custom errors extend ProconIpError', () => {
    expect(new BadCredentialsError('x')).toBeInstanceOf(ProconIpError);
    expect(new BadStatusCodeError('x', 500, 'Server Error')).toBeInstanceOf(ProconIpError);
    expect(new RequestTimeoutError('x', 1000)).toBeInstanceOf(ProconIpError);
    expect(new InvalidPayloadError('x')).toBeInstanceOf(ProconIpError);
  });

  it('BadStatusCodeError carries status and statusText', () => {
    const e = new BadStatusCodeError('msg', 503, 'Service Unavailable');
    expect(e.status).toBe(503);
    expect(e.statusText).toBe('Service Unavailable');
  });

  it('RequestTimeoutError carries timeoutMs', () => {
    const e = new RequestTimeoutError('msg', 2500);
    expect(e.timeoutMs).toBe(2500);
  });

  it('error names match their class names', () => {
    expect(new BadCredentialsError('m').name).toBe('BadCredentialsError');
    expect(new BadStatusCodeError('m', 500, 's').name).toBe('BadStatusCodeError');
    expect(new RequestTimeoutError('m', 100).name).toBe('RequestTimeoutError');
    expect(new InvalidPayloadError('m').name).toBe('InvalidPayloadError');
  });
});
