import type { Account } from "lib/models/account";
import { newId } from "lib/sqlite/utils";
import { BaseSqliteRepository } from "lib/sqlite/baseRepository";
import { capsulesRepo } from "./capsuleRepository";

export type AccountInsert = {
  id?: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  capsuleUrl?: string | null;
  geminiClientP12Base64?: string | null;
  geminiClientP12Passphrase?: string | null;
  isActive: boolean;
};

export type AccountPatch = Partial<
  Pick<
    Account,
    | "name"
    | "email"
    | "avatarUrl"
    | "capsuleUrl"
    | "geminiClientP12Base64"
    | "geminiClientP12Passphrase"
    | "isActive"
  >
> & {
  /** Pass `null` to clear PKCS#12 or passphrase in SQLite. */
  geminiClientP12Base64?: string | null;
  geminiClientP12Passphrase?: string | null;
};

export class AccountRepository extends BaseSqliteRepository {
  private rowToAccount(r: {
    id: string;
    name: string;
    email: string | null;
    avatar_url: string | null;
    capsule_url: string | null;
    gemini_client_p12_base64: string | null;
    gemini_client_p12_passphrase: string | null;
    is_active: number;
  }): Account {
    return {
      id: r.id,
      name: r.name,
      email: r.email?.trim() ? r.email.trim() : undefined,
      avatarUrl: r.avatar_url ?? undefined,
      capsuleUrl: r.capsule_url ?? undefined,
      geminiClientP12Base64: r.gemini_client_p12_base64?.trim()
        ? r.gemini_client_p12_base64.trim()
        : undefined,
      geminiClientP12Passphrase: r.gemini_client_p12_passphrase ?? undefined,
      isActive: r.is_active === 1,
    };
  }

  async list(options?: { activeOnly?: boolean }): Promise<Account[]> {
    const db = await this.db();
    const activeOnly = options?.activeOnly;
    const where =
      activeOnly === true
        ? "WHERE is_active = 1"
        : activeOnly === false
          ? "WHERE is_active = 0"
          : "";
    const rows = await db.getAllAsync<{
      id: string;
      name: string;
      email: string | null;
      avatar_url: string | null;
      capsule_url: string | null;
      gemini_client_p12_base64: string | null;
      gemini_client_p12_passphrase: string | null;
      is_active: number;
    }>(
      `SELECT id, name, email, avatar_url, capsule_url, gemini_client_p12_base64, gemini_client_p12_passphrase, is_active FROM accounts ${where} ORDER BY name COLLATE NOCASE ASC`,
    );
    return rows.map((r) => this.rowToAccount(r));
  }

  async getById(accountId: string): Promise<Account | null> {
    const db = await this.db();
    const row = await db.getFirstAsync<{
      id: string;
      name: string;
      email: string | null;
      avatar_url: string | null;
      capsule_url: string | null;
      gemini_client_p12_base64: string | null;
      gemini_client_p12_passphrase: string | null;
      is_active: number;
    }>(
      `SELECT id, name, email, avatar_url, capsule_url, gemini_client_p12_base64, gemini_client_p12_passphrase, is_active FROM accounts WHERE id = ?`,
      accountId,
    );
    return row ? this.rowToAccount(row) : null;
  }

  /** The account marked active for this app session (at most one). */
  async getActive(): Promise<Account | null> {
    const rows = await this.list({ activeOnly: true });
    return rows[0] ?? null;
  }

