use std::path::{Path, PathBuf};

use crate::models::collection::{
    CollectionConfig, CollectionDefaults, CollectionNode, RequestFile,
};
use crate::models::request::HttpMethod;
use crate::storage::collection;

#[derive(serde::Serialize)]
pub struct WorkspaceScanResult {
    pub workspaces: Vec<WorkspaceInfo>,
}

#[derive(serde::Serialize)]
pub struct WorkspaceInfo {
    pub name: String,
    pub dir: String,
    pub collection_paths: Vec<String>,
}

#[tauri::command]
pub async fn scan_workspaces() -> Result<WorkspaceScanResult, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let base = home.join("ApiArk");

    std::fs::create_dir_all(&base).map_err(|e| format!("Failed to create ApiArk dir: {e}"))?;

    let entries = std::fs::read_dir(&base).map_err(|e| format!("Failed to read ApiArk dir: {e}"))?;

    let mut ws_dirs: Vec<String> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().map(|t| t.is_dir()).unwrap_or(false)
                && !e.file_name().to_string_lossy().starts_with('.')
        })
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();

    ws_dirs.sort();

    if ws_dirs.is_empty() {
        let default_dir = base.join("default");
        std::fs::create_dir_all(&default_dir)
            .map_err(|e| format!("Failed to create default workspace: {e}"))?;
        ws_dirs.push("default".to_string());
    }

    let mut workspaces = Vec::new();

    for ws_name in &ws_dirs {
        let ws_dir = base.join(ws_name);
        let mut collection_paths = Vec::new();

        if let Ok(col_entries) = std::fs::read_dir(&ws_dir) {
            for col_entry in col_entries.filter_map(|e| e.ok()) {
                let col_type = col_entry.file_type().unwrap_or_else(|_| {
                    // fallback — skip
                    col_entry.file_type().unwrap()
                });
                if !col_type.is_dir() {
                    continue;
                }
                let col_name = col_entry.file_name().to_string_lossy().into_owned();
                if col_name.starts_with('.') {
                    continue;
                }
                let col_path = ws_dir.join(&col_name);
                let marker = col_path.join(".apiark").join("apiark.yaml");
                if marker.exists() {
                    collection_paths.push(col_path.to_string_lossy().into_owned());
                }
            }
        }

        collection_paths.sort();

        // "my-workspace" → "My workspace"
        let display_name = {
            let s = ws_name.replace('-', " ");
            let mut c = s.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        };

        workspaces.push(WorkspaceInfo {
            name: display_name,
            dir: ws_dir.to_string_lossy().into_owned(),
            collection_paths,
        });
    }

    Ok(WorkspaceScanResult { workspaces })
}

