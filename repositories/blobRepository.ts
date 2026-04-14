import { normalizeSqliteBlob } from "lib/sqlite/utils";
import { BaseSqliteRepository } from "lib/sqlite/baseRepository";

export class BlobRepository extends BaseSqliteRepository {
  async getBody(blobId: string): Promise<Uint8Array | null> {
    const db = await this.db();
    const row = await db.getFirstAsync<{ body: unknown }>(
      `SELECT body FROM blobs WHERE id = ?`,
      blobId,
    );
    return normalizeSqliteBlob(row?.body ?? null);
  }
}

