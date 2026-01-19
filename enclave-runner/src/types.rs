//! Type definitions for enclave runner.
//!
//! These types match the TypeScript definitions in `src/attestation/types.ts`.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Request to execute transformation in enclave.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnclaveRequest {
    /// Raw context strings to transform
    pub raw_context: Vec<String>,

    /// Optional task hint (should be non-sensitive)
    pub task_hint: Option<String>,

    /// Masking policy configuration
    pub policy: MaskingPolicy,

    /// Session identifier for binding
    pub session_id: String,

    /// Random nonce for freshness
    pub nonce: String,
}

/// Masking policy configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MaskingPolicy {
    /// Policy version
    pub version: String,

    /// Whether to allow common words in output
    pub allow_common_words: bool,

    /// Maximum input size in bytes
    pub max_input_size: usize,
}

/// Response from enclave transformation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnclaveResponse {
    /// Transformed context (canonical JSON)
    pub transformed_context: TransformedContext,

    /// SHA-256 hash of transformed context
    pub output_hash: String,

    /// Raw attestation report from platform
    pub attestation_report: Vec<u8>,

    /// Redaction statistics
    pub redaction_stats: RedactionStats,

    /// Measurement of enclave code
    pub measurement: String,

    /// Optional enclave signature
    pub signature: Option<Vec<u8>>,
}

/// Transformed semantic context.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformedContext {
    /// Schema version
    pub schema_version: String,

    /// Extracted entities with synthetic IDs
    pub entities: Vec<Entity>,

    /// Relations between entities
    pub relations: Vec<Relation>,

    /// Optional constraints
    pub constraints: Option<HashMap<String, serde_json::Value>>,

    /// Metadata (task, session info)
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Semantic entity with synthetic ID.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    /// Synthetic identifier
    pub id: String,

    /// Semantic role
    pub role: String,

    /// Entity attributes (no PII)
    pub attributes: HashMap<String, serde_json::Value>,
}

/// Relation between entities.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relation {
    /// Relation type
    #[serde(rename = "type")]
    pub relation_type: String,

    /// Source entity ID
    pub from: String,

    /// Target entity ID
    pub to: String,
}

/// Redaction statistics (counts only, no content).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionStats {
    /// Number of entities extracted
    pub entity_count: usize,

    /// Number of relations built
    pub relation_count: usize,

    /// Number of identifiers replaced
    pub identifiers_replaced: usize,
}

impl Default for EnclaveRequest {
    fn default() -> Self {
        Self {
            raw_context: vec![],
            task_hint: None,
            policy: MaskingPolicy::default(),
            session_id: String::new(),
            nonce: String::new(),
        }
    }
}

impl Default for MaskingPolicy {
    fn default() -> Self {
        Self {
            version: "v1".to_string(),
            allow_common_words: true,
            max_input_size: 10 * 1024 * 1024, // 10 MB
        }
    }
}

