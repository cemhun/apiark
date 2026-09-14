use std::collections::HashMap;
use std::path::Path;

use crate::models::environment::{EnvironmentFile, EnvironmentScope};
use crate::storage::environment;

/// Load base variables when no environment is selected: collection-scoped
/// variables (lowest priority) merged with the collection root `.env` file.
#[tauri::command]
pub async fn load_root_dotenv(collection_path: String) -> Result<HashMap<String, String>, String> {
    let path = Path::new(&collection_path);
    let mut variables = environment::load_collection_variables(path);
    variables.extend(environment::load_root_dotenv(path));
    Ok(variables)
}

#[tauri::command]
pub async fn load_environments(collection_path: String) -> Result<Vec<EnvironmentFile>, String> {
    let path = Path::new(&collection_path);
    tracing::debug!(path = %collection_path, "Loading environments");
    environment::load_environments(path)
}

#[tauri::command]
pub async fn save_environment(
    collection_path: String,
    env: EnvironmentFile,
    scope: Option<String>,
) -> Result<(), String> {
    let path = Path::new(&collection_path);
    let mut env = env;
    if let Some(ref s) = scope {
        env.scope = match s.as_str() {
            "personal" => EnvironmentScope::Personal,
            _ => EnvironmentScope::Shared,
        };
    }
    tracing::debug!(path = %collection_path, name = %env.name, "Saving environment");
    environment::save_environment(path, &env)
}

/// Resolve all variables for a given environment, merging (lowest to highest priority):
/// 1. Collection-scoped variables
/// 2. Root .env variables
/// 3. Environment YAML variables
/// 4. .apiark/.env secrets (highest priority)
#[tauri::command]
pub async fn get_resolved_variables(
    collection_path: String,
    environment_name: String,
) -> Result<HashMap<String, String>, String> {
    let path = Path::new(&collection_path);
    environment::get_resolved_variables(path, &environment_name)
}

/// Load the persisted `ark.globals` store (`.apiark/globals.local.yaml`).
/// Script-writable, survives app restarts, but is personal/gitignored —
/// unlike Collection Variables, which are read-only from scripts.
#[tauri::command]
pub async fn load_globals(collection_path: String) -> Result<HashMap<String, String>, String> {
    let path = Path::new(&collection_path);
    Ok(environment::load_globals(path))
}

#[tauri::command]
pub async fn save_globals(
    collection_path: String,
    globals: HashMap<String, String>,
) -> Result<(), String> {
    let path = Path::new(&collection_path);
    environment::save_globals(path, &globals)
}

