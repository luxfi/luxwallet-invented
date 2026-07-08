/**
 * @luxwallet/bridge — native Lux Bridge seam.
 *
 * A thin CLIENT over the Lux Bridge (bridge.lux.network), NOT a
 * reimplementation of the 2-of-3 MPC bridge. It reads the bridge's published
 * capability document and speaks its transfer API so the wallet can move
 * assets across the chains in `@luxwallet/chains`. Actual custody + atomic
 * cross-chain finality happen in the MPC bridge (composed via `@luxwallet/mpc`
 * on the anchor side); this client only quotes and initiates.
 *
 * Capability discovery is the published well-known document:
 *   GET https://<bridge>/.well-known/bridge.json  -> { supportedChains, ... }
 */

export interface BridgeChain {
  /** EIP-155 chain id (or chain alias for non-EVM). */
  chainId: number | string;
  name: string;
  /** Bridge contract / anchor address on this chain, when applicable. */
  bridgeAddress?: string;
}

export interface BridgeCapabilities {
  supportedChains: BridgeChain[];
  /** Bridge protocol/version string from the well-known doc. */
  version?: string;
}

export interface BridgeQuote {
  fromChainId: number | string;
  toChainId: number | string;
  asset: string;
  amount: string;
  /** Estimated amount received after bridge fees, same decimals as `amount`. */
  estimatedReceived: string;
  feeAmount: string;
  /** Opaque quote id to pass to `initiate`. */
  quoteId: string;
}

export interface BridgeTransferRequest {
  quoteId: string;
  /** Sender address on the source chain. */
  from: string;
  /** Recipient address on the destination chain. */
  to: string;
}

export interface BridgeTransfer {
  transferId: string;
  status: 'pending' | 'sourced' | 'finalized' | 'failed';
  /** Source-chain tx hash once the deposit is observed. */
  sourceTxHash?: string;
  /** Destination-chain tx hash once released. */
  destTxHash?: string;
}

/** The bridge contract the wallet composes for cross-chain transfers. */
export interface BridgeClient {
  /** Read the bridge's published supported-chains capability document. */
  capabilities(): Promise<BridgeCapabilities>;
  /** Quote a cross-chain transfer. */
  quote(params: {
    fromChainId: number | string;
    toChainId: number | string;
    asset: string;
    amount: string;
  }): Promise<BridgeQuote>;
  /** Initiate a quoted transfer. Returns the tracking record. */
  initiate(req: BridgeTransferRequest): Promise<BridgeTransfer>;
  /** Poll a transfer's status. */
  status(transferId: string): Promise<BridgeTransfer>;
}

export interface BridgeConfig {
  /** Bridge base URL, e.g. "https://bridge.lux.network". */
  bridgeUrl: string;
  /** Injected fetch (defaults to global fetch). */
  fetch?: typeof fetch;
}

/**
 * Build a thin Lux Bridge client. Composition over reimplementation: the MPC
 * threshold custody and finality stay in the bridge service; this speaks its
 * HTTP contract.
 */
export function createBridge(config: BridgeConfig): BridgeClient {
  const base = config.bridgeUrl.replace(/\/+$/, '');
  const doFetch = config.fetch ?? fetch;

  const getJson = async <T>(path: string, ctx: string): Promise<T> => {
    const res = await doFetch(`${base}${path}`);
    if (!res.ok) throw new Error(`@luxwallet/bridge: ${ctx} -> HTTP ${res.status}`);
    return (await res.json()) as T;
  };

  const postJson = async <T>(path: string, body: unknown, ctx: string): Promise<T> => {
    const res = await doFetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`@luxwallet/bridge: ${ctx} -> HTTP ${res.status}`);
    return (await res.json()) as T;
  };

  return {
    capabilities: () =>
      getJson<BridgeCapabilities>('/.well-known/bridge.json', 'capabilities'),
    quote: (params) => postJson<BridgeQuote>('/v1/bridge/quote', params, 'quote'),
    initiate: (req) => postJson<BridgeTransfer>('/v1/bridge/transfer', req, 'initiate'),
    status: (transferId) =>
      getJson<BridgeTransfer>(
        `/v1/bridge/transfer/${encodeURIComponent(transferId)}`,
        'status',
      ),
  };
}
