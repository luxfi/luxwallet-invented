/**
 * The Lux Wallet engine — the ONE wallet store for Hanzo/Lux/Zoo Desktop.
 *
 * Self-contained and node-independent: create / list / reveal / balance / send
 * all run locally against the @luxfi/crypto WASM engine and the brand RPC
 * gateway. Headless and brand-neutral: the chain list, gateway, keychain, and
 * crypto loader are all INJECTED via {@link WalletEngineConfig}, so the exact
 * same engine backs all three desktops.
 *
 * Crypto:
 *   - EVM keys      → @luxfi/crypto keys.deriveSecp256k1 (BIP-44 m/44'/60'/0'/0/0,
 *                     bit-identical to ethers / MetaMask so imports round-trip).
 *   - PQ identity   → @luxfi/crypto keys.serviceIdentity → ML-DSA-65 (FIPS-204).
 *   - tx / sign     → @luxfi/crypto secp256k1 over the keccak256 digest.
 *   - ethers        → ONLY RLP / EIP-1559 encoding + BIP-39 mnemonic words
 *                     (no second signer; the private key never leaves keychain
 *                     except to sign).
 */
import type { LuxCrypto } from '@luxfi/crypto';
import { ethers } from 'ethers';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { fromHex, toHex } from './crypto.js';
import type {
  Balance,
  LuxAccount,
  SendParams,
  Status,
  WalletEngineConfig,
  WalletType,
} from './types.js';

export interface LuxWalletState {
  accounts: LuxAccount[];
  selectedAccountId: string | null;
  selectedChainId: number;
  status: Status;
  error: string | null;

  init: () => Promise<void>;
  createWallet: (opts?: {
    label?: string;
    type?: WalletType;
  }) => Promise<{ account: LuxAccount; mnemonic: string }>;
  importMnemonic: (
    mnemonic: string,
    opts?: { label?: string; type?: WalletType },
  ) => Promise<LuxAccount>;
  importPrivateKey: (
    privateKey: string,
    opts?: { label?: string },
  ) => Promise<LuxAccount>;
  removeWallet: (id: string) => Promise<void>;
  revealMnemonic: (id: string) => Promise<string | null>;
  selectAccount: (id: string) => void;
  selectChain: (chainId: number) => void;
  getBalance: (chainId: number, address: string) => Promise<Balance>;
  sendEvm: (params: SendParams) => Promise<{ hash: string }>;
}

/** keccak256(pub[1:])[-20:] → EIP-55 checksummed address from a 65-byte pubkey. */
function addressFromPubkey(lux: LuxCrypto, pub65: Uint8Array): string {
  const hash = lux.keccak256(pub65.slice(1));
  return ethers.getAddress(toHex(hash.slice(-20)));
}

/**
 * Build the headless wallet store for a brand. Everything brand-specific is in
 * `config`; the store logic is identical across every consumer.
 */
