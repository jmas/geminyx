import type { Relation } from "@nozbe/watermelondb";
import type { Account } from "lib/watermelon/models/Account";
import { Model } from "@nozbe/watermelondb";
import { field, relation } from "@nozbe/watermelondb/decorators";

export class Setting extends Model {
  static override table = "settings";

  static override associations = {
    accounts: { type: "belongs_to", key: "account_id" },
  } as const;

  @field("account_id") accountId?: string;
  @field("setting_key") settingKey!: string;
  @field("value_json") valueJson!: string;

  @relation("accounts", "account_id") account!: Relation<Account>;
}
