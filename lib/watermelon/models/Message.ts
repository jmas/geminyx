import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export class Message extends Model {
  static override table = "messages";

  @field("thread_id") threadId!: string;
  @field("content_length") contentLength!: number;
  @field("body") body?: string;
  @field("blob_id") blobId?: string;
  @field("status") status?: number;
  @field("meta") meta?: string;
  @field("sent_at") sentAt!: string;
  @field("is_outgoing") isOutgoing!: boolean;
  @field("request_path") requestPath!: string;
}
