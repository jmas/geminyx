import type { Capsule } from "lib/models/capsule";
import { newId } from "lib/sqlite/utils";
import { BaseSqliteRepository } from "lib/sqlite/baseRepository";

export type CapsuleInsert = {
  name: string;
  avatarUrl?: string;
  url?: string;
  description?: string;
  id?: string;
};

export type CapsulePatch = {
  name?: string;
  avatarUrl?: string;
  url?: string;
  description?: string;
};

export class CapsuleRepository extends BaseSqliteRepository {
  private rowToCapsule(r: {
    id: string;
    name: string;
    avatar_url: string | null;
    url: string | null;
    description: string | null;
  }): Capsule {
    return {
      id: r.id,
      name: r.name,
      avatarUrl: r.avatar_url ?? undefined,
      url: r.url ?? undefined,
      description: r.description?.trim() ? r.description.trim() : undefined,
    };
  }

  async list(): Promise<Capsule[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<{
      id: string;
      name: string;
      avatar_url: string | null;
      url: string | null;
      description: string | null;
    }>(
      `SELECT id, name, avatar_url, url, description FROM capsules ORDER BY name COLLATE NOCASE ASC`,
    );
    return rows.map((r) => this.rowToCapsule(r));
  }

  async getById(capsuleId: string): Promise<Capsule | null> {
    const db = await this.db();
    const row = await db.getFirstAsync<{
      id: string;
      name: string;
      avatar_url: string | null;
      url: string | null;
      description: string | null;
    }>(
      `SELECT id, name, avatar_url, url, description FROM capsules WHERE id = ?`,
      capsuleId,
    );
    return row ? this.rowToCapsule(row) : null;
  }

  async patch(capsuleId: string, patch: CapsulePatch): Promise<void> {
    const db = await this.db();
    const existing = await this.getById(capsuleId);
    if (!existing) {
      throw new Error("capsule.patch: capsule not found");
    }

    const nextName = (patch.name ?? existing.name).trim();
    const nextAvatarUrl = (patch.avatarUrl ?? existing.avatarUrl ?? "").trim();
    const nextUrl = (patch.url ?? existing.url ?? "").trim();
    const nextDescription = (patch.description ?? existing.description ?? "").trim();

    await db.runAsync(
      `UPDATE capsules SET name = ?, avatar_url = ?, url = ?, description = ? WHERE id = ?`,
      nextName,
      nextAvatarUrl ? nextAvatarUrl : null,
      nextUrl ? nextUrl : null,
      nextDescription ? nextDescription : null,
      capsuleId,
    );
  }

  /** Removes the capsule and, via FK CASCADE, its dialog and all messages. */
  async deleteCascade(capsuleId: string): Promise<void> {
    const db = await this.db();
    await db.runAsync(`DELETE FROM capsules WHERE id = ?`, capsuleId);
  }

  /** Inserts a capsule and its dialog row (same id for both, matching existing schema). */
  async insertWithDialog(input: CapsuleInsert): Promise<Capsule> {
    const id = input.id ?? newId("cap");
    const name = input.name.trim();
    const avatarUrl = input.avatarUrl?.trim();
    const url = input.url?.trim();
    const description = input.description?.trim();
    const db = await this.db();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO capsules (id, name, avatar_url, url, description) VALUES (?, ?, ?, ?, ?)`,
        id,
        name,
        avatarUrl ? avatarUrl : null,
        url ? url : null,
        description ? description : null,
      );
      await db.runAsync(
        `INSERT INTO dialogs (id, capsule_id, message_id, last_message_at) VALUES (?, ?, NULL, ?)`,
        id,
        id,
        new Date(0).toISOString(),
      );
    });
    const row = await this.getById(id);
    if (!row) {
      throw new Error("capsule.insertWithDialog: row missing after insert");
    }
    return row;
  }
}

