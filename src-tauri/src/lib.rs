use std::process::Command as StdCommand;
use std::sync::Mutex;
use tauri::Manager;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

struct ServerState {
    port: u16,
    child: Option<std::process::Child>,
}

struct RuntimePaths {
    app_root: std::path::PathBuf,
    resource_root: std::path::PathBuf,
    server_script: std::path::PathBuf,
    is_packaged: bool,
}

#[tauri::command]
fn get_server_port(state: tauri::State<'_, Mutex<ServerState>>) -> u16 {
    state.lock().unwrap().port
}

fn find_free_port() -> u16 {
    portpicker::pick_unused_port().expect("No free port found")
}

fn find_project_root() -> std::path::PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    let cwd = std::env::current_dir().ok();

    // Strategy 1: Check if CWD has server/index.js
    if let Some(ref dir) = cwd {
        if dir.join("server").join("index.js").exists() {
            return dir.clone();
        }
    }

    // Strategy 2: CWD might be inside src-tauri, go up one level
    if let Some(ref dir) = cwd {
        if let Some(parent) = dir.parent() {
            if parent.join("server").join("index.js").exists() {
                return parent.to_path_buf();
            }
        }
    }

    // Strategy 3: exe is in src-tauri/target/debug, go up 3 levels
    if let Some(ref dir) = exe_dir {
        let mut current = dir.clone();
        for _ in 0..4 {
            if current.join("server").join("index.js").exists() {
                return current;
            }
            if let Some(parent) = current.parent() {
                current = parent.to_path_buf();
            } else {
                break;
            }
        }
    }

    cwd.unwrap_or_else(|| std::path::PathBuf::from("."))
}

fn resolve_runtime_paths(app_handle: &tauri::AppHandle) -> RuntimePaths {
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        // Tauri v2 maps "../" paths in resources to "_up_/"
        let server_script_up = resource_dir.join("_up_").join("server").join("index.js");
        if server_script_up.exists() {
            return RuntimePaths {
                app_root: resource_dir.join("_up_"),
                resource_root: resource_dir.clone(),
                server_script: server_script_up,
                is_packaged: true,
            };
        }

        let server_script = resource_dir.join("server").join("index.js");
        if server_script.exists() {
            return RuntimePaths {
                app_root: resource_dir.clone(),
                resource_root: resource_dir,
                server_script,
                is_packaged: true,
            };
        }
    }

    let project_root = find_project_root();
    RuntimePaths {
        app_root: project_root.clone(),
        resource_root: project_root.clone(),
        server_script: project_root.join("server").join("index.js"),
        is_packaged: false,
    }
}

fn resolve_node_command(resource_root: &std::path::Path) -> std::path::PathBuf {
    let primary = resource_root.join("bin").join("node.exe");
    if primary.exists() {
        return primary;
    }

    if let Some(parent) = resource_root.parent() {
        let sibling = parent.join("bin").join("node.exe");
        if sibling.exists() {
            return sibling;
        }
    }

    std::path::PathBuf::from("node")
}

fn dir_has_entries(path: &std::path::Path) -> bool {
    std::fs::read_dir(path)
        .ok()
        .and_then(|mut it| it.next())
        .is_some()
}

fn is_within_path(child: &std::path::Path, parent: &std::path::Path) -> bool {
    let child_abs = std::fs::canonicalize(child).unwrap_or_else(|_| child.to_path_buf());
    let parent_abs = std::fs::canonicalize(parent).unwrap_or_else(|_| parent.to_path_buf());
    child_abs.starts_with(parent_abs)
}

fn resolve_manga_root(app_handle: &tauri::AppHandle, runtime: &RuntimePaths) -> std::path::PathBuf {
    if let Ok(from_env) = std::env::var("KODO_MANGA_PATH") {
        let p = std::path::PathBuf::from(from_env);
        if !p.as_os_str().is_empty() {
            return p;
        }
    }

    let data_manga = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| runtime.app_root.clone())
        .join("manga");
    let project_manga = find_project_root().join("manga");
    let runtime_manga = runtime.app_root.join("manga");
    let cwd_manga = std::env::current_dir()
        .unwrap_or_else(|_| runtime.app_root.clone())
        .join("manga");

    let candidates = vec![
        project_manga.clone(),
        cwd_manga.clone(),
        runtime_manga.clone(),
        data_manga.clone(),
    ];

    if let Some(path) = candidates
        .iter()
        .find(|p| p.exists() && p.is_dir() && dir_has_entries(p))
    {
        return path.clone();
    }

    if let Some(path) = candidates.iter().find(|p| p.exists() && p.is_dir()) {
        return path.clone();
    }

    data_manga
}

fn resolve_persistent_app_root(
    app_handle: &tauri::AppHandle,
    runtime: &RuntimePaths,
) -> std::path::PathBuf {
    if let Ok(from_env) = std::env::var("KODO_APP_ROOT") {
        let p = std::path::PathBuf::from(from_env);
        if !p.as_os_str().is_empty() {
            let project_root = find_project_root();
            if !is_within_path(&p, &project_root) {
                return p;
            }
            eprintln!(
                "[Kodo] Ignoring KODO_APP_ROOT inside project root: {:?}. Using AppData path instead.",
                p
            );
        }
    }

    #[cfg(windows)]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let p = std::path::PathBuf::from(appdata).join("kodo");
            if !p.as_os_str().is_empty() {
                return p;
            }
        }
    }

    app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| runtime.app_root.clone())
        .join("kodo")
}

