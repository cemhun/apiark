use std::collections::HashMap;
use std::fs;
use std::path::Path;

use crate::models::environment::{EnvironmentFile, EnvironmentScope};

/// Load all environments from both shared and personal directories.
pub fn load_environments(collection_path: &Path) -> Result<Vec<EnvironmentFile>, String> {
    let mut envs = Vec::new();

    // Load shared environments (.apiark/environments/)
    let shared_dir = collection_path.join(".apiark").join("environments");
    load_envs_from_dir(&shared_dir, EnvironmentScope::Shared, &mut envs)?;

    // Load personal environments (.apiark/environments.local/)
    let personal_dir = collection_path.join(".apiark").join("environments.local");
    load_envs_from_dir(&personal_dir, EnvironmentScope::Personal, &mut envs)?;

    envs.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(envs)
}

fn load_envs_from_dir(
    dir: &Path,
    scope: EnvironmentScope,
    envs: &mut Vec<EnvironmentFile>,
) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read environments dir: {e}"))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read dir entry: {e}"))?;
        let path = entry.path();
        if path.extension().is_some_and(|e| e == "yaml" || e == "yml") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read {}: {e}", path.display()))?;
            let mut env: EnvironmentFile = serde_yaml::from_str(&content)
                .map_err(|e| format!("Invalid environment YAML {}: {e}", path.display()))?;
            env.scope = scope.clone();
            envs.push(env);
        }
    }
    Ok(())
}

/// Parse a .env file into a HashMap.
fn parse_dotenv(path: &Path) -> HashMap<String, String> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return HashMap::new(),
    };

    let mut vars = HashMap::new();
    for line in content.lines() {
        let line = line.trim();
        // Skip comments and blank lines
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim().to_string();
            let value = value.trim().to_string();
            // Strip surrounding quotes if present
            let value = if (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''))
            {
                value[1..value.len() - 1].to_string()
            } else {
                value
            };
            vars.insert(key, value);
        }
    }

    vars
}

/// Load variables from the collection root .env file.
pub fn load_root_dotenv(collection_path: &Path) -> HashMap<String, String> {
    let env_path = collection_path.join(".env");
    if !env_path.exists() {
        return HashMap::new();
    }
    parse_dotenv(&env_path)
}

/// Load secrets from the .apiark/.env file.
pub fn load_dotenv_secrets(collection_path: &Path) -> HashMap<String, String> {
    let env_path = collection_path.join(".apiark").join(".env");
    if !env_path.exists() {
        return HashMap::new();
    }
    parse_dotenv(&env_path)
}

/// Load collection-scoped variables from `.apiark/apiark.yaml` (`defaults.variables`).
/// Returns an empty map if the collection config can't be read (e.g. not a
/// valid collection yet, or the file is missing).
pub fn load_collection_variables(collection_path: &Path) -> HashMap<String, String> {
    crate::storage::collection::load_collection_config(collection_path)
        .map(|config| config.defaults.variables)
        .unwrap_or_default()
}

/// Resolve all variables for a given environment, merging (lowest to highest priority):
/// 1. Collection-scoped variables (`.apiark/apiark.yaml` -> `defaults.variables`)
/// 2. Root .env variables
/// 3. Environment YAML variables
/// 4. .apiark/.env secrets (declared in environment's secrets list) (highest priority)
pub fn get_resolved_variables(
    collection_path: &Path,
    environment_name: &str,
) -> Result<HashMap<String, String>, String> {
    let envs = load_environments(collection_path)?;
    let env = envs
        .iter()
        .find(|e| e.name == environment_name)
        .ok_or_else(|| format!("Environment '{}' not found", environment_name))?;

    // Start with collection-scoped variables (lowest priority)
    let mut variables = load_collection_variables(collection_path);

    // Override with root .env
    variables.extend(load_root_dotenv(collection_path));

    // Override with environment YAML variables
    variables.extend(env.variables.clone());

    // Override with .apiark/.env secrets (highest priority)
    let secrets = load_dotenv_secrets(collection_path);
    for secret_key in &env.secrets {
        if let Some(value) = secrets.get(secret_key) {
            variables.insert(secret_key.clone(), value.clone());
        }
    }
    Ok(variables)
}

/// Save an environment file to disk. Saves to shared or personal directory based on scope.
pub fn save_environment(collection_path: &Path, env: &EnvironmentFile) -> Result<(), String> {
    let subdir = match env.scope {
        EnvironmentScope::Personal => "environments.local",
        EnvironmentScope::Shared => "environments",
    };
    let env_dir = collection_path.join(".apiark").join(subdir);
    fs::create_dir_all(&env_dir).map_err(|e| format!("Failed to create environments dir: {e}"))?;

    // Ensure .gitignore exists in personal dir
    if matches!(env.scope, EnvironmentScope::Personal) {
        let gitignore = env_dir.join(".gitignore");
        if !gitignore.exists() {
            let _ = fs::write(&gitignore, "*\n!.gitignore\n");
        }
    }

    let filename = env.name.to_lowercase().replace(' ', "-");
    let file_path = env_dir.join(format!("{filename}.yaml"));

    let yaml =
        serde_yaml::to_string(env).map_err(|e| format!("Failed to serialize environment: {e}"))?;

    // Atomic write
    let tmp_path = file_path.with_extension("apiark.tmp");
    fs::write(&tmp_path, &yaml).map_err(|e| format!("Failed to write temp file: {e}"))?;
    fs::rename(&tmp_path, &file_path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        format!("Failed to rename temp file: {e}")
    })
}

/// Load the persisted `ark.globals` store from `.apiark/globals.local.yaml`.
/// This file is personal/local (gitignored) — it's a script-writable scratch
/// space that survives app restarts, separate from committed collection
/// variables (which are read-only from scripts).
pub fn load_globals(collection_path: &Path) -> HashMap<String, String> {
    let path = collection_path
        .join(".apiark")
        .join("globals.local.yaml");
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return HashMap::new(),
    };
    serde_yaml::from_str(&content).unwrap_or_default()
}

/// Save the `ark.globals` store to `.apiark/globals.local.yaml` (atomic write).
pub fn save_globals(
    collection_path: &Path,
    globals: &HashMap<String, String>,
) -> Result<(), String> {
    let apiark_dir = collection_path.join(".apiark");
    fs::create_dir_all(&apiark_dir).map_err(|e| format!("Failed to create .apiark dir: {e}"))?;

    // Ensure the file is gitignored, since it's script-mutated local state.
    let gitignore = apiark_dir.join(".gitignore");
    let gitignore_entry = "globals.local.yaml\n";
    match fs::read_to_string(&gitignore) {
        Ok(existing) if existing.contains("globals.local.yaml") => {}
        Ok(existing) => {
            let _ = fs::write(&gitignore, format!("{existing}{gitignore_entry}"));
        }
        Err(_) => {
            let _ = fs::write(&gitignore, gitignore_entry);
        }
    }

    let path = apiark_dir.join("globals.local.yaml");
    let yaml =
        serde_yaml::to_string(globals).map_err(|e| format!("Failed to serialize globals: {e}"))?;

    let tmp_path = path.with_extension("apiark.tmp");
    fs::write(&tmp_path, &yaml).map_err(|e| format!("Failed to write temp file: {e}"))?;
    fs::rename(&tmp_path, &path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        format!("Failed to rename temp file: {e}")
    })
}

