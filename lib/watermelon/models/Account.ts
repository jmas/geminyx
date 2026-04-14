import type { Query } from "@nozbe/watermelondb";
import { Model } from "@nozbe/watermelondb";
import { children, field } from "@nozbe/watermelondb/decorators";
import type { Setting } from "lib/watermelon/models/Setting";

export class Account extends Model {
  static override table = "accounts";

  static override associations = {
    settings: { type: "has_many", foreignKey: "account_id" },
  } as const;

  @field("name") name!: string;
  @field("email") email?: string;
  @field("avatar_url") avatarUrl?: string;
  @field("capsule_url") capsuleUrl?: string;
  @field("gemini_client_p12_base64") geminiClientP12Base64?: string;
  @field("gemini_client_p12_passphrase") geminiClientP12Passphrase?: string;
  @field("is_active") isActive!: boolean;

  @children("settings") settings!: Query<Setting>;
}
