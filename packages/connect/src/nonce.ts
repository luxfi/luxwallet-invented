/**
 * Single-use login nonces. The server mints one per challenge, stores it, and
 * burns it on verify so a captured proof cannot be replayed.
 */
import type { LoginChallenge } from './types.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Cryptographically-random alphanumeric nonce (default 16 chars, ~95 bits). */
export function generateNonce(length = 16): string {
  if (length < 8) {
    throw new Error('nonce: length must be >= 8 (CAIP-122 minimum)');
  }
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[(bytes[i] as number) % ALPHABET.length];
  }
  return out;
}

export interface NewChallengeOpts {
  domain: string;
  uri: string;
  statement?: string;
  nonce?: string;
  requestId?: string;
  resources?: string[];
  /** Override "now" for deterministic tests (epoch ms). */
  now?: number;
  /** Challenge lifetime in seconds (default 600). */
  ttlSeconds?: number;
}

/** Build a {@link LoginChallenge} with sane defaults. */
export function newChallenge(opts: NewChallengeOpts): LoginChallenge {
  const nowMs = opts.now ?? Date.now();
  const issuedAt = new Date(nowMs).toISOString();
  const ttl = opts.ttlSeconds ?? 600;
  const expirationTime = new Date(nowMs + ttl * 1000).toISOString();
  return {
    domain: opts.domain,
    uri: opts.uri,
    statement: opts.statement,
    nonce: opts.nonce ?? generateNonce(),
    issuedAt,
    expirationTime,
    version: '1',
    requestId: opts.requestId,
    resources: opts.resources,
  };
}
