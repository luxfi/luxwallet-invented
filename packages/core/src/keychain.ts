/**
 * Secret-at-rest storage for wallet material.
 *
 * Mnemonics and private keys NEVER touch persisted app state (plain
 * localStorage). They live only in the OS keychain, reached through the
 * host's `secure_storage_*` commands (macOS Keychain / Windows Credential
 * Manager / libsecret). Where the host bridge is unavailable (browser
 * dev/tests) they stay in a process-memory map for the session — still never
 * written to disk in the clear.
 *
 * The host bridge is INJECTED (`invoke` + `isAvailable`) so core carries no
 * Tauri/desktop dependency; any of the three desktops passes its own bridge.
 */
import type { Keychain } from './types.js';

const NS = 'luxwallet';

const mnemonicKey = (id: string) => `${NS}:${id}:mnemonic`;
const privateKeyKey = (id: string) => `${NS}:${id}:privateKey`;

/** In-process fallback keychain (tests, non-desktop runtimes). Never persisted. */
export function memoryKeychain(): Keychain {
  const memory = new Map<string, string>();
  return {
    async seal(id, secrets) {
      if (secrets.mnemonic) memory.set(mnemonicKey(id), secrets.mnemonic);
      memory.set(privateKeyKey(id), secrets.privateKey);
    },
    async getMnemonic(id) {
      return memory.get(mnemonicKey(id)) ?? null;
    },
    async getPrivateKey(id) {
      return memory.get(privateKeyKey(id)) ?? null;
    },
    async drop(id) {
      memory.delete(mnemonicKey(id));
      memory.delete(privateKeyKey(id));
    },
  };
}

export interface TauriKeychainBridge {
  /** Host `invoke` — routes to the `secure_storage_*` commands. */
  invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  /** True when the host bridge is live; else the memory fallback is used. */
  isAvailable: () => boolean;
}

/**
 * OS-keychain-backed keychain over the host's `secure_storage_{set,get,delete}`
 * commands. Falls back to an in-process map whenever `isAvailable()` is false,
 * so the same wallet code runs in the browser dev server.
 */
export function tauriKeychain(bridge: TauriKeychainBridge): Keychain {
  const memory = new Map<string, string>();

  const put = async (key: string, value: string): Promise<void> => {
    if (bridge.isAvailable()) {
      await bridge.invoke('secure_storage_set', { key, value });
    } else {
      memory.set(key, value);
    }
  };

  const read = async (key: string): Promise<string | null> => {
    if (bridge.isAvailable()) {
      return bridge.invoke<string | null>('secure_storage_get', { key });
    }
    return memory.get(key) ?? null;
  };

  const del = async (key: string): Promise<void> => {
    if (bridge.isAvailable()) {
      await bridge.invoke('secure_storage_delete', { key });
    } else {
      memory.delete(key);
    }
  };

  return {
    async seal(id, secrets) {
      if (secrets.mnemonic) await put(mnemonicKey(id), secrets.mnemonic);
      await put(privateKeyKey(id), secrets.privateKey);
    },
    getMnemonic: (id) => read(mnemonicKey(id)),
    getPrivateKey: (id) => read(privateKeyKey(id)),
    async drop(id) {
      await del(mnemonicKey(id));
      await del(privateKeyKey(id));
    },
  };
}
