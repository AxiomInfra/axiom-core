//! Semantic transformation logic (Rust implementation).
//!
//! Deterministic entity extraction and masking matching TypeScript implementation.

use crate::error::{EnclaveError, Result};
use crate::types::{TransformedContext, Entity, Relation, MaskingPolicy};
use sha2::{Sha256, Digest};
use std::collections::HashMap;

/// Transform raw context into semantic representation with synthetic IDs.
pub fn transform_context(
    raw_context: &[String],
    _policy: &MaskingPolicy,
) -> Result<TransformedContext> {
    // 1. Extract entities using deterministic heuristics
    let entities = extract_entities(raw_context)?;

    // 2. Build relations between entities
    let relations = build_relations(&entities)?;

    // 3. Verify no raw data leaked
    verify_boundary(&entities, &relations, raw_context)?;

    Ok(TransformedContext {
        schema_version: "v1".to_string(),
        entities,
        relations,
        constraints: None,
        metadata: Some({
            let mut meta = HashMap::new();
            meta.insert("rust_version".to_string(), serde_json::json!(env!("CARGO_PKG_VERSION")));
            meta
        }),
    })
}

/// Extract entities from raw context using deterministic patterns.
fn extract_entities(raw_context: &[String]) -> Result<Vec<Entity>> {
    let mut entities = Vec::new();
    let combined = raw_context.join(" ");

    // Simple entity extraction (matches TypeScript logic)
    // In real hardware builds, this would be more sophisticated
    
    let mut entity_id = 0;
    
    // Extract capitalized sequences (potential names)
    for word in combined.split_whitespace() {
        if word.chars().next().map_or(false, |c| c.is_uppercase()) {
            entities.push(Entity {
                id: format!("ENTITY_{:04}", entity_id),
                role: "Actor".to_string(),
                attributes: {
                    let mut attrs = HashMap::new();
                    attrs.insert("type".to_string(), serde_json::json!("name"));
                    attrs.insert("length".to_string(), serde_json::json!(word.len()));
                    attrs
                },
            });
            entity_id += 1;
        }
    }

    // Extract numbers (potential values)
    for word in combined.split_whitespace() {
        if word.chars().all(|c| c.is_numeric() || c == ',' || c == '.') {
            entities.push(Entity {
                id: format!("ENTITY_{:04}", entity_id),
                role: "Value".to_string(),
                attributes: {
                    let mut attrs = HashMap::new();
                    attrs.insert("type".to_string(), serde_json::json!("number"));
                    attrs
                },
            });
            entity_id += 1;
        }
    }

    if entities.is_empty() {
        return Err(EnclaveError::TransformFailed(
            "No entities extracted from input".to_string()
        ));
    }

    Ok(entities)
}

/// Build relations between entities.
fn build_relations(entities: &[Entity]) -> Result<Vec<Relation>> {
    let mut relations = Vec::new();

    // Build simple relations (all entities related to each other)
    for i in 0..entities.len() {
        for j in (i + 1)..entities.len() {
            relations.push(Relation {
                relation_type: "related".to_string(),
                from: entities[i].id.clone(),
                to: entities[j].id.clone(),
            });
        }
    }

    Ok(relations)
}

/// Verify no raw identifiers leaked into output.
fn verify_boundary(
    entities: &[Entity],
    relations: &[Relation],
    raw_context: &[String],
) -> Result<()> {
    // Serialize entities and relations
    let output = serde_json::to_string(&(entities, relations))
        .map_err(|e| EnclaveError::BoundaryViolation(e.to_string()))?;

    // Check if any raw input appears in output
    for raw in raw_context {
        for word in raw.split_whitespace() {
            if word.len() > 3 && output.contains(word) {
                return Err(EnclaveError::BoundaryViolation(
                    format!("Raw identifier leaked: {}", word)
                ));
            }
        }
    }

    Ok(())
}

/// Compute canonical hash of transformed context.
pub fn compute_output_hash(context: &TransformedContext) -> Result<String> {
    // Canonical serialization (matches TypeScript logic)
    let canonical = canonicalize(context)?;
    
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let hash = hasher.finalize();
    
    Ok(hex::encode(hash))
}

/// Canonicalize transformed context for deterministic hashing.
fn canonicalize(context: &TransformedContext) -> Result<String> {
    // Sort entities by ID
    let mut sorted_context = context.clone();
    sorted_context.entities.sort_by(|a, b| a.id.cmp(&b.id));
    sorted_context.relations.sort_by(|a, b| {
        match a.from.cmp(&b.from) {
            std::cmp::Ordering::Equal => {
                match a.to.cmp(&b.to) {
                    std::cmp::Ordering::Equal => a.relation_type.cmp(&b.relation_type),
                    other => other,
                }
            }
            other => other,
        }
    });

    // Serialize without whitespace
    serde_json::to_string(&sorted_context)
        .map_err(|e| EnclaveError::SerializationFailed(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_entities() {
        let raw = vec!["Alice met Bob".to_string()];
        let entities = extract_entities(&raw).unwrap();
        assert_eq!(entities.len(), 2);
        assert_eq!(entities[0].role, "Actor");
    }

    #[test]
    fn test_compute_hash_deterministic() {
        let context = TransformedContext {
            schema_version: "v1".to_string(),
            entities: vec![],
            relations: vec![],
            constraints: None,
            metadata: None,
        };

        let hash1 = compute_output_hash(&context).unwrap();
        let hash2 = compute_output_hash(&context).unwrap();
        
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64); // SHA-256 hex
    }
}

