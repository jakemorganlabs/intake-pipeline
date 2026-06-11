import { describe, it, expect } from 'vitest';
import { deriveIdempotencyKey } from './idempotency.js';

describe('deriveIdempotencyKey', () => {
  it('returns sub: prefix when provider submission id is present', () => {
    const key = deriveIdempotencyKey('evt_abc123', 'A@B.COM', 'f1', '2026-01-01');
    expect(key).toBe('sub:evt_abc123');
  });

  it('returns drv: hash fallback when provider id is absent', () => {
    const key = deriveIdempotencyKey(null, 'a@b.com', 'f1', '2026-01-01');
    expect(key.startsWith('drv:')).toBe(true);
    expect(key.length).toBe(4 + 64); // 'drv:' + sha256 hex
  });

  it('produces same key for identical inputs', () => {
    const key1 = deriveIdempotencyKey(null, 'a@b.com', 'f1', '2026-01-01');
    const key2 = deriveIdempotencyKey(null, 'a@b.com', 'f1', '2026-01-01');
    expect(key1).toBe(key2);
  });

  it('normalizes email case and whitespace', () => {
    const key1 = deriveIdempotencyKey(null, '  A@B.COM  ', 'f1', '2026-01-01');
    const key2 = deriveIdempotencyKey(null, 'a@b.com', 'f1', '2026-01-01');
    expect(key1).toBe(key2);
  });

  it('produces different key for different email', () => {
    const key1 = deriveIdempotencyKey(null, 'a@b.com', 'f1', '2026-01-01');
    const key2 = deriveIdempotencyKey(null, 'c@d.com', 'f1', '2026-01-01');
    expect(key1).not.toBe(key2);
  });

  it('handles undefined provider id same as null', () => {
    const key = deriveIdempotencyKey(undefined, 'x@y.com', 'f1', '2026-01-01');
    expect(key.startsWith('drv:')).toBe(true);
  });
});