#[tauri::command]
pub async fn create_workspace(name: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let base = home.join("ApiArk");
    std::fs::create_dir_all(&base).map_err(|e| format!("Failed to create ApiArk dir: {e}"))?;

    // slugify: lowercase, replace non-alphanum with '-', trim dashes
    let slug: String = name
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    let slug = if slug.is_empty() { "workspace".to_string() } else { slug };

    // Find a unique folder name
    let mut folder = slug.clone();
    let mut suffix = 2u32;
    while base.join(&folder).exists() {
        folder = format!("{slug}-{suffix}");
        suffix += 1;
    }

    let dir = base.join(&folder);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create workspace dir: {e}"))?;

    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn rename_workspace(old_dir: String, new_name: String) -> Result<String, String> {
    let old_path = std::path::Path::new(&old_dir);
    let parent = old_path
        .parent()
        .ok_or("Could not determine parent directory")?;

    let slug: String = new_name
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    let slug = if slug.is_empty() { "workspace".to_string() } else { slug };

    let new_path = parent.join(&slug);
    if new_path != old_path {
        std::fs::rename(&old_path, &new_path)
            .map_err(|e| format!("Failed to rename workspace: {e}"))?;
    }

    Ok(new_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn get_collection_defaults(
    collection_path: String,
) -> Result<CollectionDefaults, String> {
    let path = collection_path.clone();
    tokio::task::spawn_blocking(move || {
        let config = collection::load_collection_config(Path::new(&path))?;
        Ok(config.defaults)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn update_collection_defaults(
    collection_path: String,
    defaults: CollectionDefaults,
) -> Result<(), String> {
    let path = collection_path.clone();
    tokio::task::spawn_blocking(move || {
        let mut config = collection::load_collection_config(Path::new(&path))?;
        config.defaults = defaults;
        collection::save_collection_config(Path::new(&path), &config)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn open_collection(path: String) -> Result<CollectionNode, String> {
    tracing::info!(path = %path, "Opening collection");
    tokio::task::spawn_blocking(move || {
        let collection_path = Path::new(&path);
        collection::load_collection_tree(collection_path)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn read_request_file(path: String) -> Result<RequestFile, String> {
    tracing::debug!(path = %path, "Reading request file");
    tokio::task::spawn_blocking(move || {
        let file_path = Path::new(&path);
        collection::read_request(file_path)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn save_request_file(path: String, request: RequestFile) -> Result<(), String> {
    tracing::debug!(path = %path, "Saving request file");
    tokio::task::spawn_blocking(move || {
        let file_path = Path::new(&path);
        collection::write_request(file_path, &request)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn create_request(
    dir: String,
    filename: String,
    name: String,
    method: HttpMethod,
    url: String,
) -> Result<String, String> {
    let dir_path = Path::new(&dir);
    let request = RequestFile {
        name,
        method,
        url,
        protocol: None,
        description: None,
        headers: Default::default(),
        auth: None,
        body: None,
        params: None,
        assert: None,
        tests: None,
        pre_request_script: None,
        post_response_script: None,
        cookies: None,
    };
    let path = collection::create_request_file(dir_path, &filename, &request)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn create_folder(parent: String, name: String) -> Result<String, String> {
    let parent_path = Path::new(&parent);
    let path = collection::create_folder(parent_path, &name)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn delete_item(path: String, collection_name: String) -> Result<String, String> {
    let item_path = Path::new(&path);
    tracing::info!(path = %path, "Deleting item (moving to trash)");
    collection::delete_item(item_path, &collection_name)
}

#[tauri::command]
pub async fn save_folder_order(dir: String, order: Vec<String>) -> Result<(), String> {
    let dir_path = Path::new(&dir);
    tracing::debug!(dir = %dir, "Saving folder order");
    collection::save_folder_order(dir_path, &order)
}

#[tauri::command]
pub async fn rename_item(path: String, new_name: String) -> Result<String, String> {
    let item_path = Path::new(&path);
    tracing::info!(path = %path, new_name = %new_name, "Renaming item");
    let new_path = collection::rename_item(item_path, &new_name)?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn create_sample_collection(parent_dir: Option<String>) -> Result<String, String> {
    let base_parent = if let Some(dir) = parent_dir {
        std::path::PathBuf::from(dir)
    } else {
        let home = dirs::home_dir().ok_or("Could not determine home directory")?;
        home.join("ApiArk").join("default")
    };
    let base = base_parent.join("getting-started");

    if base.join(".apiark").join("apiark.yaml").exists() {
        return Ok(base.to_string_lossy().to_string());
    }

    // Create directory structure
    let apiark_dir = base.join(".apiark");
    let env_dir = apiark_dir.join("environments");
    let basics_dir = base.join("basics");

    for d in [&apiark_dir, &env_dir, &basics_dir] {
        std::fs::create_dir_all(d).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    // Collection config
    let config = CollectionConfig {
        name: "Getting Started".to_string(),
        version: 1,
        defaults: Default::default(),
    };
    let config_yaml =
        serde_yaml::to_string(&config).map_err(|e| format!("Failed to serialize config: {e}"))?;
    std::fs::write(apiark_dir.join("apiark.yaml"), config_yaml)
        .map_err(|e| format!("Failed to write config: {e}"))?;

    // Default environment
    std::fs::write(
        env_dir.join("default.yaml"),
        "name: Default\nvariables:\n  baseUrl: https://httpbin.org\n",
    )
    .map_err(|e| format!("Failed to write env: {e}"))?;

    // .gitignore (inside .apiark/)
    std::fs::write(apiark_dir.join(".gitignore"), ".env\n")
        .map_err(|e| format!("Failed to write .gitignore: {e}"))?;

    // Root .gitignore (covers collection root .env file)
    let root_gitignore = base.join(".gitignore");
    if !root_gitignore.exists() {
        std::fs::write(&root_gitignore, ".env\n.env.local\n")
            .map_err(|e| format!("Failed to write root .gitignore: {e}"))?;
    }

    // Sample requests
    write_sample(&basics_dir.join("simple-get.yaml"),
        "name: Simple GET\nmethod: GET\nurl: \"{{baseUrl}}/get\"\ndescription: A basic GET request to httpbin.org\n"
    )?;

    write_sample(&basics_dir.join("post-json.yaml"),
        "name: POST JSON\nmethod: POST\nurl: \"{{baseUrl}}/post\"\ndescription: Send a JSON body to httpbin.org\nbody:\n  type: json\n  content: |\n    {\n      \"name\": \"ApiArk\",\n      \"version\": \"1.0\"\n    }\n"
    )?;

    write_sample(&basics_dir.join("with-auth.yaml"),
        "name: Bearer Auth\nmethod: GET\nurl: \"{{baseUrl}}/bearer\"\ndescription: GET request with Bearer token authentication\nauth:\n  type: bearer\n  token: my-secret-token\n"
    )?;

    write_sample(&basics_dir.join("query-params.yaml"),
        "name: Query Parameters\nmethod: GET\nurl: \"{{baseUrl}}/get\"\ndescription: GET request with query parameters\nparams:\n  page: \"1\"\n  limit: \"10\"\n  search: hello\n"
    )?;

    Ok(base.to_string_lossy().to_string())
}

fn write_sample(path: &PathBuf, content: &str) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| format!("Failed to write {}: {e}", path.display()))
}

#[tauri::command]
pub async fn create_collection(parent_dir: String, name: String) -> Result<String, String> {
    let folder_name = name
        .trim()
        .to_lowercase()
        .replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "-");
    if folder_name.is_empty() {
        return Err("Collection name cannot be empty".to_string());
    }

    let base = Path::new(&parent_dir).join(&folder_name);
    if base.join(".apiark").join("apiark.yaml").exists() {
        return Err(format!("Collection already exists at {}", base.display()));
    }

    let apiark_dir = base.join(".apiark");
    let env_dir = apiark_dir.join("environments");

    for d in [&apiark_dir, &env_dir] {
        std::fs::create_dir_all(d).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    let config = CollectionConfig {
        name: name.trim().to_string(),
        version: 1,
        defaults: Default::default(),
    };
    let config_yaml =
        serde_yaml::to_string(&config).map_err(|e| format!("Failed to serialize config: {e}"))?;
    std::fs::write(apiark_dir.join("apiark.yaml"), config_yaml)
        .map_err(|e| format!("Failed to write config: {e}"))?;

    // Default environment
    std::fs::write(
        env_dir.join("default.yaml"),
        "name: Default\nvariables:\n  baseUrl: http://localhost:3000\n",
    )
    .map_err(|e| format!("Failed to write env: {e}"))?;

    // .gitignore
    std::fs::write(apiark_dir.join(".gitignore"), ".env\n")
        .map_err(|e| format!("Failed to write .gitignore: {e}"))?;

    let root_gitignore = base.join(".gitignore");
    if !root_gitignore.exists() {
        std::fs::write(&root_gitignore, ".env\n.env.local\n")
            .map_err(|e| format!("Failed to write root .gitignore: {e}"))?;
    }

    Ok(base.to_string_lossy().to_string())
}
