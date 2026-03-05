// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::ffi::OsString;
use std::process::{Command as StdCommand, Stdio};
#[cfg(windows)]
use std::os::windows::process::CommandExt;

fn parse_runner_args(args: &[OsString]) -> Result<(OsString, Option<OsString>, Vec<OsString>), String> {
  let mut exe_path: Option<OsString> = None;
  let mut cwd_path: Option<OsString> = None;
  let mut passthrough: Vec<OsString> = Vec::new();
  let mut idx = 0usize;
  let mut in_passthrough = false;

  while idx < args.len() {
    let current = &args[idx];
    let current_s = current.to_string_lossy();
    if in_passthrough {
      passthrough.push(current.clone());
      idx += 1;
      continue;
    }

    match current_s.as_ref() {
      "--" => {
        in_passthrough = true;
        idx += 1;
      }
      "--exe" => {
        idx += 1;
        if idx >= args.len() {
          return Err("Missing value after --exe".to_string());
        }
        exe_path = Some(args[idx].clone());
        idx += 1;
      }
      "--cwd" => {
        idx += 1;
        if idx >= args.len() {
          return Err("Missing value after --cwd".to_string());
        }
        cwd_path = Some(args[idx].clone());
        idx += 1;
      }
      _ => {
        idx += 1;
      }
    }
  }

  let exe = exe_path.ok_or_else(|| "Missing required --exe <path> argument".to_string())?;
  Ok((exe, cwd_path, passthrough))
}

fn run_waifu2x_runner(args: &[OsString]) -> i32 {
  let (exe_path, cwd_path, passthrough) = match parse_runner_args(args) {
    Ok(v) => v,
    Err(msg) => {
      eprintln!("[Kodo Runner] {}", msg);
      return 2;
    }
  };

  let mut command = StdCommand::new(&exe_path);
  command
    .args(&passthrough)
    .stdin(Stdio::null())
    .stdout(Stdio::inherit())
    .stderr(Stdio::inherit());

  if let Some(cwd) = cwd_path {
    command.current_dir(cwd);
  }

  #[cfg(windows)]
  command.creation_flags(0x08000000);

  let status = match command.status() {
    Ok(s) => s,
    Err(err) => {
      eprintln!("[Kodo Runner] Failed to spawn target process: {}", err);
      return 1;
    }
  };

  status.code().unwrap_or(1)
}

fn main() {
  let args: Vec<OsString> = std::env::args_os().collect();
  if args.len() > 1
    && (
      args[1].to_string_lossy() == "--kodo-waifu2x-runner"
      || args[1].to_string_lossy() == "--kodo-realesrgan-runner"
    ) {
    let code = run_waifu2x_runner(&args[2..]);
    std::process::exit(code);
  }

  app_lib::run();
}
