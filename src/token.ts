import { randomUUID } from "node:crypto";

export function createEmailTokenId(): string {
  const token_suffix = randomUUID().replaceAll("-", "");
  return `email_token_${token_suffix}`;
}
