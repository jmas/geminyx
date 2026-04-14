import type { Capsule } from "lib/models/capsule";
import { normalizeGeminiCapsuleRootUrl } from "lib/models/gemini";
import { SEED_CAPSULE_TEMPLATES } from "lib/resources/seedCapsules";
import { newId } from "lib/sqlite/utils";
import { BaseSqliteRepository } from "lib/sqlite/baseRepository";

export type CapsuleInsert = {
  name: string;
  avatarUrl?: string;
  url?: string;
  description?: string;
  id?: string;
  accountId: string;
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

  async listForAccount(accountId: string): Promise<Capsule[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<{
      id: string;
      name: string;
      avatar_url: string | null;
      url: string | null;
      description: string | null;
    }>(
      `SELECT id, name, avatar_url, url, description
       FROM capsules
       WHERE account_id = ?
       ORDER BY name COLLATE NOCASE ASC`,
      accountId,
    );
    return rows.map((r) => this.rowToCapsule(r));
  }

  async getByIdForAccount(
    accountId: string,
    capsuleId: string,
  ): Promise<Capsule | null> {
    const db = await this.db();
    const row = await db.getFirstAsync<{
      id: string;
      name: string;
      avatar_url: string | null;
      url: string | null;
      description: string | null;
    }>(
      `SELECT id, name, avatar_url, url, description
       FROM capsules
       WHERE account_id = ? AND id = ?`,
      accountId,
      capsuleId,
    );
    return row ? this.rowToCapsule(row) : null;
  }

  async patch(capsuleId: string, patch: CapsulePatch): Promise<void> {
    const db = await this.db();
    // Patch is scoped by caller (active account) via `getByIdForAccount` in adapters.
    // Keep this legacy read permissive to avoid breaking internal tooling.
    const existing = await db.getFirstAsync<{
      id: string;
      name: string;
      avatar_url: string | null;
      url: string | null;
      description: string | null;
    }>(
      `SELECT id, name, avatar_url, url, description FROM capsules WHERE id = ?`,
      capsuleId,
    );
    if (!existing) {
      throw new Error("capsule.patch: capsule not found");
    }

    const existingCapsule = this.rowToCapsule(existing);
    const nextName = (patch.name ?? existingCapsule.name).trim();
    const nextAvatarUrl = (patch.avatarUrl ?? existingCapsule.avatarUrl ?? "").trim();
    const nextUrl = (patch.url ?? existingCapsule.url ?? "").trim();
    const nextDescription = (patch.description ?? existingCapsule.description ?? "").trim();

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
    const accountId = input.accountId.trim();
    if (!accountId) {
      throw new Error("capsule.insertWithDialog: accountId is required");
    }
    const name = input.name.trim();
    const avatarUrl = input.avatarUrl?.trim();
    const url = input.url?.trim();
    const description = input.description?.trim();
    const db = await this.db();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO capsules (id, name, avatar_url, url, description, account_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        id,
        name,
        avatarUrl ? avatarUrl : null,
        url ? url : null,
        description ? description : null,
        accountId,
      );
      await db.runAsync(
        `INSERT INTO dialogs (id, capsule_id, message_id, last_message_at) VALUES (?, ?, NULL, ?)`,
        id,
        id,
        new Date(0).toISOString(),
      );
    });
    const row = await this.getByIdForAccount(accountId, id);
    if (!row) {
      throw new Error("capsule.insertWithDialog: row missing after insert");
    }
    return row;
  }

  /** Inserts the default starter capsules when this account has none (e.g. new account). */
  async seedDefaultCapsulesIfEmpty(accountId: string): Promise<void> {
    const existing = await this.listForAccount(accountId);
    if (existing.length > 0) return;
    for (const t of SEED_CAPSULE_TEMPLATES) {
      const rawUrl = t.url?.trim();
      await this.insertWithDialog({
        accountId,
        name: t.name,
        url: rawUrl ? normalizeGeminiCapsuleRootUrl(rawUrl) : undefined,
        description: t.description,
      });
    }
  }
}

export const capsulesRepo = new CapsuleRepository();

