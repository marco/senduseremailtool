import { homedir } from "node:os";
import { resolve } from "node:path";

export type SendUserEmailToolConfig = {
  recipient_email: string;
  send_from_email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_user: string;
  imap_pass: string;
  imap_mailbox: string;
  state_file_path: string;
  poll_interval_ms: number;
};

const POLL_INTERVAL_MS = 10_000;
const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;
const GMAIL_SMTP_SECURE = true;
const GMAIL_IMAP_HOST = "imap.gmail.com";
const GMAIL_IMAP_PORT = 993;
const GMAIL_IMAP_SECURE = true;

function getRequiredEnv(env_name: string): string {
  const env_value = process.env[env_name];
  if (!env_value) {
    throw new Error(`Missing required environment variable: ${env_name}`);
  }
  return env_value;
}

function expandHomePath(path_value: string): string {
  if (path_value.startsWith("~/")) {
    return resolve(homedir(), path_value.slice(2));
  }
  return resolve(path_value);
}

export function loadConfig(): SendUserEmailToolConfig {
  const state_file_env =
    process.env.SENDUSEREMAILTOOL_STATE_FILE ??
    "~/.senduseremailtool/state.json";
  const gmail_login_email = getRequiredEnv(
    "SENDUSEREMAILTOOL_GMAIL_LOGIN_EMAIL",
  );
  const gmail_app_password = getRequiredEnv(
    "SENDUSEREMAILTOOL_GMAIL_APP_PASSWORD",
  );

  return {
    recipient_email: getRequiredEnv("SENDUSEREMAILTOOL_RECIPIENT_EMAIL"),
    send_from_email:
      process.env.SENDUSEREMAILTOOL_SEND_FROM_EMAIL ?? gmail_login_email,
    smtp_host: GMAIL_SMTP_HOST,
    smtp_port: GMAIL_SMTP_PORT,
    smtp_secure: GMAIL_SMTP_SECURE,
    smtp_user: gmail_login_email,
    smtp_pass: gmail_app_password,
    imap_host: GMAIL_IMAP_HOST,
    imap_port: GMAIL_IMAP_PORT,
    imap_secure: GMAIL_IMAP_SECURE,
    imap_user: gmail_login_email,
    imap_pass: gmail_app_password,
    imap_mailbox: process.env.SENDUSEREMAILTOOL_IMAP_MAILBOX ?? "INBOX",
    state_file_path: expandHomePath(state_file_env),
    poll_interval_ms: POLL_INTERVAL_MS,
  };
}
