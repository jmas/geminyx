import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export class Thread extends Model {
  static override table = "threads";

  @field("capsule_id") capsuleId!: string;
  @field("message_id") messageId?: string;
  @field("last_message_at") lastMessageAt!: string;
  @field("client_cert_share_allowed") clientCertShareAllowed!: boolean;
}
