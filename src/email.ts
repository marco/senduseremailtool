import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

import type { SendUserEmailToolConfig } from "./config.js";

export type IncomingEmailResponse = {
  inbound_response_unix_ms: number;
  inbound_response_text: string;
  inbound_response_subject: string;
  inbound_response_from_email: string;
  inbound_response_imap_uid: number;
};

function normalizeEmailAddress(email_value: string): string {
  return email_value.trim().toLowerCase();
}

function isExpectedSender(
  expected_email: string,
  sender_email: string,
): boolean {
  return (
    normalizeEmailAddress(expected_email) ===
    normalizeEmailAddress(sender_email)
  );
}

function buildOutboundMessageText(
  message_text: string,
  email_token_id: string,
): string {
  return `${message_text}\n\nSENDUSEREMAILTOOL_TOKEN:${email_token_id}`;
}

export async function sendUserEmail(
  config: SendUserEmailToolConfig,
  message_text: string,
  email_token_id: string,
): Promise<{
  outbound_smtp_message_id?: string;
  outbound_sent_unix_ms: number;
}> {
  const smtp_transport = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_secure,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
  });

  const outbound_sent_unix_ms = Date.now();
  const outbound_message_text = buildOutboundMessageText(
    message_text,
    email_token_id,
  );

  try {
    const send_result = await smtp_transport.sendMail({
      from: config.send_from_email,
      to: config.recipient_email,
      subject: "Message from senduseremailtool",
      text: outbound_message_text,
    });

    return {
      outbound_smtp_message_id: send_result.messageId,
      outbound_sent_unix_ms,
    };
  } finally {
    smtp_transport.close();
  }
}

function bufferFromUnknown(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  throw new Error("IMAP message source is missing");
}

export async function findLatestMatchingIncomingResponse(
  config: SendUserEmailToolConfig,
  email_token_id: string,
  outbound_sent_unix_ms: number,
): Promise<IncomingEmailResponse | null> {
  const imap_client = new ImapFlow({
    host: config.imap_host,
    port: config.imap_port,
    secure: config.imap_secure,
    auth: {
      user: config.imap_user,
      pass: config.imap_pass,
    },
    logger: false,
  });

  await imap_client.connect();
  let mailbox_lock: { release: () => void } | undefined;

  try {
    mailbox_lock = await imap_client.getMailboxLock(config.imap_mailbox);
    const search_since_date = new Date(outbound_sent_unix_ms);
    const message_seqs = await imap_client.search({ since: search_since_date });
    if (!message_seqs || message_seqs.length === 0) {
      return null;
    }

    const ordered_seqs = [...message_seqs].sort((left, right) => right - left);

    for (const message_seq of ordered_seqs) {
      const message = await imap_client.fetchOne(message_seq, {
        uid: true,
        envelope: true,
        source: true,
        internalDate: true,
      });

      if (!message || !message.source) {
        continue;
      }

      const parsed_message = await simpleParser(
        bufferFromUnknown(message.source),
      );
      const sender_email =
        parsed_message.from?.value[0]?.address ??
        message.envelope?.from?.[0]?.address ??
        "";

      if (!isExpectedSender(config.recipient_email, sender_email)) {
        continue;
      }

      const parsed_text = parsed_message.text ?? "";
      if (!parsed_text.includes(email_token_id)) {
        continue;
      }

      const inbound_response_unix_ms =
        (message.internalDate instanceof Date
          ? message.internalDate.getTime()
          : undefined) ?? Date.now();

      if (inbound_response_unix_ms < outbound_sent_unix_ms) {
        continue;
      }

      return {
        inbound_response_unix_ms,
        inbound_response_text: parsed_text,
        inbound_response_subject:
          parsed_message.subject ?? message.envelope?.subject ?? "",
        inbound_response_from_email: sender_email,
        inbound_response_imap_uid: message.uid,
      };
    }

    return null;
  } finally {
    mailbox_lock?.release();
    await imap_client.logout();
  }
}
