use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// On-disk environment file (environments/development.yaml)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentFile {
    pub name: String,
    #[serde(default)]
    pub variables: HashMap<String, String>,
    /// Always serialized (even when empty) — this struct is also used as the
    /// Tauri IPC response type for `load_environments`, and the frontend
    /// (`EnvironmentData` in `@apiark/types`) expects `secrets` to always be
    /// a real array. Previously this had `skip_serializing_if = "Vec::is_empty"`
    /// (to keep saved YAML files tidy), but that also omitted the field from
    /// the JSON sent to the frontend whenever an environment had no secrets,
    /// making `env.secrets` `undefined` there and crashing any code that
    /// iterates over it (e.g. the "All Variables" view).
    #[serde(default)]
    pub secrets: Vec<String>,
    /// Whether this environment is shared (committed to git) or personal (gitignored).
    /// Determined by which directory the file is in.
    #[serde(default)]
    pub scope: EnvironmentScope,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EnvironmentScope {
    #[default]
    Shared,
    Personal,
}
