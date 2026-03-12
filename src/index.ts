import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { z } from "zod";

import { loadConfig } from "./config.js";
import { findLatestMatchingIncomingResponse, sendUserEmail } from "./email.js";
import { StateStore, type EmailTokenRecord } from "./state.js";
import { createEmailTokenId } from "./token.js";

const script_file_path = fileURLToPath(import.meta.url);
const script_dir_path = dirname(script_file_path);
dotenv.config({ path: resolve(script_dir_path, "../.env"), quiet: true });

function textResponse(payload: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
}

function sleep(wait_ms: number): Promise<void> {
  return new Promise((resolve_sleep) => setTimeout(resolve_sleep, wait_ms));
}

async function startServer(): Promise<void> {
  const config = loadConfig();
  const state_store = new StateStore(config.state_file_path);

  const mcp_server = new McpServer({
    name: "senduseremailtool",
    version: "0.1.0",
  });

  mcp_server.registerTool(
    "senduseremailtool",
    {
      title: "Send User Email Tool",
      description:
        "Send an email message to the preconfigured recipient and return an email token.",
      inputSchema: {
        message_text: z.string().min(1),
      },
    },
    async ({ message_text }) => {
      const email_token_id = createEmailTokenId();
      const send_result = await sendUserEmail(
        config,
        message_text,
        email_token_id,
      );

      const record: EmailTokenRecord = {
        email_token_id,
        outbound_message_text: message_text,
        outbound_recipient_email: config.recipient_email,
        outbound_sent_unix_ms: send_result.outbound_sent_unix_ms,
        outbound_smtp_message_id: send_result.outbound_smtp_message_id,
      };

      await state_store.upsertRecord(record);

      return textResponse({
        status: "sent",
        email_token_id,
        recipient_email: config.recipient_email,
        sent_unix_ms: send_result.outbound_sent_unix_ms,
      });
    },
  );

  mcp_server.registerTool(
    "waitforresponsefromemailtool",
    {
      title: "Wait For Response From Email Tool",
      description:
        "Wait up to timeout_ms for a reply email that contains the provided email_token_id in the body.",
      inputSchema: {
        email_token_id: z.string().min(1),
        timeout_ms: z.number().int().positive().optional(),
      },
    },
    async ({ email_token_id, timeout_ms }) => {
      const wait_timeout_ms = timeout_ms ?? 60_000;
      const existing_record = await state_store.getRecord(email_token_id);

      if (!existing_record) {
        throw new Error(`Unknown email token: ${email_token_id}`);
      }

      if (
        existing_record.inbound_response_unix_ms !== undefined &&
        existing_record.inbound_response_text !== undefined &&
        existing_record.inbound_response_from_email !== undefined
      ) {
        return textResponse({
          status: "received",
          email_token_id,
          response_text: existing_record.inbound_response_text,
          response_unix_ms: existing_record.inbound_response_unix_ms,
          response_from_email: existing_record.inbound_response_from_email,
          response_subject: existing_record.inbound_response_subject ?? "",
        });
      }

      const wait_started_unix_ms = Date.now();
      const wait_deadline_unix_ms = wait_started_unix_ms + wait_timeout_ms;

      while (Date.now() < wait_deadline_unix_ms) {
        const incoming_response = await findLatestMatchingIncomingResponse(
          config,
          email_token_id,
          existing_record.outbound_sent_unix_ms,
        );

        if (incoming_response) {
          const updated_record: EmailTokenRecord = {
            ...existing_record,
            ...incoming_response,
          };

          await state_store.upsertRecord(updated_record);

          return textResponse({
            status: "received",
            email_token_id,
            response_text: incoming_response.inbound_response_text,
            response_unix_ms: incoming_response.inbound_response_unix_ms,
            response_from_email: incoming_response.inbound_response_from_email,
            response_subject: incoming_response.inbound_response_subject,
          });
        }

        const remaining_wait_ms = wait_deadline_unix_ms - Date.now();
        if (remaining_wait_ms <= 0) {
          break;
        }

        await sleep(Math.min(config.poll_interval_ms, remaining_wait_ms));
      }

      return textResponse({
        status: "timeout",
        email_token_id,
        timeout_ms: wait_timeout_ms,
        waited_ms: Date.now() - wait_started_unix_ms,
      });
    },
  );

  const stdio_transport = new StdioServerTransport();
  await mcp_server.connect(stdio_transport);
}

startServer().catch((error) => {
  console.error(
    `startServer - ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
