import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export class AppBlob extends Model {
  static override table = "blobs";

  @field("body_base64") bodyBase64!: string;
}
