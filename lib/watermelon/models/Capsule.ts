import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export class Capsule extends Model {
  static override table = "capsules";

  @field("name") name!: string;
  @field("avatar_url") avatarUrl?: string;
  @field("url") url?: string;
  @field("description") description?: string;
  @field("account_id") accountId!: string;
}
