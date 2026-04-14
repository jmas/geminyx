import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export class Account extends Model {
  static override table = "accounts";

  @field("name") name!: string;
  @field("email") email?: string;
  @field("avatar_url") avatarUrl?: string;
  @field("capsule_url") capsuleUrl?: string;
  @field("gemini_client_p12_base64") geminiClientP12Base64?: string;
  @field("gemini_client_p12_passphrase") geminiClientP12Passphrase?: string;
  @field("is_active") isActive!: boolean;
}
