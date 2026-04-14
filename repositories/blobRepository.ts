import { base64ToUint8Array } from "lib/db/utils";
import { AppBlob } from "lib/watermelon/models/Blob";
import { BaseRepository } from "repositories/baseRepository";

export type BlobViewPayload = {
  body: Uint8Array;
  mimeType: string;
  contentLength: number;
  messageId?: string;
  fileName?: string;
};

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

  /** Metadata + bytes for attachment preview / export. */
  async getBlobViewPayload(blobId: string): Promise<BlobViewPayload | null> {
    try {
      const m = await this.blobs().find(blobId);
      const body = base64ToUint8Array(m.bodyBase64);
      const mime = m.mimeType?.trim() ?? "application/octet-stream";
      return {
        body,
        mimeType: mime,
        contentLength: m.contentLength ?? body.byteLength,
        messageId: m.messageId?.trim(),
        fileName: m.fileName?.trim(),
      };
    } catch {
      return null;
    }
  }
}
