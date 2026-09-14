pub mod assertions;
pub mod engine;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScriptPhase {
    PreRequest,
    PostResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub name: String,
    pub passed: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsoleEntry {
    pub level: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssertionResult {
    pub path: String,
    pub operator: String,
    pub expected: serde_json::Value,
    pub actual: serde_json::Value,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestSnapshot {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseSnapshot {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub time_ms: u64,
    pub size_bytes: u64,
}

/// Full context passed into script execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptContext {
    pub request: RequestSnapshot,
    pub response: Option<ResponseSnapshot>,
    pub env: HashMap<String, String>,
    pub globals: HashMap<String, String>,
    pub variables: HashMap<String, String>,
    /// Collection-scoped variables (`ark.collectionVariables`), backed by the
    /// collection's `defaults.variables` (persisted to `.apiark/apiark.yaml`).
    #[serde(default)]
    pub collection_variables: HashMap<String, String>,
}

/// Result returned after script execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptResult {
    pub request: RequestSnapshot,
    pub env_mutations: HashMap<String, Option<String>>,
    pub global_mutations: HashMap<String, Option<String>>,
    pub variable_mutations: HashMap<String, Option<String>>,
    #[serde(default)]
    pub collection_variable_mutations: HashMap<String, Option<String>>,
    pub test_results: Vec<TestResult>,
    pub console_output: Vec<ConsoleEntry>,
}