  /** Inserts a row into `accounts` (used for first-run onboarding). */
  async insert(input: AccountInsert): Promise<Account> {
    const db = await this.db();
    const id = input.id ?? newId("acc");
    const name = input.name.trim();
    const email = input.email?.trim() ? input.email.trim() : null;
    const avatarUrl = input.avatarUrl?.trim() ? input.avatarUrl.trim() : null;
    const capsuleUrl = input.capsuleUrl?.trim() ? input.capsuleUrl.trim() : null;
    const p12 =
      input.geminiClientP12Base64?.trim()
        ? input.geminiClientP12Base64.trim()
        : null;
    const p12pass =
      input.geminiClientP12Passphrase !== undefined &&
      input.geminiClientP12Passphrase !== null
        ? input.geminiClientP12Passphrase
        : null;

    await db.withTransactionAsync(async () => {
      if (input.isActive) {
        await db.runAsync(`UPDATE accounts SET is_active = 0`);
      }
      await db.runAsync(
        `INSERT INTO accounts (id, name, email, avatar_url, capsule_url, gemini_client_p12_base64, gemini_client_p12_passphrase, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        name,
        email,
        avatarUrl,
        capsuleUrl,
        p12,
        p12pass,
        input.isActive ? 1 : 0,
      );
    });

    const row = await this.getById(id);
    if (!row) {
      throw new Error("account.insert: row not found after insert");
    }
    await capsulesRepo.seedDefaultCapsulesIfEmpty(id);
    return row;
  }

  /** Opens the DB (migrations + optional seed), then inserts the first account. */
  async createFirstFromOnboarding(values: {
    name: string;
    email?: string;
    avatarUrl?: string;
    capsuleUrl?: string;
    geminiClientP12Base64?: string;
    geminiClientP12Passphrase?: string;
  }): Promise<Account> {
    return this.insert({
      name: values.name,
      email: values.email,
      avatarUrl: values.avatarUrl,
      capsuleUrl: values.capsuleUrl,
      geminiClientP12Base64: values.geminiClientP12Base64,
      geminiClientP12Passphrase: values.geminiClientP12Passphrase,
      isActive: true,
    });
  }

  async patch(accountId: string, patch: AccountPatch): Promise<void> {
    const db = await this.db();
    await db.withTransactionAsync(async () => {
      if (patch.isActive === true) {
        await db.runAsync(`UPDATE accounts SET is_active = 0`);
      }

      const sets: string[] = [];
      const values: (string | number | null)[] = [];

      if (patch.name !== undefined) {
        sets.push("name = ?");
        values.push(patch.name);
      }
      if (patch.email !== undefined) {
        sets.push("email = ?");
        values.push(patch.email?.trim() ? patch.email.trim() : null);
      }
      if (patch.avatarUrl !== undefined) {
        sets.push("avatar_url = ?");
        values.push(patch.avatarUrl ?? null);
      }
      if (patch.capsuleUrl !== undefined) {
        sets.push("capsule_url = ?");
        values.push(patch.capsuleUrl ?? null);
      }
      if (patch.geminiClientP12Base64 !== undefined) {
        sets.push("gemini_client_p12_base64 = ?");
        values.push(
          patch.geminiClientP12Base64?.trim()
            ? patch.geminiClientP12Base64.trim()
            : null,
        );
      }
      if (patch.geminiClientP12Passphrase !== undefined) {
        sets.push("gemini_client_p12_passphrase = ?");
        values.push(patch.geminiClientP12Passphrase ?? null);
      }
      if (patch.isActive !== undefined) {
        sets.push("is_active = ?");
        values.push(patch.isActive ? 1 : 0);
      }

      if (sets.length === 0) return;

      values.push(accountId);
      await db.runAsync(
        `UPDATE accounts SET ${sets.join(", ")} WHERE id = ?`,
        ...values,
      );
    });
  }

  async deleteById(accountId: string): Promise<Account | null> {
    const db = await this.db();
    const existing = await this.getById(accountId);
    if (!existing) return null;

    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM accounts WHERE id = ?`, accountId);

      // If we just deleted the active account, pick another account (if any) as active.
      if (existing.isActive) {
        const next = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM accounts ORDER BY name COLLATE NOCASE ASC LIMIT 1`,
        );
        if (next?.id) {
          await db.runAsync(`UPDATE accounts SET is_active = 0`);
          await db.runAsync(`UPDATE accounts SET is_active = 1 WHERE id = ?`, next.id);
        }
      }
    });

    return existing;
  }
}

