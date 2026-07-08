/**
 * Sign-In-With-Wallet (SIWx / CAIP-122) against Hanzo/Lux/Zoo IAM.
 *
 * The one client-side login flow, mirroring the IAM SPA's canonical path and
 * HIP-0111:
 *
 *   1. GET  {iam}/v1/iam/web3/nonce?chain=evm&address=0x…  → LoginChallenge
 *   2. buildSiwxMessage(challenge, address)                → CAIP-122 string
 *   3. EIP-191 personal_sign of that string with @luxfi/crypto (keccak+secp256k1)
 *   4. POST {iam}/v1/iam/web3/verify {…proof}              → { userId } + session
 *
 * The SERVER mints the challenge; the CLIENT renders the exact message it signs
 * and returns it verbatim — the server re-parses that message and burns the
 * nonce. No browser round-trip, no wallet extension: the desktop signs with its
 * own local key.
 *
 * Brand-neutral: IAM base URL and default org/app are injected via
 * {@link SiwwConfig} — core reads no brand config directly.
 */
import type { LuxCrypto } from '@luxfi/crypto';
import { buildSiwxMessage } from '@luxwallet/connect/caip122';
import type { LoginChallenge } from '@luxwallet/connect';

import { fromHex, toHex } from './crypto.js';
import type { Keychain } from './types.js';

/** IAM's standard response envelope. */
interface IamEnvelope<T = unknown> {
  status: 'ok' | 'error';
  msg?: string;
  data?: T;
  data3?: unknown;
}

export interface SiwwResult {
  ok: boolean;
  userId?: string;
  address: string;
  reason?: string;
}

export interface SiwwConfig {
  /** IAM base URL, e.g. "https://hanzo.id" (no trailing slash required). */
  iamBaseUrl: string;
  /** Loads the @luxfi/crypto WASM engine. */
  crypto: () => Promise<LuxCrypto>;
  /** Keychain holding the account's signing key. */
  keychain: Keychain;
  /** Default IAM organization (brand), e.g. "hanzo". */
  defaultOrganization: string;
  /** Default IAM application, e.g. "app". */
  defaultApplication?: string;
}

export interface SiwwParams {
  accountId: string;
  address: string;
  organization?: string;
  application?: string;
  method?: 'signup' | 'login';
}

/** Concatenate byte arrays. */
function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/**
 * EIP-191 personal_sign over `message` with the account's secp256k1 key, using
 * the @luxfi/crypto engine. Returns a 65-byte 0x-hex r‖s‖v signature with v in
 * {27,28} (IAM's verifier accepts 27/28 or 0/1).
 */
async function personalSign(
  lux: LuxCrypto,
  privateKeyHex: string,
  message: string,
): Promise<string> {
  const msgBytes = new TextEncoder().encode(message);
  // NOTE: preserved byte-for-byte from the desktop's original siww.ts. Standard
  // EIP-191 prepends a 0x19 control byte before "Ethereum Signed Message:"; this
  // construction (matching the shipped client + IAM verifier) does not. Flagged
  // for adversarial review — do not change without re-verifying the IAM verify
  // path end-to-end.
  const prefix = new TextEncoder().encode(`Ethereum Signed Message:\n${msgBytes.length}`);
  const digest = lux.keccak256(concatBytes(prefix, msgBytes));
  const sig = lux.secp256k1.sign(fromHex(privateKeyHex), digest);
  const out = new Uint8Array(65);
  out.set(sig.slice(0, 64));
  out[64] = (sig[64] as number) < 27 ? (sig[64] as number) + 27 : (sig[64] as number);
  return toHex(out);
}

/**
 * Build the sign-in flow bound to an IAM instance. Returns
 * `signInWithWallet(params)` — the one login call each desktop wraps with its
 * brand config.
 */
export function createSiww(config: SiwwConfig) {
  const iam = config.iamBaseUrl.replace(/\/+$/, '');

  return async function signInWithWallet(params: SiwwParams): Promise<SiwwResult> {
    const organization = params.organization ?? config.defaultOrganization;
    const application = params.application ?? config.defaultApplication ?? 'app';
    const method = params.method ?? 'signup';
    const address = params.address;

    const pk = await config.keychain.getPrivateKey(params.accountId);
    if (!pk) {
      return { ok: false, address, reason: 'no signing key for this wallet' };
    }

    // 1. Nonce / challenge.
    const nonceUrl = `${iam}/v1/iam/web3/nonce?chain=evm&address=${encodeURIComponent(address)}`;
    const nonceRes = await fetch(nonceUrl, { method: 'GET', credentials: 'include' });
    if (!nonceRes.ok) {
      return { ok: false, address, reason: `nonce HTTP ${nonceRes.status}` };
    }
    const nonceBody = (await nonceRes.json()) as IamEnvelope<LoginChallenge>;
    if (nonceBody.status !== 'ok' || !nonceBody.data) {
      return { ok: false, address, reason: nonceBody.msg ?? 'nonce rejected' };
    }
    const challenge = nonceBody.data;

    // 2. Render the CAIP-122 message and 3. sign it (EIP-191).
    const lux = await config.crypto();
    const message = buildSiwxMessage({ challenge, address, chain: 'evm' });
    const signature = await personalSign(lux, pk, message);

    // 4. Verify.
    const verifyRes = await fetch(`${iam}/v1/iam/web3/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization,
        application,
        method,
        chain: 'evm',
        scheme: 'secp256k1-eip191',
        address,
        message,
        signature,
      }),
    });
    if (!verifyRes.ok) {
      return { ok: false, address, reason: `verify HTTP ${verifyRes.status}` };
    }
    const verifyBody = (await verifyRes.json()) as IamEnvelope<string>;
    if (verifyBody.status !== 'ok') {
      return { ok: false, address, reason: verifyBody.msg ?? 'verify rejected' };
    }
    return { ok: true, address, userId: verifyBody.data };
  };
}
