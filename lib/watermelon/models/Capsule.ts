import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export class Capsule extends Model {
  static override table = "capsules";

  @field("name") name!: string;
  @field("avatar_icon") avatarIcon?: string;
  @field("url") url?: string;
  @field("description") description?: string;
  @field("account_id") accountId!: string;
  @field("capsule_category_id") categoryId?: string;
}
