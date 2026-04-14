import type { Category } from "lib/models/category";
import { SEED_CAPSULE_CATEGORIES } from "lib/resources/seedCapsules";
import { newId } from "lib/db/utils";
import { Capsule as CapsuleModel } from "lib/watermelon/models/Capsule";
import { Category as CategoryRecord } from "lib/watermelon/models/Category";
import { Q } from "@nozbe/watermelondb";
import { BaseRepository } from "repositories/baseRepository";

function modelToCategory(m: CategoryRecord): Category {
  return {
    id: m.id,
    accountId: m.accountId,
    name: m.name,
    sortOrder: m.sortOrder,
  };
}

export class CategoryRepository extends BaseRepository {
  private categories() {
    return this.db().get<CategoryRecord>("capsule_categories");
  }

  private capsules() {
    return this.db().get<CapsuleModel>("capsules");
  }

  async listOrdered(accountId: string): Promise<Category[]> {
    const rows = await this.categories()
      .query(Q.where("account_id", accountId))
      .fetch();
    const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted.map(modelToCategory);
  }

  async create(accountId: string, name: string): Promise<Category> {
    const trimmed = name.trim();
    if (!trimmed.length) {
      throw new Error("categories.create: name is required");
    }
    const existing = await this.listOrdered(accountId);
    const nextOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((c) => c.sortOrder)) + 1;
    const id = newId("ccat");
    const db = this.db();
    await db.write(async () => {
      await this.categories().create((rec) => {
        rec._raw.id = id;
        rec.name = trimmed;
        rec.sortOrder = nextOrder;
        rec.accountId = accountId;
      });
    });
    const row = await this.categories().find(id);
    return modelToCategory(row);
  }

  async updateName(
    accountId: string,
    categoryId: string,
    name: string,
  ): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed.length) {
      throw new Error("categories.updateName: name is required");
    }
    const aid = accountId.trim();
    if (!aid.length) {
      throw new Error("categories.updateName: accountId is required");
    }
    const db = this.db();
    await db.write(async () => {
      const m = await this.categories().find(categoryId);
      if (m.accountId !== aid) {
        throw new Error("categories.updateName: category does not belong to account");
      }
      await m.update((rec) => {
        rec.name = trimmed;
      });
    });
  }

  async deleteAndClearCapsules(
    accountId: string,
    categoryId: string,
  ): Promise<void> {
    const aid = accountId.trim();
    if (!aid.length) {
      throw new Error("categories.deleteAndClearCapsules: accountId is required");
    }
    const db = this.db();
    await db.write(async () => {
      const cat = await this.categories().find(categoryId);
      if (cat.accountId !== aid) {
        throw new Error(
          "categories.deleteAndClearCapsules: category does not belong to account",
        );
      }
      const caps = await this.capsules()
        .query(
          Q.and(
            Q.where("capsule_category_id", categoryId),
            Q.where("account_id", aid),
          ),
        )
        .fetch();
      for (const c of caps) {
        await c.update((rec) => {
          rec.categoryId = undefined;
        });
      }
      await cat.destroyPermanently();
    });
  }

  async setOrder(accountId: string, orderedIds: string[]): Promise<void> {
    const db = this.db();
    await db.write(async () => {
      let order = 0;
      for (const id of orderedIds) {
        const m = await this.categories().find(id);
        if (m.accountId !== accountId) continue;
        await m.update((rec) => {
          rec.sortOrder = order++;
        });
      }
    });
  }

  /**
   * Ensures the default category catalog exists for this account and returns
   * `category name → id` for assigning seed capsules. Missing names are appended.
   */
  async ensureSeedCategories(accountId: string): Promise<Map<string, string>> {
    const aid = accountId.trim();
    if (!aid.length) {
      throw new Error("categories.ensureSeedCategories: accountId is required");
    }
    const existing = await this.listOrdered(aid);
    const byName = new Map<string, string>(existing.map((c) => [c.name, c.id]));

    if (existing.length === 0) {
      const db = this.db();
      await db.write(async () => {
        for (const def of SEED_CAPSULE_CATEGORIES) {
          const id = newId("ccat");
          await this.categories().create((rec) => {
            rec._raw.id = id;
            rec.name = def.name;
            rec.sortOrder = def.sortOrder;
            rec.accountId = aid;
          });
          byName.set(def.name, id);
        }
      });
      return byName;
    }

    for (const def of SEED_CAPSULE_CATEGORIES) {
      if (byName.has(def.name)) continue;
      const created = await this.create(aid, def.name);
      byName.set(created.name, created.id);
    }
    return byName;
  }
}

export const categoriesRepo = new CategoryRepository();