#[cfg(windows)]
fn normalize_for_node(path: &std::path::Path) -> std::path::PathBuf {
    let raw = path.to_string_lossy();
    if let Some(rest) = raw.strip_prefix(r"\\?\UNC\") {
        return std::path::PathBuf::from(format!(r"\\{}", rest));
    }
    if let Some(rest) = raw.strip_prefix(r"\\?\") {
        return std::path::PathBuf::from(rest);
    }
    path.to_path_buf()
}

#[cfg(not(windows))]
fn normalize_for_node(path: &std::path::Path) -> std::path::PathBuf {
    path.to_path_buf()
}

fn start_node_server(app_handle: &tauri::AppHandle, port: u16) -> Result<std::process::Child, String> {
    let runtime = resolve_runtime_paths(app_handle);
    let node_command = normalize_for_node(&resolve_node_command(&runtime.resource_root));
    let server_script = normalize_for_node(&runtime.server_script);
    let app_root = normalize_for_node(&runtime.app_root);
    let persistent_root = normalize_for_node(&resolve_persistent_app_root(app_handle, &runtime));
    let manga_root = normalize_for_node(&resolve_manga_root(app_handle, &runtime));
    let waifu_runner = std::env::current_exe()
        .ok()
        .map(|p| normalize_for_node(&p))
        .filter(|p| p.exists());

    eprintln!("[Kodo] App root: {:?}", app_root);
    eprintln!("[Kodo] Persistent data root: {:?}", persistent_root);
    eprintln!("[Kodo] Resource root: {:?}", runtime.resource_root);
    eprintln!("[Kodo] Manga root: {:?}", manga_root);
    eprintln!("[Kodo] Server script: {:?}", server_script);
    eprintln!("[Kodo] Server exists: {}", runtime.server_script.exists());
    eprintln!("[Kodo] Node command: {:?}", node_command);
    eprintln!("[Kodo] Packaged mode: {}", runtime.is_packaged);
    eprintln!("[Kodo] Port: {}", port);
    if let Some(ref runner) = waifu_runner {
        eprintln!("[Kodo] Waifu2x Rust runner: {:?}", runner);
    } else {
        eprintln!("[Kodo] Waifu2x Rust runner: unavailable");
    }

    if !runtime.server_script.exists() {
        return Err(format!(
            "Cannot find server/index.js. Ensure bundle.resources includes ../server. App root={:?}, resource root={:?}, CWD={:?}, EXE={:?}",
            runtime.app_root,
            runtime.resource_root,
            std::env::current_dir().ok(),
            std::env::current_exe().ok()
        ));
    }

    let mut command = StdCommand::new(&node_command);
    let _ = std::fs::create_dir_all(&persistent_root);
    command
        .arg(&server_script)
        .env("PORT", port.to_string())
        .env("KODO_MANGA_PATH", manga_root.to_string_lossy().to_string())
        .env(
            "KODO_APP_ROOT",
            persistent_root.to_string_lossy().to_string(),
        )
        .env(
            "KODO_RESOURCE_ROOT",
            runtime.resource_root.to_string_lossy().to_string(),
        )
        .env(
            "KODO_IS_PACKAGED",
            if runtime.is_packaged { "1" } else { "0" },
        );

    if let Some(ref runner) = waifu_runner {
        command.env(
            "KODO_WAIFU2X_RUNNER",
            runner.to_string_lossy().to_string(),
        );
        command.env(
            "KODO_REALESRGAN_RUNNER",
            runner.to_string_lossy().to_string(),
        );
    }

    command
        .current_dir(&app_root)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    #[cfg(windows)]
    command.creation_flags(0x08000000);

    let child = command
        .spawn()
        .map_err(|err| {
            format!(
                "Failed to start Node.js server with {:?}: {}. Ensure Node.js is installed or bundle node.exe in resources/bin.",
                node_command, err
            )
        })?;

    eprintln!("[Kodo] Node server process started (PID: {})", child.id());
    Ok(child)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Find free port for backend server.
            let port = find_free_port();
            let child = match start_node_server(&app.handle().clone(), port) {
                Ok(child) => Some(child),
                Err(err) => {
                    eprintln!("[Kodo] Failed to start backend: {}", err);
                    None
                }
            };
            // Store server state
            app.manage(Mutex::new(ServerState {
                port,
                child,
            }));

            // Always show the window immediately so the app never appears as a background-only process.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_server_port])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the Node server when the window is closed
                if let Some(state) = window.try_state::<Mutex<ServerState>>() {
                    if let Ok(mut state) = state.lock() {
                        if let Some(ref mut child) = state.child {
                            eprintln!("[Kodo] Killing Node server (PID: {})", child.id());
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
