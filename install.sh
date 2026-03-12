#!/usr/bin/env bash
set -euo pipefail

SERVER_NAME="senduseremailtool"
SKILL_NAME="senduseremailtool"
DEFAULT_STATE_FILE="~/.senduseremailtool/state.json"
DEFAULT_IMAP_MAILBOX="INBOX"

log_main() {
  printf 'main - %s\n' "$1"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'require_command - Missing required command: %s\n' "$command_name" >&2
    exit 1
  fi
}

prompt_required() {
  local prompt_text="$1"
  local input_value=""
  while [[ -z "$input_value" ]]; do
    read -r -p "prompt_required - ${prompt_text}: " input_value
  done
  printf '%s' "$input_value"
}

prompt_secret() {
  local prompt_text="$1"
  local input_value=""
  while [[ -z "$input_value" ]]; do
    read -r -s -p "prompt_secret - ${prompt_text}: " input_value
    printf '\n' >&2
  done
  printf '%s' "$input_value"
}

escape_dotenv() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

trim_whitespace() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

choose_target() {
  local selected_target=""
  while [[ -z "$selected_target" ]]; do
    read -r -p "choose_target - Install target (codex/claude): " selected_target
    if [[ "$selected_target" != "codex" && "$selected_target" != "claude" ]]; then
      printf 'choose_target - Please enter codex or claude\n'
      selected_target=""
    fi
  done
  printf '%s' "$selected_target"
}

write_env_file() {
  local recipient_email="$1"
  local gmail_login_email="$2"
  local gmail_app_password="$3"

  cat > .env <<ENVFILE
SENDUSEREMAILTOOL_RECIPIENT_EMAIL="$(escape_dotenv "$recipient_email")"
SENDUSEREMAILTOOL_SEND_FROM_EMAIL="$(escape_dotenv "$gmail_login_email")"
SENDUSEREMAILTOOL_GMAIL_LOGIN_EMAIL="$(escape_dotenv "$gmail_login_email")"
SENDUSEREMAILTOOL_GMAIL_APP_PASSWORD="$(escape_dotenv "$gmail_app_password")"
SENDUSEREMAILTOOL_IMAP_MAILBOX="${DEFAULT_IMAP_MAILBOX}"
SENDUSEREMAILTOOL_STATE_FILE="${DEFAULT_STATE_FILE}"
ENVFILE

  printf 'write_env_file - Wrote .env\n'
}

install_skill_codex() {
  local skill_destination="$HOME/.codex/skills/${SKILL_NAME}"
  mkdir -p "$HOME/.codex/skills"
  rm -rf "$skill_destination"
  cp -R "skills/${SKILL_NAME}" "$skill_destination"
  printf 'install_skill_codex - Installed skill to %s\n' "$skill_destination"
}

install_skill_claude() {
  local skill_destination="$HOME/.claude/skills/${SKILL_NAME}"
  mkdir -p "$HOME/.claude/skills"
  rm -rf "$skill_destination"
  cp -R "skills/${SKILL_NAME}" "$skill_destination"
  printf 'install_skill_claude - Installed skill to %s\n' "$skill_destination"
}

configure_codex_mcp() {
  local server_path="$1"

  codex mcp remove "$SERVER_NAME" >/dev/null 2>&1 || true
  codex mcp add "$SERVER_NAME" \
    -- node "$server_path"

  printf 'configure_codex_mcp - Configured Codex MCP server using %s\n' "$server_path"
}

configure_claude_mcp() {
  local server_path="$1"

  claude mcp remove -s user "$SERVER_NAME" >/dev/null 2>&1 || true
  claude mcp add -s user \
    "$SERVER_NAME" -- node "$server_path"

  printf 'configure_claude_mcp - Configured Claude MCP server using %s\n' "$server_path"
}

main() {
  if [[ ! -f package.json || ! -d "skills/${SKILL_NAME}" ]]; then
    printf 'main - Run this script from the repository root\n' >&2
    exit 1
  fi

  require_command node
  require_command npm

  local target
  target="$(choose_target)"

  if [[ "$target" == "codex" ]]; then
    require_command codex
  else
    require_command claude
  fi

  log_main "Gmail is required for authentication."
  log_main "Create an app password first: https://myaccount.google.com/apppasswords"

  local gmail_login_email
  gmail_login_email="$(prompt_required "Gmail login email")"

  local gmail_app_password
  gmail_app_password="$(trim_whitespace "$(prompt_secret "Gmail app password")")"

  local recipient_email
  recipient_email="$(prompt_required "Recipient email for outgoing questions")"

  write_env_file "$recipient_email" "$gmail_login_email" "$gmail_app_password"

  log_main "Installing dependencies"
  npm install

  log_main "Building TypeScript server"
  npm run build

  local server_path
  server_path="$(pwd)/dist/index.js"

  if [[ "$target" == "codex" ]]; then
    install_skill_codex
    configure_codex_mcp "$server_path"
    log_main "Done. Restart Codex to ensure the new skill is loaded."
  else
    install_skill_claude
    configure_claude_mcp "$server_path"
    log_main "Done. Restart Claude Code to ensure the new skill is loaded."
  fi
}

main
