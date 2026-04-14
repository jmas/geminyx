import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

/** Watermelon model for the `capsule_categories` table. */
export class Category extends Model {
  static override table = "capsule_categories";

  @field("name") name!: string;
  @field("sort_order") sortOrder!: number;
  @field("account_id") accountId!: string;
}
