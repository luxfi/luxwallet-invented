# @luxwallet — the one omnichain post-quantum wallet stack

Single source of truth for the `@luxwallet/*` npm scope. Extracted from
hanzo-desktop's `src/lib/lux-wallet/` (the PQ, node-independent, omnichain
wallet) so all three desktops (hanzo / lux / zoo) share ONE wallet engine.

Publish target: `github.com/luxwallet/*` (org does NOT exist yet — must be
created before first publish; see "Publishing").

## Packages (npm-workspaces monorepo)

| Package | Role | Deps |
|---|---|---|
| `@luxwallet/chains` | Chain registry — one source of truth. Emits `chains.json` for native (Kotlin/Swift). | none |
| `@luxwallet/rpc` | Gateway RPC client. `https://<gateway>/v1/rpc/<route>`. No `/api/`. | chains |
| `@luxwallet/connect` | SIWx / CAIP-122 message core (builder/parser + nonce). Pure. | none |
| `@luxwallet/core` | **Headless, brand-neutral wallet engine.** create/import/reveal/balance/send store (secp256k1 + ML-DSA-65). | chains, connect · peer: ethers, zustand, @luxfi/crypto |
| `@luxwallet/mpc` | Threshold-custody seam — thin client over luxfi/mpc (`/v1/keygen`,`/v1/sign`). | none |
| `@luxwallet/safe` | Safe smart-account custody seam — thin Safe Transaction Service client. | none |
| `@luxwallet/bridge` | Native Lux Bridge seam — thin client over bridge.lux.network (`/.well-known/bridge.json`). | none |

## Design — decomplected

`@luxwallet/core` is the ONE wallet. It is **headless** and **brand-neutral**:
zero hanzo/zoo/lux literals. Everything brand/host/platform-specific is
injected once through `WalletEngineConfig`:

- `crypto: () => Promise<LuxCrypto>` — the app loads the @luxfi/crypto WASM its
  own way (each bundler resolves the `.wasm` asset differently).
- `keychain: Keychain` — secret-at-rest seam. `tauriKeychain({invoke,isAvailable})`
  (OS keychain via host `secure_storage_*`) or `memoryKeychain()` (tests).
  Secrets NEVER touch persisted store state.
- `chains: ChainProvider` — `{ chainById, defaultChainId, rpcClient }`, wired
  from the brand's network selection + `@luxwallet/chains` + `@luxwallet/rpc`.

UI adapters (`@hanzo/ui/wallet` WalletMenu/NetworkSwitcher) live in the APP
layer over the store — core stays UI-framework-agnostic.

Custody seams (`mpc`/`safe`/`bridge`) are interfaces + thin real clients over
the existing lux stack — composition, not reimplementation. They define the
contract a future `createWallet({type:'mpc'|'safe'})` composes.

## Build

```
npm install          # workspaces; pulls @luxfi/crypto + ethers/zustand for core's tsc
npm run build        # tsc --build all packages -> dist/
```

TS is strict + `verbatimModuleSyntax` + `isolatedModules`. Cross-package refs
use TS project references (rpc→chains, core→chains+connect).

## Consumed by the desktops

Each desktop declares `file:` deps on `@luxwallet/{core,chains,rpc}` pointing at
`../../luxwallet/packages/*` and injects its brand config. `@luxfi/crypto` is a
peer, provided by the app (vendored WASM). Vite `resolve.dedupe` keeps a single
`zustand`/`ethers` instance.

The app's `src/lib/lux-wallet/` becomes a THIN brand/network wiring over
`@luxwallet/core` — `store.ts` = `createLuxWallet({...})`, `siww.ts` =
`createSiww({...})`, `chains.ts` builds the `ChainProvider`.

## Publishing (BLOCKED — needs org)

`github.com/luxwallet` does not exist. Before `npm publish`:
1. Create the `luxwallet` GitHub org.
2. Create the `@luxwallet` npm org (or publish under it if reserved).
3. CI/CD builds + publishes (never local docker). Versions stay 0.x until 1.0.
