import type { Account } from "lib/models/account";
import { newId } from "lib/db/utils";
import { Account as AccountModel } from "lib/watermelon/models/Account";
import { Q } from "@nozbe/watermelondb";
import { getWatermelonDatabase } from "lib/watermelon/database";
import { capsulesRepo } from "repositories/capsuleRepository";

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
    "name" | "email" | "avatarUrl" | "capsuleUrl" | "isActive"
  >
> & {
  geminiClientP12Base64?: string | null;
  geminiClientP12Passphrase?: string | null;
};

function modelToAccount(m: AccountModel): Account {
  return {
    id: m.id,
    name: m.name,
    email: m.email?.trim() ? m.email.trim() : undefined,
    avatarUrl: m.avatarUrl ?? undefined,
    capsuleUrl: m.capsuleUrl ?? undefined,
    geminiClientP12Base64: m.geminiClientP12Base64?.trim()
      ? m.geminiClientP12Base64.trim()
      : undefined,
    geminiClientP12Passphrase: m.geminiClientP12Passphrase ?? undefined,
    isActive: m.isActive,
  };
}

export class AccountRepository {
  private accounts() {
    return getWatermelonDatabase().get<AccountModel>("accounts");
  }

  async list(options?: { activeOnly?: boolean }): Promise<Account[]> {
    const col = this.accounts();
    const activeOnly = options?.activeOnly;
    const q =
      activeOnly === true
        ? col.query(Q.where("is_active", true))
        : activeOnly === false
          ? col.query(Q.where("is_active", false))
          : col.query();
    const rows = await q.fetch();
    const sorted = [...rows].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    return sorted.map(modelToAccount);
  }

  async getById(accountId: string): Promise<Account | null> {
    try {
      const m = await this.accounts().find(accountId);
      return modelToAccount(m);
    } catch {
      return null;
    }
  }

  async getActive(): Promise<Account | null> {
    const rows = await this.accounts()
      .query(Q.where("is_active", true))
      .fetch();
    const m = rows[0];
    return m ? modelToAccount(m) : null;
  }

  async insert(input: AccountInsert): Promise<Account> {
    const db = getWatermelonDatabase();
    const id = input.id ?? newId("acc");
    const name = input.name.trim();
    const email = input.email?.trim() ? input.email.trim() : undefined;
    const avatarUrl = input.avatarUrl?.trim() ? input.avatarUrl.trim() : undefined;
    const capsuleUrl = input.capsuleUrl?.trim() ? input.capsuleUrl.trim() : undefined;
    const p12 = input.geminiClientP12Base64?.trim()
      ? input.geminiClientP12Base64.trim()
      : undefined;
    const p12pass =
      input.geminiClientP12Passphrase !== undefined &&
      input.geminiClientP12Passphrase !== null
        ? input.geminiClientP12Passphrase
        : undefined;

    await db.write(async () => {
      if (input.isActive) {
        const activeRows = await this.accounts()
          .query(Q.where("is_active", true))
          .fetch();
        for (const r of activeRows) {
          await r.update((rec) => {
            rec.isActive = false;
          });
        }
      }
      await this.accounts().create((rec) => {
        rec._raw.id = id;
        rec.name = name;
        rec.email = email;
        rec.avatarUrl = avatarUrl;
        rec.capsuleUrl = capsuleUrl;
        rec.geminiClientP12Base64 = p12;
        rec.geminiClientP12Passphrase = p12pass;
        rec.isActive = input.isActive;
      });
    });

    const row = await this.getById(id);
    if (!row) {
      throw new Error("account.insert: row not found after insert");
    }
    await capsulesRepo.seedDefaultCapsulesIfEmpty(id);
    return row;
  }

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
    const db = getWatermelonDatabase();
    await db.write(async () => {
      if (patch.isActive === true) {
        const activeRows = await this.accounts()
          .query(Q.where("is_active", true))
          .fetch();
        for (const r of activeRows) {
          await r.update((rec) => {
            rec.isActive = false;
          });
        }
      }

      const m = await this.accounts().find(accountId);
      await m.update((rec) => {
        if (patch.name !== undefined) rec.name = patch.name;
        if (patch.email !== undefined) {
          rec.email = patch.email?.trim() ? patch.email.trim() : undefined;
        }
        if (patch.avatarUrl !== undefined) rec.avatarUrl = patch.avatarUrl ?? undefined;
        if (patch.capsuleUrl !== undefined) rec.capsuleUrl = patch.capsuleUrl ?? undefined;
        if (patch.geminiClientP12Base64 !== undefined) {
          rec.geminiClientP12Base64 =
            patch.geminiClientP12Base64 === null
              ? undefined
              : patch.geminiClientP12Base64.trim()
                ? patch.geminiClientP12Base64.trim()
                : undefined;
        }
        if (patch.geminiClientP12Passphrase !== undefined) {
          rec.geminiClientP12Passphrase =
            patch.geminiClientP12Passphrase === null
              ? undefined
              : patch.geminiClientP12Passphrase ?? undefined;
        }
        if (patch.isActive !== undefined) rec.isActive = patch.isActive;
      });
    });
  }

  async deleteById(accountId: string): Promise<Account | null> {
    const db = getWatermelonDatabase();
    const existing = await this.getById(accountId);
    if (!existing) return null;

    await db.write(async () => {
      const m = await this.accounts().find(accountId);
      await m.destroyPermanently();

      if (existing.isActive) {
        const rest = await this.accounts().query().fetch();
        const sorted = [...rest].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
        const next = sorted[0];
        if (next) {
          await next.update((rec) => {
            rec.isActive = true;
          });
        }
      }
    });

    return existing;
  }
}

export const accountsRepo = new AccountRepository();
