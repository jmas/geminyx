import { Q } from "@nozbe/watermelondb";
import { seedCapsuleTemplates } from "data/seeds/capsules";
import { newId } from "lib/db/utils";
import type { Capsule } from "lib/models/capsule";
import {
  geminiOriginsMatch,
  normalizeGeminiCapsuleRootUrl,
} from "lib/models/gemini";
import { Capsule as CapsuleModel } from "lib/watermelon/models/Capsule";
import { BaseRepository } from "repositories/baseRepository";
import { categoriesRepo } from "repositories/categoryRepository";
import { threadsRepo } from "repositories/threadRepository";

export type CapsuleInsert = {
  name: string;
  avatarIcon?: string;
  url?: string;
  description?: string;
  id?: string;
  accountId: string;
  /** When unset or empty, the capsule is uncategorized (shown as General). */
  categoryId?: string;
  /**
   * When false, the capsule is hidden from the library and thread list (visit-only).
   * Defaults to true.
   */
  libraryVisible?: boolean;
};

export type CapsulePatch = {
  name?: string;
  avatarIcon?: string;
  url?: string;
  description?: string;
  /** Pass `null` or `""` to clear the category (General). Omit to leave unchanged. */
  categoryId?: string | null;
  /** Set true to show the capsule in the library and thread list. */
  libraryVisible?: boolean;
};

export type CapsuleListSection = {
  title: string;
  categoryId: string | null;
  data: Capsule[];
};

export class CapsuleRepository extends BaseRepository {
  private modelToCapsule(m: CapsuleModel): Capsule {
    const rawCat = m.categoryId?.trim();
    return {
      id: m.id,
      name: m.name,
      avatarIcon: m.avatarIcon?.trim() ? m.avatarIcon.trim() : undefined,
      url: m.url ?? undefined,
      description: m.description?.trim() ? m.description.trim() : undefined,
      categoryId: rawCat ? rawCat : undefined,
      libraryVisible: m.libraryVisible !== false,
    };
  }

  private capsules() {
    return this.db().get<CapsuleModel>("capsules");
  }

  async listForAccount(accountId: string): Promise<Capsule[]> {
    const rows = await this.capsules()
      .query(Q.where("account_id", accountId))
      .fetch();
    const visible = rows.filter((m) => m.libraryVisible !== false);
    const sorted = [...visible].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    return sorted.map((m) => this.modelToCapsule(m));
  }

  /**
   * Capsules grouped by category for sectioned lists. “General” is uncategorized
   * (`categoryId` unset) and listed last; empty sections are omitted.
   */
  async listSectionsForAccount(
    accountId: string,
  ): Promise<CapsuleListSection[]> {
    const [rows, categories] = await Promise.all([
      this.capsules().query(Q.where("account_id", accountId)).fetch(),
      categoriesRepo.listOrdered(accountId),
    ]);
    const rowsVisible = rows.filter((m) => m.libraryVisible !== false);
    const catById = new Map(categories.map((c) => [c.id, c] as const));
    const modelCaps = rowsVisible.map((m) => this.modelToCapsule(m));
    const sortByName = (a: Capsule, b: Capsule) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

    const general: Capsule[] = [];
    const byCatId = new Map<string, Capsule[]>();
    for (const c of modelCaps) {
      const cid = c.categoryId?.trim();
      if (!cid || !catById.has(cid)) {
        general.push(c);
        continue;
      }
      if (!byCatId.has(cid)) byCatId.set(cid, []);
      byCatId.get(cid)!.push(c);
    }
    general.sort(sortByName);

    const sections: CapsuleListSection[] = [];
    for (const cat of categories) {
      const data = (byCatId.get(cat.id) ?? []).sort(sortByName);
      if (data.length) {
        sections.push({
          title: cat.name,
          categoryId: cat.id,
          data,
        });
      }
    }
    if (general.length) {
      sections.push({
        title: "General",
        categoryId: null,
        data: general,
      });
    }
    return sections;
  }

  async getByIdForAccount(
    accountId: string,
    capsuleId: string,
  ): Promise<Capsule | null> {
    try {
      const m = await this.capsules().find(capsuleId);
      if (m.accountId !== accountId) return null;
      return this.modelToCapsule(m);
    } catch {
      return null;
    }
  }

