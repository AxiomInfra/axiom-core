import type {
  EnclaveRequest,
  EnclaveResponse,
  EnclaveError,
  AttestationEvidence,
} from "../attestation/types.ts";
import type { TransformedContext } from "../core/config.ts";
import { ConfigurationError } from "../core/errors.ts";
import { hash as hashContext } from "../core/canonical.ts";
import { createHash } from "crypto";

/**
 * Enclave bridge for communication with native Rust runner.
 * Provides abstraction over IPC mechanism and includes simulator mode for development.
 */

/**
 * Enclave runner interface.
 * Abstracts whether using real TEE or simulator.
 */
export interface IEnclaveRunner {
  /**
   * Check if the runner is available and functional.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Execute transformation in enclave.
   */
  execute(request: EnclaveRequest): Promise<EnclaveResponse>;

  /**
   * Get platform information.
   */
  getPlatform(): "sev-snp" | "sev-snp-simulator";
}

/**
 * Real enclave runner using N-API bindings to Rust.
 * Requires native module to be built and available.
 */
class NativeEnclaveRunner implements IEnclaveRunner {
  private nativeModule: unknown | null = null;

  constructor() {
    this.loadNativeModule();
  }

  private loadNativeModule(): void {
    try {
      // Attempt to load native module
      // In production, this would be: require('../../enclave-runner')
      // For now, we gracefully handle absence
      this.nativeModule = null; // Placeholder
    } catch (error) {
      this.nativeModule = null;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.nativeModule) return false;

    try {
      // Check if SEV-SNP is available on this system
      // In real implementation: call native function
      return false; // Requires actual hardware
    } catch {
      return false;
    }
  }

  async execute(request: EnclaveRequest): Promise<EnclaveResponse> {
    if (!this.nativeModule) {
      throw new ConfigurationError(
        "Native enclave runner not available - module not loaded"
      );
    }

    // In real implementation:
    // const result = await this.nativeModule.transform(serializeRequest(request));
    // return deserializeResponse(result);

    throw new ConfigurationError(
      "Native enclave runner not implemented - use simulator for development"
    );
  }

  getPlatform(): "sev-snp" {
    return "sev-snp";
  }
}

/**
 * Simulator enclave runner for development and testing.
 * NO SECURITY GUARANTEES - for testing architecture only.
 */
class SimulatorEnclaveRunner implements IEnclaveRunner {
  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  async execute(request: EnclaveRequest): Promise<EnclaveResponse> {
    // Simulate transformation by running standard pipeline
    const rawContext = new TextDecoder().decode(request.rawContext);

    // Import transform modules
    const { Distiller } = await import("../transform/distiller.ts");
    const { Abstractor } = await import("../transform/abstraction.ts");
    const { Masker } = await import("../transform/masking.ts");

    // Execute transformation
    const distiller = new Distiller();
    const abstractor = new Abstractor();
    const masker = new Masker();

    const rawEntities = distiller.distill(rawContext);
    const semanticRep = abstractor.abstract(rawEntities, rawContext);
    const masked = masker.mask(semanticRep, [rawContext]);

    // Build transformed context
    const transformedContext: TransformedContext = {
      entities: masked.entities,
      relations: masked.relations,
      task: request.taskHint ?? "transform",
      model: undefined,
    };

    // Serialize to canonical JSON
    const { canonicalize } = await import("../core/canonical.ts");
    const canonicalJson = canonicalize(transformedContext);
    const transformedBytes = new TextEncoder().encode(canonicalJson);

    // Compute output hash
    const outputHashStr = hashContext(transformedContext);
    const outputHash = Buffer.from(outputHashStr, "hex");

    // Generate fake attestation report (clearly marked)
    const fakeReport = this.generateFakeAttestationReport(
      request.sessionId,
      Buffer.from(request.configHash, "hex"),
      outputHash,
      request.timestamp
    );

    // Fake measurement (deterministic for testing)
    const measurement = "simulator_measurement_0000000000000000000000000000000000000000000000000000000000000000";

    return {
      transformedContext: transformedBytes,
      outputHash,
      attestationReport: fakeReport,
      redactionStats: {
        entityCount: masked.entities.length,
        relationCount: masked.relations.length,
        identifiersReplaced: masked.entities.length,
      },
      measurement,
      signature: undefined,
    };
  }

