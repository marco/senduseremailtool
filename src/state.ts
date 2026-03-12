import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type EmailTokenRecord = {
  email_token_id: string;
  outbound_message_text: string;
  outbound_recipient_email: string;
  outbound_sent_unix_ms: number;
  outbound_smtp_message_id?: string;
  inbound_response_unix_ms?: number;
  inbound_response_text?: string;
  inbound_response_subject?: string;
  inbound_response_from_email?: string;
  inbound_response_imap_uid?: number;
};

type StateFile = {
  email_token_records_by_email_token_id: Record<string, EmailTokenRecord>;
};

const EMPTY_STATE: StateFile = {
  email_token_records_by_email_token_id: {},
};

export class StateStore {
  constructor(private readonly state_file_path: string) {}

  async getRecord(
    email_token_id: string,
  ): Promise<EmailTokenRecord | undefined> {
    const state_file = await this.readStateFile();
    return state_file.email_token_records_by_email_token_id[email_token_id];
  }

  async upsertRecord(record: EmailTokenRecord): Promise<void> {
    const state_file = await this.readStateFile();
    state_file.email_token_records_by_email_token_id[record.email_token_id] =
      record;
    await this.writeStateFile(state_file);
  }

  private async readStateFile(): Promise<StateFile> {
    await mkdir(dirname(this.state_file_path), { recursive: true });

    try {
      const raw_state = await readFile(this.state_file_path, "utf8");
      const parsed_state = JSON.parse(raw_state) as StateFile;
      if (!parsed_state.email_token_records_by_email_token_id) {
        throw new Error(
          "State file missing email_token_records_by_email_token_id",
        );
      }
      return parsed_state;
    } catch (error) {
      const should_initialize =
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT";

      if (!should_initialize) {
        throw error;
      }

      await this.writeStateFile(EMPTY_STATE);
      return { ...EMPTY_STATE, email_token_records_by_email_token_id: {} };
    }
  }

  private async writeStateFile(state_file: StateFile): Promise<void> {
    const serialized_state = `${JSON.stringify(state_file, null, 2)}\n`;
    await writeFile(this.state_file_path, serialized_state, "utf8");
  }
}