export function createLuxWallet(config: WalletEngineConfig) {
  const { crypto: getLuxCrypto, keychain, chains } = config;

  return create<LuxWalletState>()(
    devtools(
      persist(
        (set, get) => ({
          accounts: [],
          selectedAccountId: null,
          selectedChainId: chains.defaultChainId(),
          status: 'idle',
          error: null,

          init: async () => {
            if (get().status === 'ready' || get().status === 'loading') return;
            set({ status: 'loading', error: null });
            try {
              await getLuxCrypto();
              set({ status: 'ready' });
            } catch (e) {
              set({
                status: 'error',
                error: e instanceof Error ? e.message : String(e),
              });
            }
          },

          createWallet: async (opts) => {
            const lux = await getLuxCrypto();
            const mnemonic = ethers.Wallet.createRandom().mnemonic?.phrase ?? '';
            if (!mnemonic) throw new Error('failed to generate recovery phrase');

            const d = lux.keys.deriveSecp256k1(mnemonic);
            const si = lux.keys.serviceIdentity(mnemonic, 'wallet/0');
            const account: LuxAccount = {
              id: globalThis.crypto.randomUUID(),
              label: opts?.label ?? `Wallet ${get().accounts.length + 1}`,
              type: opts?.type ?? 'local-hd-pq',
              evmAddress: ethers.getAddress(toHex(d.address)),
              pqPublicKey: toHex(si.publicKey),
              pqNodeId: si.nodeId,
              hasMnemonic: true,
              createdAt: Date.now(),
            };
            await keychain.seal(account.id, {
              mnemonic,
              privateKey: toHex(d.privateKey),
            });
            set((s) => ({
              accounts: [...s.accounts, account],
              selectedAccountId: account.id,
              status: 'ready',
            }));
            return { account, mnemonic };
          },

          importMnemonic: async (mnemonic, opts) => {
            const lux = await getLuxCrypto();
            const phrase = mnemonic.trim().replace(/\s+/g, ' ');
            // Validate BIP-39 before deriving (throws on a bad phrase).
            ethers.Mnemonic.fromPhrase(phrase);
            const d = lux.keys.deriveSecp256k1(phrase);
            const si = lux.keys.serviceIdentity(phrase, 'wallet/0');
            const account: LuxAccount = {
              id: globalThis.crypto.randomUUID(),
              label: opts?.label ?? `Wallet ${get().accounts.length + 1}`,
              type: opts?.type ?? 'local-hd-pq',
              evmAddress: ethers.getAddress(toHex(d.address)),
              pqPublicKey: toHex(si.publicKey),
              pqNodeId: si.nodeId,
              hasMnemonic: true,
              createdAt: Date.now(),
            };
            await keychain.seal(account.id, {
              mnemonic: phrase,
              privateKey: toHex(d.privateKey),
            });
            set((s) => ({
              accounts: [...s.accounts, account],
              selectedAccountId: account.id,
              status: 'ready',
            }));
            return account;
          },

          importPrivateKey: async (privateKey, opts) => {
            const lux = await getLuxCrypto();
            const pkHex = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            const sk = fromHex(pkHex);
            if (sk.length !== 32) throw new Error('private key must be 32 bytes');
            const pub = lux.secp256k1.getPublicKey(sk, false);
            const account: LuxAccount = {
              id: globalThis.crypto.randomUUID(),
              label: opts?.label ?? `Wallet ${get().accounts.length + 1}`,
              type: 'local-hd-pq',
              evmAddress: addressFromPubkey(lux, pub),
              pqPublicKey: '',
              pqNodeId: '',
              hasMnemonic: false,
              createdAt: Date.now(),
            };
            await keychain.seal(account.id, { privateKey: pkHex });
            set((s) => ({
              accounts: [...s.accounts, account],
              selectedAccountId: account.id,
              status: 'ready',
            }));
            return account;
          },

          removeWallet: async (id) => {
            await keychain.drop(id);
            set((s) => {
              const accounts = s.accounts.filter((a) => a.id !== id);
              return {
                accounts,
                selectedAccountId:
                  s.selectedAccountId === id
                    ? (accounts[0]?.id ?? null)
                    : s.selectedAccountId,
              };
            });
          },

          revealMnemonic: (id) => keychain.getMnemonic(id),

          selectAccount: (id) => set({ selectedAccountId: id }),
          selectChain: (chainId) => set({ selectedChainId: chainId }),

          getBalance: async (chainId, address) => {
            const chain = chains.chainById(chainId);
            const decimals = chain?.nativeAsset.decimals ?? 18;
            const symbol = chain?.nativeAsset.symbol ?? 'ETH';
            try {
              const hex = await chains.rpcClient(chainId).call<string>({
                method: 'eth_getBalance',
                params: [address, 'latest'],
              });
              const wei = BigInt(hex);
              return {
                wei: wei.toString(),
                formatted: ethers.formatUnits(wei, decimals),
                symbol,
              };
            } catch (e) {
              return {
                wei: '0',
                formatted: '0',
                symbol,
                error: e instanceof Error ? e.message : String(e),
              };
            }
          },

          sendEvm: async ({ accountId, chainId, to, amountEther, data }) => {
            const lux = await getLuxCrypto();
            const account = get().accounts.find((a) => a.id === accountId);
            if (!account) throw new Error('unknown account');
            const pkHex = await keychain.getPrivateKey(accountId);
            if (!pkHex) throw new Error('no signing key available for this wallet');

            const from = account.evmAddress;
            const toAddr = ethers.getAddress(to);
            const value = ethers.parseEther(amountEther);
            const client = chains.rpcClient(chainId);

            const nonce = await client.getTransactionCount(from);
            const [gasHex, gasPriceHex] = await Promise.all([
              client.call<string>({
                method: 'eth_estimateGas',
                params: [{ from, to: toAddr, value: ethers.toBeHex(value) }],
              }),
              client.call<string>({ method: 'eth_gasPrice', params: [] }),
            ]);
            const gasLimit = BigInt(gasHex);
            const gasPrice = BigInt(gasPriceHex);
            const maxPriorityFeePerGas = ethers.parseUnits('1.5', 'gwei');
            const maxFeePerGas = gasPrice * BigInt(2) + maxPriorityFeePerGas;

            const tx = ethers.Transaction.from({
              type: 2,
              chainId,
              nonce,
              to: toAddr,
              value,
              gasLimit,
              maxFeePerGas,
              maxPriorityFeePerGas,
              data: data ?? '0x',
            });

            const digest = ethers.getBytes(tx.unsignedHash);
            const sig = lux.secp256k1.sign(fromHex(pkHex), digest);

            // Self-check: the recovered signer must be this account.
            const recovered = lux.secp256k1.recover(digest, sig);
            if (addressFromPubkey(lux, recovered).toLowerCase() !== from.toLowerCase()) {
              throw new Error('signature self-check failed');
            }

            const recid = (sig[64] as number) >= 27 ? (sig[64] as number) - 27 : (sig[64] as number);
            tx.signature = ethers.Signature.from({
              r: toHex(sig.slice(0, 32)),
              s: toHex(sig.slice(32, 64)),
              yParity: (recid & 1) as 0 | 1,
            });

            const hash = await client.call<string>({
              method: 'eth_sendRawTransaction',
              params: [tx.serialized],
            });
            return { hash };
          },
        }),
        {
          name: config.persistName ?? 'lux-wallet',
          // Secrets live in the OS keychain (keychain seam), NEVER in persisted
          // state. Only public account metadata + selection is stored.
          partialize: (s) => ({
            accounts: s.accounts,
            selectedAccountId: s.selectedAccountId,
            selectedChainId: s.selectedChainId,
          }),
        },
      ),
    ),
  );
}

/** The bound store type `createLuxWallet` returns. */
export type LuxWalletStore = ReturnType<typeof createLuxWallet>;
