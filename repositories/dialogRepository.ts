import type { Dialog } from "lib/models/dialog";
import { BaseSqliteRepository } from "lib/sqlite/baseRepository";

export class DialogRepository extends BaseSqliteRepository {
  private rowToDialog(r: {
    dialog_id: string;
    last_message_at: string;
    client_cert_share_allowed: number;
    capsule_id: string;
    name: string;
    avatar_url: string | null;
    url: string | null;
    description: string | null;
  }): Dialog {
    return {
      id: r.dialog_id,
      lastMessageAt: r.last_message_at,
      clientCertShareAllowed: r.client_cert_share_allowed === 1,
      capsule: {
        id: r.capsule_id,
        name: r.name,
        avatarUrl: r.avatar_url ?? undefined,
        url: r.url ?? undefined,
        description: r.description?.trim() ? r.description.trim() : undefined,
      },
    };
  }

  async listForAccount(accountId: string): Promise<Dialog[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<{
      dialog_id: string;
      last_message_at: string;
      client_cert_share_allowed: number;
      capsule_id: string;
      name: string;
      avatar_url: string | null;
      url: string | null;
      description: string | null;
    }>(
      `SELECT
         d.id AS dialog_id,
         d.last_message_at,
         d.client_cert_share_allowed,
         c.id AS capsule_id,
         c.name,
         c.avatar_url,
         c.url,
         c.description
       FROM dialogs d
       INNER JOIN capsules c ON c.id = d.capsule_id
       WHERE c.account_id = ?
       ORDER BY datetime(d.last_message_at) DESC`,
      accountId,
    );
    return rows.map((r) => this.rowToDialog(r));
  }

  async getByIdForAccount(
    accountId: string,
    dialogId: string,
  ): Promise<Dialog | null> {
    const db = await this.db();
    const row = await db.getFirstAsync<{
      dialog_id: string;
      last_message_at: string;
      client_cert_share_allowed: number;
      capsule_id: string;
      name: string;
      avatar_url: string | null;
      url: string | null;
      description: string | null;
    }>(
      `SELECT
         d.id AS dialog_id,
         d.last_message_at,
         d.client_cert_share_allowed,
         c.id AS capsule_id,
         c.name,
         c.avatar_url,
         c.url,
         c.description
       FROM dialogs d
       INNER JOIN capsules c ON c.id = d.capsule_id
       WHERE c.account_id = ? AND d.id = ?`,
      accountId,
      dialogId,
    );
    return row ? this.rowToDialog(row) : null;
  }

  async setClientCertShareAllowed(dialogId: string, allowed: boolean): Promise<void> {
    const db = await this.db();
    await db.runAsync(
      "UPDATE dialogs SET client_cert_share_allowed = ? WHERE id = ?",
      allowed ? 1 : 0,
      dialogId,
    );
  }
}

