/**
 * @luxwallet/core — the one native, omnichain, post-quantum wallet engine for
 * Hanzo / Lux / Zoo Desktop.
 *
 * Headless and brand-neutral. A consumer wires it up once with a
 * {@link WalletEngineConfig} (crypto loader + keychain + chain provider) and
 * gets the full create / import / reveal / balance / send store. UI adapters
 * (@hanzo/ui/wallet etc.) live in the app layer over this store.
 */
export { createLuxWallet } from './store.js';
export type { LuxWalletState, LuxWalletStore } from './store.js';

export { tauriKeychain, memoryKeychain } from './keychain.js';
export type { TauriKeychainBridge } from './keychain.js';

export { createSiww } from './siww.js';
export type { SiwwConfig, SiwwParams, SiwwResult } from './siww.js';

export { useWeb3Session } from './session.js';
export type { Web3Session } from './session.js';

export { toHex, fromHex } from './crypto.js';

export type {
  WalletType,
  LuxAccount,
  Balance,
  SendParams,
  Status,
  Keychain,
  RpcClientLike,
  ChainProvider,
  WalletEngineConfig,
} from './types.js';
