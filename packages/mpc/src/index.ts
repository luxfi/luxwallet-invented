/**
 * @luxwallet/mpc — threshold-custody seam over luxfi/mpc.
 *
 * This is a thin CLIENT over the real MPC daemon HTTP API (`mpcd`,
 * github.com/luxfi/mpc, `pkg/api` + `pkg/client`), NOT a reimplementation of
 * threshold crypto. Key shares never leave the cluster; no single node — and
 * certainly no wallet — ever holds a whole private key. The wallet asks the
 * cluster to keygen (t-of-n) and to sign a digest; the signature comes back
 * assembled.
 *
 * Wire format mirrors the daemon:
 *   POST /v1/keygen  {wallet_id, key_type}            -> {public_key, address}
 *   POST /v1/sign    {wallet_id, key_type, message}   -> {r, s, v, signature}
 *
 * `message` is a 0x-hex digest (the already-hashed payload). `key_type` selects
 * the protocol family: `secp256k1` (CGGMP21 ECDSA) for EVM, `ed25519` (FROST),
 * or a post-quantum lattice family (`pulsar` = ML-DSA-65 threshold).
 */

export type MpcKeyType =
  | 'secp256k1'
  | 'ed25519'
  | 'bls'
  | 'sr25519'
  | 'pulsar'
  | 'corona';

export interface MpcWallet {
  walletId: string;
  /** 0x-hex public key returned by the cluster. */
  publicKey: string;
  /** Chain address derived from the public key (EVM checksum for secp256k1). */
  address: string;
  keyType: MpcKeyType;
}

export interface MpcSignature {
  /** 0x-hex r component (ECDSA/EdDSA). */
  r: string;
  /** 0x-hex s component. */
  s: string;
  /** Recovery id (secp256k1). */
  v?: number;
  /** 0x-hex full serialized signature (r‖s‖v where applicable). */
  signature: string;
}

/**
 * The threshold-custody contract the wallet engine composes for `type: 'mpc'`
 * accounts. An implementation NEVER exposes a private key — only a co-operative
 * signature over a digest.
 */
export interface MpcCustody {
  /** Create (or return) a t-of-n wallet in the cluster. */
  createWallet(walletId: string, keyType?: MpcKeyType): Promise<MpcWallet>;
  /** Threshold-sign a 0x-hex digest for an existing wallet. */
  sign(walletId: string, digestHex: string, keyType?: MpcKeyType): Promise<MpcSignature>;
  /** Fetch a wallet's public key / address without signing. */
  getWallet(walletId: string): Promise<MpcWallet | null>;
}

export interface MpcCustodyConfig {
  /** MPC daemon API base URL, e.g. "https://mpc.hanzo.ai" or "http://localhost:9800". */
  apiUrl: string;
  /** Bearer token for the internal API (never a raw key). */
  authToken?: string;
  /** Default key type when a call omits one. Defaults to secp256k1 (EVM). */
  defaultKeyType?: MpcKeyType;
  /** Injected fetch (defaults to global fetch). */
  fetch?: typeof fetch;
}

interface KeygenResponse {
  public_key: string;
  address: string;
}
interface SignResponse {
  r?: string;
  s?: string;
  v?: number;
  signature: string;
}

/**
 * Build a thin MPC custody client bound to a daemon URL. Composition over
 * reimplementation: all threshold crypto happens in luxfi/mpc; this only
 * speaks its HTTP contract.
 */
export function createMpcCustody(config: MpcCustodyConfig): MpcCustody {
  const base = config.apiUrl.replace(/\/+$/, '');
  const doFetch = config.fetch ?? fetch;
  const defaultKeyType = config.defaultKeyType ?? 'secp256k1';

  const headers = (): Record<string, string> => {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (config.authToken) h['authorization'] = `Bearer ${config.authToken}`;
    return h;
  };

  const post = async <T>(path: string, body: unknown): Promise<T> => {
    const res = await doFetch(`${base}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`@luxwallet/mpc: POST ${path} -> HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  };

  return {
    async createWallet(walletId, keyType = defaultKeyType) {
      const r = await post<KeygenResponse>('/v1/keygen', {
        wallet_id: walletId,
        key_type: keyType,
      });
      return { walletId, publicKey: r.public_key, address: r.address, keyType };
    },

    async sign(walletId, digestHex, keyType = defaultKeyType) {
      const r = await post<SignResponse>('/v1/sign', {
        wallet_id: walletId,
        key_type: keyType,
        message: digestHex,
      });
      return { r: r.r ?? '', s: r.s ?? '', v: r.v, signature: r.signature };
    },

    async getWallet(walletId) {
      const res = await doFetch(
        `${base}/v1/keys/${encodeURIComponent(walletId)}`,
        { headers: headers() },
      );
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`@luxwallet/mpc: GET /v1/keys -> HTTP ${res.status}`);
      }
      const r = (await res.json()) as KeygenResponse & { key_type?: MpcKeyType };
      return {
        walletId,
        publicKey: r.public_key,
        address: r.address,
        keyType: r.key_type ?? defaultKeyType,
      };
    },
  };
}
