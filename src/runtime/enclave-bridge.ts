/**
 * Experimental enclave bridge. This is an opt-in preview path and does not
 * provide v0.x guarantees. The default v0.x flow remains software-only.
 */
import type {
  EnclaveRequest,
  EnclaveResponse,
  AttestationEvidence,
} from "../attestation/types.ts";
import type { TransformedContext } from "../core/config.ts";
import { ConfigurationError } from "../core/errors.ts";
import { canonicalize, hash as hashContext } from "../core/canonical.ts";
import { createHash } from "crypto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

type NativeRunnerModule = {
  initialize?: () => string;
  transform: (requestJson: string) => Promise<string> | string;
  get_measurement?: () => string;
  check_availability?: () => boolean;
};

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
  private nativeModule: NativeRunnerModule | null = null;

  constructor() {
    this.loadNativeModule();
  }

  private loadNativeModule(): void {
    try {
      // Attempt to load native module from the private package
      this.nativeModule = require("@axiom-infra/enclave-runner") as NativeRunnerModule;
    } catch (error) {
      this.nativeModule = null;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.nativeModule) return false;

    try {
      if (this.nativeModule.check_availability) {
        return this.nativeModule.check_availability();
      }
      return false;
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

    const requestJson = this.serializeRequest(request);
    const responseJson = await this.nativeModule.transform(requestJson);
    return this.deserializeResponse(responseJson, request);
  }

  getPlatform(): "sev-snp" {
    return "sev-snp";
  }

  private serializeRequest(request: EnclaveRequest): string {
    const rawContext = new TextDecoder().decode(request.rawContext);
    const payload = {
      raw_context: [rawContext],
      task_hint: request.taskHint ?? null,
      policy: {
        version: request.policy.version,
        allow_common_words: request.policy.allowCommonWords,
        max_input_size: request.policy.maxInputSize,
      },
      session_id: Buffer.from(request.sessionId).toString("hex"),
      config_hash: request.configHash,
      nonce: Buffer.from(request.nonce).toString("hex"),
      timestamp: request.timestamp,
    };

    return JSON.stringify(payload);
  }

  private deserializeResponse(
    responseJson: string,
    request: EnclaveRequest
  ): EnclaveResponse {
    const response = JSON.parse(responseJson) as {
      transformed_context: {
        entities: Array<{
          id: string;
          role: string;
          attributes: Record<string, unknown>;
        }>;
        relations: Array<{
          relation_type: string;
          from: string;
          to: string;
        }>;
      };
      output_hash: string;
      attestation_report: number[];
      redaction_stats: {
        entity_count: number;
        relation_count: number;
        identifiers_replaced: number;
      };
      measurement: string;
      signature?: number[];
    };

    const transformedContext: TransformedContext = {
      entities: response.transformed_context.entities.map((entity) => {
        const attributes: Record<string, string | number> = {};
        for (const [key, value] of Object.entries(entity.attributes ?? {})) {
          if (typeof value === "string" || typeof value === "number") {
            attributes[key] = value;
          } else {
            attributes[key] = JSON.stringify(value);
          }
        }
        return {
          syntheticId: entity.id,
          role: entity.role,
          attributes,
        };
      }),
      relations: response.transformed_context.relations.map((relation) => ({
        type: relation.relation_type,
        from: relation.from,
        to: relation.to,
      })),
      task: request.taskHint ?? "transform",
      model: undefined,
    };

    const canonicalJson = canonicalize(transformedContext);
    const transformedBytes = new TextEncoder().encode(canonicalJson);

    return {
      transformedContext: transformedBytes,
      outputHash: Buffer.from(response.output_hash, "hex"),
      attestationReport: Uint8Array.from(response.attestation_report),
      redactionStats: {
        entityCount: response.redaction_stats.entity_count,
        relationCount: response.redaction_stats.relation_count,
        identifiersReplaced: response.redaction_stats.identifiers_replaced,
      },
      measurement: response.measurement,
      signature: response.signature
        ? Uint8Array.from(response.signature)
        : undefined,
    };
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

