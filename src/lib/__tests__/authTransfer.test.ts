import { describe, expect, it } from 'vitest';
import { isTransferMessage } from '../../sync/authTransferMessage';

describe('authentication handoff message validation', () => {
  const source = {} as Window;
  const origin = 'https://jakaro-league-hadiassayra.firebaseapp.com';
  const type = 'jakaro-request-local-tournament';
  const nonce = 'one-time-transfer';
  const event = { source, origin, data: { type, nonce } };
  it('accepts the requested window with its expected origin and nonce', () => {
    expect(isTransferMessage(event, source, origin, type, nonce)).toBe(true);
  });
  it('rejects another window even on the same origin', () => {
    expect(isTransferMessage({ ...event, source: {} as Window }, source, origin, type, nonce)).toBe(false);
    expect(isTransferMessage(event, null, origin, type, nonce)).toBe(false);
  });
  it('rejects forged origins and stale transfer nonces', () => {
    expect(isTransferMessage({ ...event, origin: 'https://example.com' }, source, origin, type, nonce)).toBe(false);
    expect(isTransferMessage({ ...event, data: { type, nonce: 'old-transfer' } }, source, origin, type, nonce)).toBe(false);
  });
  it('ignores unrelated and malformed messages', () => {
    expect(isTransferMessage({ ...event, data: null }, source, origin, type, nonce)).toBe(false);
    expect(isTransferMessage({ ...event, data: { type: 'unrelated', nonce } }, source, origin, type, nonce)).toBe(false);
  });
});
