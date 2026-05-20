import { afterEach, beforeEach, vi } from 'vitest';

import { logger, registerTransport, clearTransports } from '@/lib/alerts/logger';

describe('logger', () => {
  beforeEach(() => {
    clearTransports();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearTransports();
  });

  it('writes to console.log at info', () => {
    logger.info('hello', { quoteId: 'q-1' });
    expect(console.log).toHaveBeenCalledWith('[info]', 'hello', { quoteId: 'q-1' });
  });

  it('writes to console.warn at warn', () => {
    logger.warn('soft fail');
    expect(console.warn).toHaveBeenCalledWith('[warn]', 'soft fail');
  });

  it('writes to console.error at error and passes the original error value', () => {
    const err = new Error('boom');
    logger.error('mutation failed', err, { invoiceId: 'i-1' });
    expect(console.error).toHaveBeenCalledWith('[error]', 'mutation failed', err, { invoiceId: 'i-1' });
  });

  it('forwards records to registered transports', () => {
    const t = vi.fn();
    registerTransport(t);
    logger.info('ping', { a: 1 });
    expect(t).toHaveBeenCalledWith('info', 'ping', { a: 1 }, undefined);
  });

  it('returns an unsubscribe fn from registerTransport', () => {
    const t = vi.fn();
    const off = registerTransport(t);
    off();
    logger.info('after unsubscribe');
    expect(t).not.toHaveBeenCalled();
  });

  it('child loggers merge defaults into every record', () => {
    const t = vi.fn();
    registerTransport(t);
    const flow = logger.child({ flow: 'invoice.markPaid', invoiceId: 'i-1' });
    flow.info('charging stripe', { amount: 100 });
    expect(t).toHaveBeenCalledWith(
      'info',
      'charging stripe',
      { flow: 'invoice.markPaid', invoiceId: 'i-1', amount: 100 },
      undefined,
    );
  });
});
