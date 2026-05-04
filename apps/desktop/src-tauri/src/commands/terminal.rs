use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// Manages terminal PTY sessions.
pub struct TerminalManager {
    sessions: Mutex<HashMap<String, TerminalSession>>,
}

struct TerminalSession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    /// Keep child alive — dropping it would kill the shell process
    _child: Box<dyn portable_pty::Child + Send + Sync>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub fn terminal_create(
    id: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    app: AppHandle,
    manager: tauri::State<'_, TerminalManager>,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let size = PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    // Detect shell
    let shell = if cfg!(target_os = "windows") {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    };

    let mut cmd = CommandBuilder::new(&shell);

    // Pass -i (interactive) so shell reads rc files and stays alive
    #[cfg(not(target_os = "windows"))]
    cmd.arg("-i");

    // Set TERM so the shell knows it's in a proper terminal emulator.
    // Without this, macOS LaunchServices launches the app with TERM unset,
    // causing zsh to fall back to dumb-terminal mode where it echoes input
    // itself in addition to the PTY echo — resulting in double characters
    // and broken backspace in the installed DMG.
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    // Ensure Homebrew and common tool paths are available in the GUI app
    // environment (LaunchServices doesn't source shell profiles).
    #[cfg(target_os = "macos")]
    {
        let current_path = std::env::var("PATH").unwrap_or_default();
        let extra = "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
        let new_path = if current_path.is_empty() {
            extra.to_string()
        } else {
            format!("{extra}:{current_path}")
        };
        cmd.env("PATH", new_path);
    }

    // Set working directory
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    } else if let Some(home) = dirs::home_dir() {
        cmd.cwd(home);
    }

    // Spawn the shell — slave is consumed/dropped here after spawn
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {e}"))?;

    // slave is now dropped (goes out of scope with pair.slave after spawn)
    // Only keep the master
    let master = pair.master;

    let writer = master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {e}"))?;

    let mut reader = master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {e}"))?;

    // Store session — slave is NOT stored, so it's dropped here
    {
        let mut sessions = manager.sessions.lock().map_err(|e| e.to_string())?;
        sessions.insert(id.clone(), TerminalSession { writer, master, _child: child });
    }

    // Spawn reader thread to emit output events
    let event_id = id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    // On macOS PTY, Ok(0) can be a spurious read — only
                    // treat it as EOF after a brief check; real EOF comes
                    // as Err(EIO) on macOS.
                    std::thread::sleep(std::time::Duration::from_millis(10));
                    continue;
                }
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit(&format!("terminal-output-{event_id}"), data);
                }
                Err(e) => {
                    // EIO (errno 5) is the normal "shell exited" signal on macOS PTY
                    tracing::debug!("PTY reader closed: {e}");
                    break;
                }
            }
        }
        // Terminal exited
        let _ = app.emit(&format!("terminal-exit-{event_id}"), ());
    });

    Ok(())
}

#[tauri::command]
pub fn terminal_write(
    id: String,
    data: String,
    manager: tauri::State<'_, TerminalManager>,
) -> Result<(), String> {
    let mut sessions = manager.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| "Terminal session not found".to_string())?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn terminal_resize(
    id: String,
    cols: u16,
    rows: u16,
    manager: tauri::State<'_, TerminalManager>,
) -> Result<(), String> {
    let sessions = manager.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&id)
        .ok_or_else(|| "Terminal session not found".to_string())?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn terminal_close(
    id: String,
    manager: tauri::State<'_, TerminalManager>,
) -> Result<(), String> {
    let mut sessions = manager.sessions.lock().map_err(|e| e.to_string())?;
    sessions.remove(&id);
    Ok(())
}
