/**
 * The chain registry. ONE source of truth for the Lux Wallet.
 *
 * EVM chain ids and network ids are pinned per the authoritative defs at
 * lux/wallet/pkgs/chains/src/index.ts and the sovereign-L1 model:
 *
 *   Lux C-Chain     mainnet 96369   testnet 96368   DEX 96370
 *   Zoo             mainnet 200200  testnet 200201
 *   Hanzo           mainnet 36963   testnet 36964
 *   Sparkle Pony    mainnet 36911   testnet 36910
 *   Pars            mainnet 494949  testnet 7071
 *
 * Plus the non-EVM Lux primary-network families as registry entries
 * (X-Chain UTXO, P-Chain platform, Q-Chain PQ-EVM, Z-Chain ZK). Their
 * `@luxwallet/tx` builders are `todo`; the registry still owns their
 * metadata so native code and the keyring see one list.
 *
 * EVM chains derive on BIP-44 coinType 60 (the EVM convention, so seeds
 * stay compatible with every EVM wallet). The native Lux families derive
 * on coinType 9000 (HIP-0077). The keyring reads `bip44` from here — it
 * does not hardcode paths.
 */
import type { ChainEntry } from './types.js';

/** BIP-44 coin type for EVM chains (Ethereum convention). */
const EVM_COIN_TYPE = 60;
// SLIP-44 coin types for the non-EVM bridge families.
const BTC_COIN_TYPE = 0;
const SOLANA_COIN_TYPE = 501;
const TON_COIN_TYPE = 607;
const XRP_COIN_TYPE = 144;
const DOT_COIN_TYPE = 354;
const ADA_COIN_TYPE = 1815;
/** BIP-44 coin type for native Lux families (HIP-0077). */
const LUX_COIN_TYPE = 9000;
/** Standard EVM external account-0 path. */
const evmPath = `m/44'/${EVM_COIN_TYPE}'/0'/0/0`;

/** EVM L1 entry helper — collapses the repeated EVM shape. */
function evm(args: {
  id: string;
  name: string;
  evmChainId: number;
  symbol: string;
  mainnet: boolean;
}): ChainEntry {
  return {
    id: args.id,
    name: args.name,
    family: 'evm',
    evmChainId: args.evmChainId,
    // Sovereign-L1 model: networkId == evmChainId for ecosystem L1s.
    networkId: args.evmChainId,
    mainnet: args.mainnet,
    testnet: !args.mainnet,
    rpcRoute: String(args.evmChainId),
    bip44: { coinType: EVM_COIN_TYPE, path: evmPath },
    nativeAsset: { symbol: args.symbol, decimals: 18 },
    builderStatus: 'ready',
  };
}

