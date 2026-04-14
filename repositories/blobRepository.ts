import { base64ToUint8Array } from "lib/db/utils";
import { AppBlob } from "lib/watermelon/models/Blob";
import { BaseRepository } from "repositories/baseRepository";

export class BlobRepository extends BaseRepository {
  private blobs() {
    return this.db().get<AppBlob>("blobs");
  }

  async getBody(blobId: string): Promise<Uint8Array | null> {
    try {
      const m = await this.blobs().find(blobId);
      return base64ToUint8Array(m.bodyBase64);
    } catch {
      return null;
    }
  }
}
