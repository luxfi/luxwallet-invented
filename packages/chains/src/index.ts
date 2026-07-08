/**
 * @luxwallet/chains — the chain registry.
 *
 * One source of truth for every Lux-ecosystem chain. The same data is
 * emitted to chains.json so native Kotlin / Swift clients read identical
 * metadata.
 */
export type {
  ChainEntry,
  ChainFamily,
  BuilderStatus,
  NativeAsset,
  Bip44,
} from './types.js';

import { CHAINS } from './registry.js';
import type { ChainEntry } from './types.js';

export { CHAINS };

/** Index by registry id for O(1) lookup. Built once at module load. */
const byId = new Map<string, ChainEntry>(CHAINS.map((c) => [c.id, c]));
/** Index by EIP-155 chain id (EVM chains only). */
const byEvmChainId = new Map<number, ChainEntry>(
  CHAINS.flatMap((c) => (c.evmChainId === undefined ? [] : [[c.evmChainId, c]])),
);

/** Every chain in the registry. */
export function allChains(): readonly ChainEntry[] {
  return CHAINS;
}

/**
 * Look up a chain by its registry id (e.g. "lux-c-mainnet") or by its
 * EIP-155 chain id (e.g. 96369). Returns undefined if unknown — callers
 * decide whether an unknown chain is fatal.
 */
export function getChain(id: string | number): ChainEntry | undefined {
  return typeof id === 'number' ? byEvmChainId.get(id) : byId.get(id);
}

/** Filter to a single VM family. */
export function chainsByFamily(family: ChainEntry['family']): readonly ChainEntry[] {
  return CHAINS.filter((c) => c.family === family);
}
