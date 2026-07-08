/**
 * Pure byte/hex helpers shared by the store and siww.
 *
 * The crypto ENGINE itself (@luxfi/crypto WASM) is injected by the consumer
 * via {@link WalletEngineConfig.crypto} — core never imports the WASM binary
 * so it stays bundler-agnostic. This module only holds pure helpers.
 */

/** Lowercase 0x-hex of a byte array. */
export function toHex(bytes: Uint8Array): string {
  let s = '0x';
  for (let i = 0; i < bytes.length; i += 1) {
    s += (bytes[i] as number).toString(16).padStart(2, '0');
  }
  return s;
}

/** Parse 0x-hex (or bare hex) into bytes. */
export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