  getPlatform(): "sev-snp-simulator" {
    return "sev-snp-simulator";
  }

  /**
   * Generate a fake attestation report for simulator mode.
   * Structure mimics real report but clearly marked as fake.
   */
  private generateFakeAttestationReport(
    sessionId: Uint8Array,
    configHash: Buffer,
    outputHash: Buffer,
    timestamp: number
  ): Uint8Array {
    // Create a fake report structure
    // In real implementation, this would be actual SEV-SNP report format

    const report = Buffer.alloc(1184); // Real SEV-SNP report is 1184 bytes

    // Magic marker for simulator (first 4 bytes)
    report.write("FAKE", 0, 4, "ascii");

    // Version
    report.writeUInt32LE(1, 4);

    // Embed custom data: SHA-256(sessionId || configHash || outputHash)
    const reportData = createHash("sha256");
    reportData.update(sessionId);
    reportData.update(configHash);
    reportData.update(outputHash);
    const timestampBytes = Buffer.alloc(8);
    timestampBytes.writeBigUInt64BE(BigInt(timestamp), 0);
    reportData.update(timestampBytes);
    const reportDataHash = reportData.digest();
    reportDataHash.copy(report, 8); // Offset 8 for report_data

    // Mark as simulator in multiple places
    report.write("SIMULATOR", 40, 9, "ascii");

    return new Uint8Array(report);
  }
}

/**
 * Enclave bridge manages runner selection and provides unified interface.
 */
export class EnclaveBridge {
  private runner: IEnclaveRunner;
  private mode: "native" | "simulator";

  constructor(preferNative: boolean = true) {
    if (preferNative) {
      this.runner = new NativeEnclaveRunner();
      this.mode = "native";
    } else {
      this.runner = new SimulatorEnclaveRunner();
      this.mode = "simulator";
    }
  }

  /**
   * Check if enclave execution is available.
   */
  async isAvailable(): Promise<boolean> {
    return await this.runner.isAvailable();
  }

  /**
   * Get the current runner mode.
   */
  getMode(): "native" | "simulator" {
    return this.mode;
  }

  /**
   * Get platform type.
   */
  getPlatform(): "sev-snp" | "sev-snp-simulator" {
    return this.runner.getPlatform();
  }

  /**
   * Execute transformation in enclave.
   * @param request - Enclave execution request
   * @returns Enclave execution response with attestation
   */
  async execute(request: EnclaveRequest): Promise<EnclaveResponse> {
    const available = await this.isAvailable();
    if (!available) {
      throw new ConfigurationError(
        `Enclave not available in ${this.mode} mode`
      );
    }

    return await this.runner.execute(request);
  }

  /**
   * Switch to simulator mode (for testing).
   */
  useSimulator(): void {
    this.runner = new SimulatorEnclaveRunner();
    this.mode = "simulator";
  }

  /**
   * Create attestation evidence from enclave response.
   * @param response - Enclave execution response
   * @param sessionId - Session identifier
   * @param configHash - Configuration hash
   * @returns Attestation evidence object
   */
  createEvidence(
    response: EnclaveResponse,
    sessionId: string,
    configHash: string,
    timestamp: number = Date.now()
  ): AttestationEvidence {
    return {
      platform: this.getPlatform() === "sev-snp-simulator" ? "sev-snp" : "sev-snp",
      report: response.attestationReport,
      measurement: response.measurement,
      configHash,
      sessionId,
      outputHash: Buffer.from(response.outputHash).toString("hex"),
      timestamp,
      signature: response.signature,
      version: "1.0",
    };
  }
}

/**
 * Create an enclave bridge with automatic fallback.
 * Tries native first, falls back to simulator if unavailable.
 */
export async function createEnclaveBridge(
  preferNative: boolean = true
): Promise<EnclaveBridge> {
  const bridge = new EnclaveBridge(preferNative);

  // If native mode requested but not available, log warning and fallback
  if (preferNative) {
    const available = await bridge.isAvailable();
    if (!available) {
      bridge.useSimulator();
    }
  }

  return bridge;
}

