/**
 * @luxwallet/safe — Safe smart-account custody seam.
 *
 * A thin CLIENT over the Safe Transaction Service REST API (the same service
 * the Safe{Wallet} UI uses), NOT a reimplementation of the Safe contracts.
 * This device holds one owner key (in the wallet keychain); multisig
 * execution, threshold, and nonce all live on-chain / in the tx-service. The
 * seam lets the wallet engine treat a `type: 'safe'` account as a first-class
 * account whose "signature" is a proposed/queued Safe transaction.
 *
 * Endpoints (Safe Transaction Service v1):
 *   GET  /api/v1/safes/{address}/                    -> {owners, threshold, nonce}
 *   POST /api/v1/safes/{address}/multisig-transactions/  (propose)
 *   GET  /api/v1/safes/{address}/multisig-transactions/  (list/status)
 *
 * NOTE: the tx-service uses `/api/v1/...`; that is the UPSTREAM Safe service's
 * own path, consumed as an external dependency (not a Lux/Hanzo surface).
 */

export interface SafeInfo {
  address: string;
  owners: string[];
  threshold: number;
  nonce: number;
}

export interface SafeTxProposal {
  to: string;
  value: string;
  data?: string;
  /** Owner address proposing/confirming. */
  sender: string;
  /** Owner's signature over the Safe tx hash. */
  signature: string;
  /** Safe nonce for the transaction. */
  nonce: number;
}

export interface SafeTxStatus {
  safeTxHash: string;
  confirmations: number;
  confirmationsRequired: number;
  isExecuted: boolean;
  transactionHash?: string;
}

/** The Safe-custody contract the wallet engine composes for `type: 'safe'`. */
export interface SafeCustody {
  /** Read a Safe's owners/threshold/nonce. */
  getInfo(safeAddress: string): Promise<SafeInfo>;
  /** Propose (or confirm) a multisig transaction. Returns its Safe tx hash. */
  proposeTransaction(safeAddress: string, tx: SafeTxProposal): Promise<string>;
  /** Poll a proposed transaction's confirmation/execution status. */
  getStatus(safeAddress: string, safeTxHash: string): Promise<SafeTxStatus>;
}

export interface SafeCustodyConfig {
  /** Safe Transaction Service base URL for the chain, e.g.
   * "https://safe-transaction-mainnet.safe.global". */
  txServiceUrl: string;
  /** EIP-155 chain id the service is bound to. */
  chainId: number;
  /** Injected fetch (defaults to global fetch). */
  fetch?: typeof fetch;
}

/**
 * Build a thin Safe custody client bound to a Transaction Service. Composition
 * over reimplementation: contract logic stays in Safe; this speaks its REST
 * contract and carries the single owner-key signature the wallet produces.
 */
export function createSafeCustody(config: SafeCustodyConfig): SafeCustody {
  const base = config.txServiceUrl.replace(/\/+$/, '');
  const doFetch = config.fetch ?? fetch;

  const json = async <T>(res: Response, ctx: string): Promise<T> => {
    if (!res.ok) throw new Error(`@luxwallet/safe: ${ctx} -> HTTP ${res.status}`);
    return (await res.json()) as T;
  };

  return {
    async getInfo(safeAddress) {
      const res = await doFetch(`${base}/api/v1/safes/${safeAddress}/`);
      const r = await json<{ owners: string[]; threshold: number; nonce: number }>(
        res,
        'getInfo',
      );
      return { address: safeAddress, owners: r.owners, threshold: r.threshold, nonce: r.nonce };
    },

    async proposeTransaction(safeAddress, tx) {
      const res = await doFetch(
        `${base}/api/v1/safes/${safeAddress}/multisig-transactions/`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            to: tx.to,
            value: tx.value,
            data: tx.data ?? null,
            nonce: tx.nonce,
            sender: tx.sender,
            signature: tx.signature,
          }),
        },
      );
      const r = await json<{ safeTxHash: string }>(res, 'proposeTransaction');
      return r.safeTxHash;
    },

    async getStatus(safeAddress, safeTxHash) {
      const res = await doFetch(
        `${base}/api/v1/multisig-transactions/${safeTxHash}/`,
      );
      const r = await json<{
        safeTxHash: string;
        confirmations?: unknown[];
        confirmationsRequired: number;
        isExecuted: boolean;
        transactionHash?: string;
      }>(res, 'getStatus');
      return {
        safeTxHash: r.safeTxHash,
        confirmations: r.confirmations?.length ?? 0,
        confirmationsRequired: r.confirmationsRequired,
        isExecuted: r.isExecuted,
        transactionHash: r.transactionHash,
      };
    },
  };
}
