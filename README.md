# senduseremailtool

**`AskUserQuestionTool`** is an internal tool exposed to agents like Claude Code for asking a user a question. **`SendUserEmailTool`** is a locally hosted replacement for AUQT that sends you an email instead.

---

## Installation

```bash
git clone https://github.com/marco/senduseremailtool.git
cd senduseremailtool
./install.sh
```

---

## Details

Exposes two tools via MCP:

- `senduseremailtool`: send an email to one preconfigured recipient and return an `email_token_id`.
- `waitforresponsefromemailtool`: wait up to `timeout_ms` for an email reply containing that token.

This repo also includes a skill at `skills/senduseremailtool/SKILL.md` that instructs agents to keep waiting in a loop until a reply is received and informs them how to use senduseremailtool.

The installer asks whether you are setting up `codex` or `claude`, requires:

- Gmail login email
- Gmail app password
- recipient email

for the email to send senduseremailtool emails from. (I'd recommend setting up a burner/spam email to send the emails.)

Then, instruct the agent to use senduseremailtool when it runs into questions.

> Security warning: store your Google app password securely, and do not share it with anyone after installing the MCP server.

## Prerequisites

- Node.js 20+
- `codex` CLI (if installing for Codex) or `claude` CLI (if installing for Claude)
- A Gmail account with an app password enabled

Create app password: `https://myaccount.google.com/apppasswords`

## Manual environment variables

If you need manual overrides, these are the relevant env vars:

- `SENDUSEREMAILTOOL_RECIPIENT_EMAIL`
- `SENDUSEREMAILTOOL_GMAIL_LOGIN_EMAIL`
- `SENDUSEREMAILTOOL_GMAIL_APP_PASSWORD`
- `SENDUSEREMAILTOOL_SEND_FROM_EMAIL` (optional, defaults to Gmail login email)
- `SENDUSEREMAILTOOL_IMAP_MAILBOX` (optional, default `INBOX`)
- `SENDUSEREMAILTOOL_STATE_FILE` (optional, default `~/.senduseremailtool/state.json`)

## Tool contracts

### `senduseremailtool`

Input JSON:

```json
{ "message_text": "Need approval on migration plan" }
```

Output JSON text payload:

```json
{"status":"sent","email_token_id":"email_token_...","recipient_email":"...","sent_unix_ms":...}
```

### `waitforresponsefromemailtool`

Input JSON:

```json
{ "email_token_id": "email_token_...", "timeout_ms": 60000 }
```

Output JSON text payload (received):

```json
{"status":"received","email_token_id":"...","response_text":"...","response_unix_ms":...,"response_from_email":"...","response_subject":"..."}
```

Output JSON text payload (timeout):

```json
{"status":"timeout","email_token_id":"...","timeout_ms":60000,"waited_unix_ms":...}
```