  async patch(capsuleId: string, patch: CapsulePatch): Promise<void> {
    const db = this.db();
    await db.write(async () => {
      const m = await this.capsules().find(capsuleId);
      const existing = this.modelToCapsule(m);
      const nextName = (patch.name ?? existing.name).trim();
      const nextAvatarIcon = (
        patch.avatarIcon ??
        existing.avatarIcon ??
        ""
      ).trim();
      const nextUrl = (patch.url ?? existing.url ?? "").trim();
      const nextDescription = (
        patch.description ??
        existing.description ??
        ""
      ).trim();
      let nextCategoryId = existing.categoryId;
      if (patch.categoryId !== undefined) {
        const raw = patch.categoryId?.trim();
        nextCategoryId = raw ? raw : undefined;
      }
      let nextLibraryVisible = existing.libraryVisible !== false;
      if (patch.libraryVisible !== undefined) {
        nextLibraryVisible = patch.libraryVisible;
      }

      await m.update((rec) => {
        rec.name = nextName;
        rec.avatarIcon = nextAvatarIcon ? nextAvatarIcon : undefined;
        rec.url = nextUrl ? nextUrl : undefined;
        rec.description = nextDescription ? nextDescription : undefined;
        rec.categoryId = nextCategoryId;
        rec.libraryVisible = nextLibraryVisible;
      });
    });
  }

  async deleteCascade(capsuleId: string): Promise<void> {
    await threadsRepo.deleteConversation(capsuleId);
    const db = this.db();
    await db.write(async () => {
      const cap = await this.capsules().find(capsuleId);
      await cap.destroyPermanently();
    });
  }

  /**
   * Inserts a capsule row only. Thread rows are created on first Visit via
   * `threadsRepo.ensureThreadForCapsule`.
   */
  async insertCapsuleOnly(input: CapsuleInsert): Promise<Capsule> {
    const id = input.id ?? newId("cap");
    const accountId = input.accountId.trim();
    if (!accountId) {
      throw new Error("capsule.insertCapsuleOnly: accountId is required");
    }
    const name = input.name.trim();
    const avatarIcon = input.avatarIcon?.trim();
    const url = input.url?.trim();
    const description = input.description?.trim();
    const categoryRaw = input.categoryId?.trim();
    const libraryVisible = input.libraryVisible !== false;
    const db = this.db();
    await db.write(async () => {
      await this.capsules().create((rec) => {
        rec._raw.id = id;
        rec.name = name;
        rec.avatarIcon = avatarIcon ? avatarIcon : undefined;
        rec.url = url ? url : undefined;
        rec.description = description ? description : undefined;
        rec.accountId = accountId;
        rec.categoryId = categoryRaw ? categoryRaw : undefined;
        rec.libraryVisible = libraryVisible;
      });
    });
    const row = await this.getByIdForAccount(accountId, id);
    if (!row) {
      throw new Error("capsule.insertCapsuleOnly: row missing after insert");
    }
    return row;
  }

  /**
   * Finds a saved capsule whose Gemini origin matches `geminiUrl` (same host/port).
   * Normalizes `gemini://` roots (drops path/query) so a stored `gemini://host/` matches
   * lookups from redirects or links that include a path.
   */
  async findByGeminiOriginForAccount(
    accountId: string,
    geminiUrl: string,
  ): Promise<Capsule | null> {
    const raw = geminiUrl.trim();
    if (!raw.length) return null;
    const needle = /^gemini:\/\//i.test(raw)
      ? normalizeGeminiCapsuleRootUrl(raw) || raw
      : raw;
    const allRows = await this.capsules()
      .query(Q.where("account_id", accountId))
      .fetch();
    for (const m of allRows) {
      const c = this.modelToCapsule(m);
      const u = c.url?.trim();
      if (!u) continue;
      const hay = /^gemini:\/\//i.test(u)
        ? normalizeGeminiCapsuleRootUrl(u) || u
        : u;
      if (geminiOriginsMatch(hay, needle)) return c;
    }
    return null;
  }

  async seedDefaultCapsulesIfEmpty(accountId: string): Promise<void> {
    const existing = await this.listForAccount(accountId);
    if (existing.length > 0) return;
    const categoryByName = await categoriesRepo.ensureSeedCategories(accountId);
    for (const t of seedCapsuleTemplates()) {
      const rawUrl = t.url?.trim();
      const catName = t.categoryName?.trim();
      const categoryId = catName ? categoryByName.get(catName) : undefined;
      await this.insertCapsuleOnly({
        accountId,
        name: t.name,
        avatarIcon: t.avatarIcon,
        url: rawUrl ? normalizeGeminiCapsuleRootUrl(rawUrl) : undefined,
        description: t.description,
        categoryId,
      });
    }
  }
}

export const capsulesRepo = new CapsuleRepository();
