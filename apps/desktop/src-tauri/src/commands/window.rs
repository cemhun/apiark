use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Shared state for cross-window tab transfer payloads.
/// Key: window label, Value: JSON-encoded Tab.
pub struct TabTransferStore(pub Mutex<HashMap<String, String>>);

/// Open a new application window, optionally passing a serialized Tab payload.
#[tauri::command]
pub async fn open_new_window(
    app: AppHandle,
    tab_data: Option<String>,
) -> Result<String, String> {
    let label = format!("window-{}", uuid::Uuid::new_v4());
    let url = WebviewUrl::App("index.html".into());

    // Store tab data before creating window so the new window can retrieve it
    if let Some(ref data) = tab_data {
        if let Some(store) = app.try_state::<TabTransferStore>() {
            store.0.lock().unwrap().insert(label.clone(), data.clone());
        }
    }

    WebviewWindowBuilder::new(&app, &label, url)
        .title("ApiArk")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .build()
        .map_err(|e| format!("Failed to create window: {e}"))?;

    Ok(label)
}

/// Called by a newly opened window to retrieve and consume its tab transfer payload.
#[tauri::command]
pub async fn consume_tab_transfer(
    app: AppHandle,
    window_label: String,
) -> Result<Option<String>, String> {
    if let Some(store) = app.try_state::<TabTransferStore>() {
        let data = store.0.lock().unwrap().remove(&window_label);
        return Ok(data);
    }
    Ok(None)
}