export const CHAINS: readonly ChainEntry[] = [
  // ── Lux C-Chain (primary-network EVM) ────────────────────────────
  evm({ id: 'lux-c-mainnet', name: 'Lux C-Chain', evmChainId: 96369, symbol: 'LUX', mainnet: true }),
  evm({ id: 'lux-c-testnet', name: 'Lux C-Chain Testnet', evmChainId: 96368, symbol: 'LUX', mainnet: false }),
  evm({ id: 'lux-dex', name: 'Lux DEX Chain', evmChainId: 96370, symbol: 'LUX', mainnet: true }),
  // ── Zoo L1 ───────────────────────────────────────────────────────
  evm({ id: 'zoo-mainnet', name: 'Zoo', evmChainId: 200200, symbol: 'ZOO', mainnet: true }),
  evm({ id: 'zoo-testnet', name: 'Zoo Testnet', evmChainId: 200201, symbol: 'ZOO', mainnet: false }),
  // ── Hanzo L1 ─────────────────────────────────────────────────────
  evm({ id: 'hanzo-mainnet', name: 'Hanzo', evmChainId: 36963, symbol: 'AI', mainnet: true }),
  evm({ id: 'hanzo-testnet', name: 'Hanzo Testnet', evmChainId: 36964, symbol: 'AI', mainnet: false }),
  // ── Sparkle Pony L1 ──────────────────────────────────────────────
  evm({ id: 'spc-mainnet', name: 'Sparkle Pony', evmChainId: 36911, symbol: 'SPC', mainnet: true }),
  evm({ id: 'spc-testnet', name: 'Sparkle Pony Testnet', evmChainId: 36910, symbol: 'SPC', mainnet: false }),
  // ── Pars L1 ──────────────────────────────────────────────────────
  evm({ id: 'pars-mainnet', name: 'Pars', evmChainId: 494949, symbol: 'PARS', mainnet: true }),
  evm({ id: 'pars-testnet', name: 'Pars Testnet', evmChainId: 7071, symbol: 'PARS', mainnet: false }),
  // ── External EVM bridge endpoints (Lux Bridge supportedChains) ───
  // The Lux Bridge (bridge.lux.network /.well-known/bridge.json) bridges to/from
  // these public EVM chains. They are first-class wallet chains — the `evm`
  // login + tx builder are chain-agnostic. rpcRoute is the EIP-155 id; an app
  // may point these at a public RPC instead of the brand gateway.
  evm({ id: 'ethereum', name: 'Ethereum', evmChainId: 1, symbol: 'ETH', mainnet: true }),
  evm({ id: 'arbitrum', name: 'Arbitrum One', evmChainId: 42161, symbol: 'ETH', mainnet: true }),
  evm({ id: 'base', name: 'Base', evmChainId: 8453, symbol: 'ETH', mainnet: true }),
  evm({ id: 'polygon', name: 'Polygon', evmChainId: 137, symbol: 'POL', mainnet: true }),
  evm({ id: 'optimism', name: 'Optimism', evmChainId: 10, symbol: 'ETH', mainnet: true }),
  evm({ id: 'avalanche', name: 'Avalanche C-Chain', evmChainId: 43114, symbol: 'AVAX', mainnet: true }),
  // ── Major EVM L1/L2s (broad multichain coverage) ─────────────────
  // The evm login + tx builder are chain-agnostic; these are first-class
  // wallet chains. An app narrows the active set via its brand `chains`.
  evm({ id: 'bnb', name: 'BNB Smart Chain', evmChainId: 56, symbol: 'BNB', mainnet: true }),
  evm({ id: 'gnosis', name: 'Gnosis', evmChainId: 100, symbol: 'XDAI', mainnet: true }),
  evm({ id: 'celo', name: 'Celo', evmChainId: 42220, symbol: 'CELO', mainnet: true }),
  evm({ id: 'fantom', name: 'Fantom', evmChainId: 250, symbol: 'FTM', mainnet: true }),
  evm({ id: 'linea', name: 'Linea', evmChainId: 59144, symbol: 'ETH', mainnet: true }),
  evm({ id: 'scroll', name: 'Scroll', evmChainId: 534352, symbol: 'ETH', mainnet: true }),
  evm({ id: 'zksync', name: 'zkSync Era', evmChainId: 324, symbol: 'ETH', mainnet: true }),
  evm({ id: 'mantle', name: 'Mantle', evmChainId: 5000, symbol: 'MNT', mainnet: true }),
  evm({ id: 'blast', name: 'Blast', evmChainId: 81457, symbol: 'ETH', mainnet: true }),
  // ── Non-EVM Lux primary-network families (builders: todo) ────────
  // Registry entries only. networkId 1 == Lux mainnet primary network
  // (convention-fixed). rpcRoute is the gateway chain alias, not an EIP-155 id.
  {
    id: 'lux-x-mainnet',
    name: 'Lux X-Chain',
    family: 'utxo',
    networkId: 1,
    mainnet: true,
    testnet: false,
    rpcRoute: 'X',
    bip44: { coinType: LUX_COIN_TYPE, path: `m/44'/${LUX_COIN_TYPE}'/0'` },
    nativeAsset: { symbol: 'LUX', decimals: 9 },
    builderStatus: 'todo',
  },
  {
    id: 'lux-p-mainnet',
    name: 'Lux P-Chain',
    family: 'platform',
    networkId: 1,
    mainnet: true,
    testnet: false,
    rpcRoute: 'P',
    bip44: { coinType: LUX_COIN_TYPE, path: `m/44'/${LUX_COIN_TYPE}'/0'` },
    nativeAsset: { symbol: 'LUX', decimals: 9 },
    builderStatus: 'todo',
  },
  {
    id: 'lux-q-mainnet',
    name: 'Lux Q-Chain',
    family: 'pqevm',
    networkId: 1,
    mainnet: true,
    testnet: false,
    rpcRoute: 'Q',
    // PQ accounts derive under the ML-DSA branch (coinType 9000); see
    // @luxwallet/keyring. Path here is the family root the keyring extends.
    bip44: { coinType: LUX_COIN_TYPE, path: `m/44'/${LUX_COIN_TYPE}'/0'` },
    nativeAsset: { symbol: 'LUX', decimals: 18 },
    builderStatus: 'todo',
  },
  {
    id: 'lux-z-mainnet',
    name: 'Lux Z-Chain',
    family: 'zk',
    networkId: 1,
    mainnet: true,
    testnet: false,
    rpcRoute: 'Z',
    bip44: { coinType: LUX_COIN_TYPE, path: `m/44'/${LUX_COIN_TYPE}'/0'` },
    nativeAsset: { symbol: 'LUX', decimals: 18 },
    builderStatus: 'todo',
  },
  // ── Non-EVM external bridge families (Lux Bridge supportedChains) ─
  // Login is handled by @luxwallet/connect (btc/sol/ton/xrp; dot pending
  // sr25519). tx-building is `todo` — these are registry entries so the wallet
  // recognises, holds, and bridges these assets.
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    family: 'utxo',
    networkId: 0,
    mainnet: true,
    testnet: false,
    rpcRoute: 'btc',
    bip44: { coinType: BTC_COIN_TYPE, path: `m/84'/${BTC_COIN_TYPE}'/0'` },
    nativeAsset: { symbol: 'BTC', decimals: 8 },
    builderStatus: 'todo',
  },
  {
    id: 'solana',
    name: 'Solana',
    family: 'solana',
    networkId: 0,
    mainnet: true,
    testnet: false,
    rpcRoute: 'sol',
    bip44: { coinType: SOLANA_COIN_TYPE, path: `m/44'/${SOLANA_COIN_TYPE}'/0'` },
    nativeAsset: { symbol: 'SOL', decimals: 9 },
    builderStatus: 'todo',
  },
  {
    id: 'ton',
    name: 'TON',
    family: 'ton',
    networkId: 0,
    mainnet: true,
    testnet: false,
    rpcRoute: 'ton',
    bip44: { coinType: TON_COIN_TYPE, path: `m/44'/${TON_COIN_TYPE}'/0'` },
    nativeAsset: { symbol: 'TON', decimals: 9 },
    builderStatus: 'todo',
  },
  {
    id: 'xrp',
    name: 'XRP Ledger',
    family: 'xrp',
    networkId: 0,
    mainnet: true,
    testnet: false,
    rpcRoute: 'xrp',
    bip44: { coinType: XRP_COIN_TYPE, path: `m/44'/${XRP_COIN_TYPE}'/0'` },
    nativeAsset: { symbol: 'XRP', decimals: 6 },
    builderStatus: 'todo',
  },
  {
    id: 'polkadot',
    name: 'Polkadot',
    family: 'substrate',
    networkId: 0,
    mainnet: true,
    testnet: false,
    rpcRoute: 'dot',
    bip44: { coinType: DOT_COIN_TYPE, path: `m/44'/${DOT_COIN_TYPE}'/0'` },
    nativeAsset: { symbol: 'DOT', decimals: 10 },
    builderStatus: 'todo',
  },
  {
    id: 'cardano',
    name: 'Cardano',
    family: 'cardano',
    networkId: 0,
    mainnet: true,
    testnet: false,
    rpcRoute: 'ada',
    // Cardano uses CIP-1852 (m/1852'/1815'/...) but the registry path is the
    // family root the keyring extends; login is ed25519 via @luxwallet/connect.
    bip44: { coinType: ADA_COIN_TYPE, path: `m/1852'/${ADA_COIN_TYPE}'/0'` },
    nativeAsset: { symbol: 'ADA', decimals: 6 },
    builderStatus: 'todo',
  },
];
