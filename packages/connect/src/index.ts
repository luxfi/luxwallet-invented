/**
 * @luxwallet/connect (SIWx core).
 *
 * The CANONICAL pure Sign-In-With-X core: the CAIP-122 message
 * builder/parser, the challenge/nonce helpers, and the shared chain
 * vocabulary. Browser wallet connectors and per-chain crypto verifiers are
 * NOT in this leaf — a signer signs with @luxfi/crypto (real Lux
 * secp256k1/keccak) and verifies server-side via IAM, so those heavy,
 * extension-bound modules (and their @noble/bs58/viem deps) stay out.
 */
export { buildSiwxMessage, parseSiwxMessage } from './caip122.js';
export type { ParsedSiwx, BuildParams } from './caip122.js';
export { generateNonce, newChallenge } from './nonce.js';
export type { NewChallengeOpts } from './nonce.js';
export { CHAINS } from './types.js';
export type {
  Chain,
  SignatureScheme,
  Account,
  LoginChallenge,
  SignedProof,
} from './types.js';
