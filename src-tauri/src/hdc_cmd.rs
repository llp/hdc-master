use std::process::Command;

// 这是一个 helper 函数，不是 tauri command
pub fn exec_shell(device_id: &str, args: Vec<&str>) -> Result<String, String> {
    // 实际执行时，我们可能需要根据环境变量找到 hdc 的绝对路径
    // 比如 let hdc_path = "/Users/xxx/Library/Huawei/Sdk/hmscore/3.1.0/toolchains/hdc";
    let hdc_cmd = "hdc";

    let mut cmd = Command::new(hdc_cmd);
    cmd.arg("-t").arg(device_id).arg("shell");

    // 将前端传来的 aa start ... 参数追加进去
    for arg in args {
        cmd.arg(arg);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute hdc: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
