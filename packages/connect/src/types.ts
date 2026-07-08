/**
 * @luxwallet/connect — core types.
 *
 * One vocabulary across every chain. A wallet on any chain produces a
 * {@link SignedProof}; the server verifies it with one verify call. The login
 * message itself is chain-agnostic (CAIP-122 "Sign-In-With-X").
 */

/** Supported chain families. Values, not places — namespaced by this union. */
export type Chain =
  | 'evm'
  | 'solana'
  | 'bitcoin'
  | 'ton'
  | 'xrp'
  | 'polkadot'
  | 'cardano';

export const CHAINS: readonly Chain[] = [
  'evm',
  'solana',
  'bitcoin',
  'ton',
  'xrp',
  'polkadot',
  'cardano',
];

/**
 * Signature scheme used to produce a proof. The verifier dispatches on this,
 * not on {@link Chain}, so a chain could in principle offer more than one.
 */
export type SignatureScheme =
  | 'secp256k1-eip191'
  | 'ed25519'
  | 'bip322'
  | 'ton-proof'
  | 'secp256k1-xrpl'
  | 'ed25519-xrpl'
  | 'sr25519'
  | 'ed25519-substrate'
  | 'ecdsa-substrate'
  | 'ed25519-cardano';

/**
 * A connected wallet account. `publicKey` is required where the address is not
 * recoverable from the signature (Solana, TON, XRP).
 */
export interface Account {
  chain: Chain;
  /** Canonical address string for the chain (checksum EVM, base58 Solana, etc.). */
  address: string;
  /** Raw public key, hex (no 0x) or base64 — needed by ed25519/XRPL verifiers. */
  publicKey?: string;
  /** Identifier of the wallet that produced it (e.g. 'metamask', 'phantom'). */
  walletId: string;
  /** CAIP-2 chain id of the specific network, when known (e.g. 'eip155:1'). */
  caip2?: string;
}

/**
 * The login challenge a server asks a wallet to sign. Mirrors EIP-4361 /
 * CAIP-122 fields. The server mints `nonce` and stores it until verification.
 */
export interface LoginChallenge {
  /** RFC 4501 dnsauthority that is requesting the signing (e.g. 'hanzo.id'). */
  domain: string;
  /** RFC 3986 URI referring to the resource that is the subject of the signing. */
  uri: string;
  /** Human-readable assertion the user signs (one line, no newlines). */
  statement?: string;
  /** Server-minted single-use nonce (>= 8 alphanumerics). */
  nonce: string;
  /** ISO-8601 issuance time. */
  issuedAt: string;
  /** ISO-8601 expiry; after this the proof is rejected. */
  expirationTime?: string;
  /** ISO-8601 not-before; before this the proof is rejected. */
  notBefore?: string;
  /** Opaque request correlation id. */
  requestId?: string;
  /** Version of the message spec; '1' for CAIP-122/EIP-4361. */
  version?: string;
  /** Resource URIs the sign-in grants access to. */
  resources?: string[];
}

/** What a wallet hands back after signing — everything a server needs to verify. */
export interface SignedProof {
  chain: Chain;
  scheme: SignatureScheme;
  /** Address that signed (must match the address embedded in `message`). */
  address: string;
  /** Public key (hex/base64) when required by the scheme. */
  publicKey?: string;
  /** The exact UTF-8 string that was signed (the rendered CAIP-122 message). */
  message: string;
  /** Signature bytes, hex (0x-prefixed allowed) or base64 per scheme. */
  signature: string;
  /** Scheme-specific extra fields (e.g. TON proof envelope, BTC address type). */
  extra?: Record<string, unknown>;
}
