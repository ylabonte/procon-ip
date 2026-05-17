import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { Logger, LogLevel } from '../src/logger';

describe('Logger', () => {
  // Vitest 4: `vi.spyOn`'s overloads no longer collapse cleanly through
  // `ReturnType<typeof vi.spyOn>`. Spell the spied signature out explicitly.
  let logSpy: MockInstance<typeof console.log>;
  let errorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to INFO level when no argument is passed', () => {
    const log = new Logger();
    log.debug('hidden');
    log.info('shown');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('INFO: shown');
  });

  it('honours the constructor log level', () => {
    const log = new Logger(LogLevel.DEBUG);
    log.debug('debug-msg');
    log.info('info-msg');
    log.warn('warn-msg');
    expect(logSpy).toHaveBeenCalledTimes(3);
  });

  it('error() writes to console.error and respects the level', () => {
    const log = new Logger(LogLevel.ERROR);
    log.warn('hidden');
    log.error('boom');
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('ERROR: boom');
  });

  it('setLogLevel mutates the active level', () => {
    const log = new Logger(LogLevel.ERROR);
    log.warn('hidden-1');
    log.setLogLevel(LogLevel.WARN);
    log.warn('shown');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('WARNING: shown');
  });

  it('emits an ISO 8601 timestamp prefix', () => {
    const log = new Logger(LogLevel.INFO);
    log.info('with-time');
    const out = String(logSpy.mock.calls[0]?.[0]);
    expect(out).toMatch(/^\(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\)/);
  });
});
