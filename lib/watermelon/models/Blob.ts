import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export class AppBlob extends Model {
  static override table = "blobs";

  @field("body_base64") bodyBase64!: string;
  @field("message_id") messageId?: string;
  @field("mime_type") mimeType?: string;
  @field("content_length") contentLength?: number;
  @field("file_name") fileName?: string;
}
