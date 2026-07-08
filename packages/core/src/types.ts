/**
 * @luxwallet/core — public value types.
 *
 * Brand-neutral: no hanzo/zoo/lux literals. The chain list, gateway, and brand
 * are injected by the consumer through {@link WalletEngineConfig}.
 */
import type { ChainEntry } from '@luxwallet/chains';
import type { LuxCrypto } from '@luxfi/crypto';

/**
 * How an account's keys are held.
 *  - `local-hd-pq`  HD seed on device (keychain), classical secp256k1 + PQ
 *                   ML-DSA-65 identity. The default.
 *  - `mpc`          threshold key, no single device holds the whole secret
 *                   (@luxwallet/mpc over lux/mpc). Signing is co-operative.
 *  - `safe`         a Safe smart-account (@luxwallet/safe); this device is an
 *                   owner key.
 */
export type WalletType = 'local-hd-pq' | 'mpc' | 'safe';

export interface LuxAccount {
  id: string;
  label: string;
  type: WalletType;
  /** EIP-55 checksummed EVM address. */
  evmAddress: string;
  /** 0x-hex ML-DSA-65 public key (empty for private-key-only imports). */
  pqPublicKey: string;
  /** Lux NodeID derived from the PQ identity (empty for key-only imports). */
  pqNodeId: string;
  /** True when a BIP-39 recovery phrase backs this account. */
  hasMnemonic: boolean;
  createdAt: number;
}

export interface Balance {
  wei: string;
  formatted: string;
  symbol: string;
  error?: string;
}

export interface SendParams {
  accountId: string;
  chainId: number;
  to: string;
  amountEther: string;
  data?: string;
}

export type Status = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Secret-at-rest seam. Mnemonics/private keys NEVER touch persisted app state.
 * The consumer wires an OS-keychain-backed impl (see {@link tauriKeychain}) or
 * an in-process one for tests ({@link memoryKeychain}).
 */
export interface Keychain {
  seal(id: string, secrets: { mnemonic?: string; privateKey: string }): Promise<void>;
  getMnemonic(id: string): Promise<string | null>;
  getPrivateKey(id: string): Promise<string | null>;
  drop(id: string): Promise<void>;
}

/** The minimal EVM JSON-RPC surface the store needs. Satisfied by @luxwallet/rpc's RpcClient. */
export interface RpcClientLike {
  call<T = unknown>(
    req: { method: string; params?: unknown[] },
    init?: { signal?: AbortSignal },
  ): Promise<T>;
  getTransactionCount(address: string): Promise<number>;
}

/**
 * The brand's chain + RPC wiring, injected. This is the ONE seam through which
 * a brand's network selection, gateway, and per-chain overrides reach the
 * headless engine — core never reads brand config directly.
 */
export interface ChainProvider {
  chainById(id: string | number): ChainEntry | undefined;
  defaultChainId(): number;
  rpcClient(chainId: number): RpcClientLike;
}

/** Everything the headless wallet engine needs, injected by the consumer. */
export interface WalletEngineConfig {
  /** Loads the @luxfi/crypto WASM engine (once, idempotent). App-owned so each
   * bundler resolves the .wasm asset its own way. */
  crypto: () => Promise<LuxCrypto>;
  /** Secret-at-rest storage. */
  keychain: Keychain;
  /** Brand chain + RPC wiring. */
  chains: ChainProvider;
  /** localStorage key for the persisted (non-secret) slice. Default 'lux-wallet'. */
  persistName?: string;
}
