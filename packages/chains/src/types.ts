/**
 * Chain registry types — one shape for every Lux-ecosystem chain,
 * EVM and non-EVM alike. Native consumers (Kotlin/Swift) read the
 * emitted chains.json and rebuild the same shape, so keep this file
 * the single authority for field names and semantics.
 */

/**
 * VM family a chain runs. Determines which tx builder in `@luxwallet/tx`
 * applies and what address/signing model the keyring uses.
 *
 *  - `evm`      EIP-155 EVM chain (C-Chain and every ecosystem L1).
 *  - `utxo`     X-Chain style UTXO chain (Lux X-Chain).
 *  - `platform` P-Chain style staking/platform chain (Lux P-Chain).
 *  - `zk`       Z-Chain (ZK) — privacy/rollup family.
 *  - `pqevm`    Q-Chain — post-quantum EVM.
 */
export type ChainFamily =
  | 'evm'
  | 'utxo'
  | 'platform'
  | 'zk'
  | 'pqevm'
  | 'solana'
  | 'ton'
  | 'xrp'
  | 'substrate'
  | 'cardano';

/**
 * Build status of the `@luxwallet/tx` builder for this chain.
 *  - `ready` a real, tested unsigned-tx builder exists (EVM today).
 *  - `todo`  registry entry only; builder is a typed stub.
 */
export type BuilderStatus = 'ready' | 'todo';

/** Native asset of a chain (gas / staking token). */
export interface NativeAsset {
  symbol: string;
  decimals: number;
}

/**
 * BIP-44 derivation metadata. `coinType` is the registered coin type
 * (Lux = 9000, pinned at HIP-0077). `path` is the canonical account-0
 * external path for the family; the keyring derives leaves under it.
 */
export interface Bip44 {
  coinType: number;
  path: string;
}

/**
 * A single chain in the registry.
 *
 * `id` is the registry key — stable, human-readable, and the same
 * string native code keys on. For EVM chains `evmChainId` is the
 * EIP-155 chain id used on the wire; `id` is NOT the EIP-155 number so
 * mainnet/testnet/variant chains never collide as registry keys.
 */
export interface ChainEntry {
  /** Stable registry key, e.g. "lux-c-mainnet". */
  id: string;
  /** Display name, e.g. "Lux C-Chain". */
  name: string;
  /** VM family — selects tx builder + signing model. */
  family: ChainFamily;
  /** EIP-155 chain id. Present iff the chain speaks EVM JSON-RPC. */
  evmChainId?: number;
  /**
   * Lux primary network id. For sovereign L1s this equals the EVM
   * chain id (one id per env per L1). For the Lux primary network it
   * is the convention-fixed 1/2/3/1337.
   */
  networkId: number;
  /** False for testnets/devnets. */
  mainnet: boolean;
  /** True for testnets (mutually exclusive with mainnet here). */
  testnet: boolean;
  /**
   * RPC route segment used by `@luxwallet/rpc` to build the gateway
   * URL: `https://<gateway>/v1/rpc/<route>`. For EVM chains this is the
   * EIP-155 chain id as a string; for non-EVM chains it is the chain
   * alias the gateway exposes (e.g. "X", "P").
   */
  rpcRoute: string;
  /** BIP-44 derivation metadata. */
  bip44: Bip44;
  /** Native gas/staking asset. */
  nativeAsset: NativeAsset;
  /** Tx-builder readiness. `todo` = registry-only stub. */
  builderStatus: BuilderStatus;
}
