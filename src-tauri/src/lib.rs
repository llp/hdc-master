use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init()) // 初始化 Shell 插件
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
