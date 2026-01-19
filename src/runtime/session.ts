import { randomBytes, createHash } from "crypto";
import type { AxiomConfig } from "../core/config.ts";
import type { SessionMetadata } from "../attestation/types.ts";

/**
 * Session management for Axiom Core.
 * Tracks execution sessions and binds attestation evidence to specific executions.
 */

/**
 * Generate a cryptographically random session ID.
 * @returns Hex-encoded 128-bit random session ID
 */
export function generateSessionId(): string {
  const bytes = randomBytes(16); // 128 bits
  return bytes.toString("hex");
}

/**
 * Generate a cryptographically random nonce.
 * @returns Hex-encoded 256-bit random nonce
 */
export function generateNonce(): string {
  const bytes = randomBytes(32); // 256 bits
  return bytes.toString("hex");
}

/**
 * Compute hash of AxiomConfig for binding.
 * @param config - The Axiom configuration
 * @returns Hex-encoded SHA-256 hash of canonical config
 */
export function hashConfig(config: AxiomConfig): string {
  // Create canonical representation of config
  const canonical = JSON.stringify(
    {
      enclave: config.enclave,
      platform: config.platform ?? null,
      policyVersion: config.policyVersion,
      securityTier: config.securityTier,
    },
    Object.keys({
      enclave: null,
      platform: null,
      policyVersion: null,
      securityTier: null,
    }).sort()
  );

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Session represents a single execution of the transformation pipeline.
 * Tracks metadata and binds attestation evidence to this specific execution.
 */
export class Session {
  /**
   * Unique session identifier (128-bit random, hex-encoded).
   */
  readonly sessionId: string;

  /**
   * Hash of the configuration used (SHA-256, hex-encoded).
   */
  readonly configHash: string;

  /**
   * Random nonce for freshness (256-bit, hex-encoded).
   */
  readonly nonce: string;

  /**
   * Timestamp when session was created (milliseconds since Unix epoch).
   */
  readonly createdAt: number;

  /**
   * Security tier for this session.
   */
  readonly securityTier: "standard" | "attested";

  /**
   * Whether enclave execution was used.
   */
  private enclaveUsed: boolean = false;

  /**
   * Platform type if enclave was used.
   */
  private platform?: "sev-snp";

  /**
   * Output hash after transformation (set during execution).
   */
  private outputHash?: string;

  /**
   * Whether the session has been finalized.
   */
  private finalized: boolean = false;

  /**
   * Create a new session.
   * @param config - The Axiom configuration
   * @private Use Session.create() instead
   */
  private constructor(config: AxiomConfig) {
    this.sessionId = generateSessionId();
    this.configHash = hashConfig(config);
    this.nonce = generateNonce();
    this.createdAt = Date.now();
    this.securityTier = config.securityTier;

    if (config.platform) {
      this.platform = config.platform.type;
    }
  }

  /**
   * Create a new session for an execution.
   * @param config - The Axiom configuration
   * @returns New session instance
   */
  static create(config: AxiomConfig): Session {
    return new Session(config);
  }

  /**
   * Mark that enclave execution was used for this session.
   * @param platform - The TEE platform type
   */
  setEnclaveUsed(platform: "sev-snp"): void {
    if (this.finalized) {
      throw new Error("Cannot modify finalized session");
    }
    this.enclaveUsed = true;
    this.platform = platform;
  }

  /**
   * Set the output hash for this session.
   * @param hash - Hex-encoded SHA-256 hash of transformed context
   */
  setOutputHash(hash: string): void {
    if (this.finalized) {
      throw new Error("Cannot modify finalized session");
    }
    if (!/^[0-9a-f]{64}$/i.test(hash)) {
      throw new Error("Invalid output hash format (expected 64 hex characters)");
    }
    this.outputHash = hash;
  }

  /**
   * Get the output hash (if set).
   * @returns Output hash or undefined
   */
  getOutputHash(): string | undefined {
    return this.outputHash;
  }

  /**
   * Finalize the session (no further modifications allowed).
   * @returns Session metadata for attestation binding
   */
  finalize(): SessionMetadata {
    if (this.finalized) {
      throw new Error("Session already finalized");
    }

    this.finalized = true;

    return {
      sessionId: this.sessionId,
      configHash: this.configHash,
      createdAt: this.createdAt,
      securityTier: this.securityTier,
      enclaveUsed: this.enclaveUsed,
      platform: this.platform,
    };
  }

  /**
   * Get session metadata without finalizing.
   * @returns Current session metadata
   */
  getMetadata(): SessionMetadata {
    return {
      sessionId: this.sessionId,
      configHash: this.configHash,
      createdAt: this.createdAt,
      securityTier: this.securityTier,
      enclaveUsed: this.enclaveUsed,
      platform: this.platform,
    };
  }

  /**
   * Check if session is finalized.
   */
  isFinalized(): boolean {
    return this.finalized;
  }

  /**
   * Get session age in milliseconds.
   */
  getAge(): number {
    return Date.now() - this.createdAt;
  }

  /**
   * Check if session is expired.
   * @param maxAge - Maximum age in milliseconds (default: 5 minutes)
   * @returns True if session is older than maxAge
   */
  isExpired(maxAge: number = 5 * 60 * 1000): boolean {
    return this.getAge() > maxAge;
  }

  /**
   * Create binding data for attestation.
   * Combines session_id, config_hash, and output_hash.
   * @returns Buffer containing binding data for attestation report
   */
  createBindingData(): Buffer {
    if (!this.outputHash) {
      throw new Error("Output hash not set - cannot create binding data");
    }

    // Concatenate: session_id (16 bytes) || config_hash (32 bytes) || output_hash (32 bytes)
    const sessionIdBytes = Buffer.from(this.sessionId, "hex");
    const configHashBytes = Buffer.from(this.configHash, "hex");
    const outputHashBytes = Buffer.from(this.outputHash, "hex");

    return Buffer.concat([sessionIdBytes, configHashBytes, outputHashBytes]);
  }

  /**
   * Create hash of binding data for embedding in attestation report.
   * @returns SHA-256 hash of binding data (32 bytes for REPORT_DATA field)
   */
  createReportData(): Buffer {
    const bindingData = this.createBindingData();
    const timestamp = Buffer.alloc(8);
    timestamp.writeBigUInt64BE(BigInt(this.createdAt), 0);

    // Hash: SHA-256(binding_data || timestamp)
    const hash = createHash("sha256");
    hash.update(bindingData);
    hash.update(timestamp);

    return hash.digest();
  }

  /**
   * Verify that binding data matches this session.
   * Used during attestation verification.
   * @param reportData - The REPORT_DATA field from attestation report
   * @param outputHash - The actual output hash to verify
   * @returns True if binding is valid
   */
  verifyBinding(reportData: Buffer, outputHash: string): boolean {
    // Temporarily set output hash for verification
    const originalOutputHash = this.outputHash;
    this.outputHash = outputHash;

    try {
      const expected = this.createReportData();
      return reportData.equals(expected);
    } finally {
      // Restore original state
      this.outputHash = originalOutputHash;
    }
  }
}

/**
 * Session manager tracks active sessions.
 * Useful for concurrent execution and session lifecycle management.
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private maxSessions: number = 100;

  /**
   * Create a new session and register it.
   * @param config - The Axiom configuration
   * @returns New session
   */
  createSession(config: AxiomConfig): Session {
    // Cleanup expired sessions
    this.cleanupExpired();

    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Session limit reached (${this.maxSessions})`);
    }

    const session = Session.create(config);
    this.sessions.set(session.sessionId, session);

    return session;
  }

  /**
   * Get session by ID.
   * @param sessionId - The session identifier
   * @returns Session or undefined
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Remove session from manager.
   * @param sessionId - The session identifier
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Cleanup expired sessions.
   * @param maxAge - Maximum session age (default: 5 minutes)
   */
  cleanupExpired(maxAge: number = 5 * 60 * 1000): void {
    const expired: string[] = [];

    for (const [id, session] of this.sessions) {
      if (session.isExpired(maxAge)) {
        expired.push(id);
      }
    }

    for (const id of expired) {
      this.sessions.delete(id);
    }
  }

  /**
   * Get active session count.
   */
  getActiveCount(): number {
    return this.sessions.size;
  }

  /**
   * Clear all sessions.
   */
  clear(): void {
    this.sessions.clear();
  }
}

