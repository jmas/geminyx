import type { Capsule } from "lib/models/capsule";
import { normalizeGeminiCapsuleRootUrl } from "lib/models/gemini";
import { SEED_CAPSULE_TEMPLATES } from "lib/resources/seedCapsules";
import { newId } from "lib/db/utils";
import { AppBlob } from "lib/watermelon/models/Blob";
import { Capsule as CapsuleModel } from "lib/watermelon/models/Capsule";
import { Message as MessageModel } from "lib/watermelon/models/Message";
import { Thread as ThreadModel } from "lib/watermelon/models/Thread";
import { Q } from "@nozbe/watermelondb";
import { BaseRepository } from "repositories/baseRepository";

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

export class CapsuleRepository extends BaseRepository {
  private modelToCapsule(m: CapsuleModel): Capsule {
    return {
      id: m.id,
      name: m.name,
      avatarUrl: m.avatarUrl ?? undefined,
      url: m.url ?? undefined,
      description: m.description?.trim() ? m.description.trim() : undefined,
    };
  }

  private capsules() {
    return this.db().get<CapsuleModel>("capsules");
  }

  private threads() {
    return this.db().get<ThreadModel>("threads");
  }

  async listForAccount(accountId: string): Promise<Capsule[]> {
    const rows = await this.capsules()
      .query(Q.where("account_id", accountId))
      .fetch();
    const sorted = [...rows].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    return sorted.map((m) => this.modelToCapsule(m));
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
      const nextAvatarUrl = (patch.avatarUrl ?? existing.avatarUrl ?? "").trim();
      const nextUrl = (patch.url ?? existing.url ?? "").trim();
      const nextDescription = (patch.description ?? existing.description ?? "").trim();

      await m.update((rec) => {
        rec.name = nextName;
        rec.avatarUrl = nextAvatarUrl ? nextAvatarUrl : undefined;
        rec.url = nextUrl ? nextUrl : undefined;
        rec.description = nextDescription ? nextDescription : undefined;
      });
    });
  }

  async deleteCascade(capsuleId: string): Promise<void> {
    const db = this.db();
    await db.write(async () => {
      const messages = db.get<MessageModel>("messages");
      const blobs = db.get<AppBlob>("blobs");
      const msgRows = await messages
        .query(Q.where("thread_id", capsuleId))
        .fetch();
      for (const row of msgRows) {
        const bid = row.blobId;
        if (bid) {
          try {
            const b = await blobs.find(bid);
            await b.destroyPermanently();
          } catch {
            /* blob missing */
          }
        }
        await row.destroyPermanently();
      }
      try {
        const d = await this.threads().find(capsuleId);
        await d.destroyPermanently();
      } catch {
        /* no thread */
      }
      const cap = await this.capsules().find(capsuleId);
      await cap.destroyPermanently();
    });
  }

  async insertWithThread(input: CapsuleInsert): Promise<Capsule> {
    const id = input.id ?? newId("cap");
    const accountId = input.accountId.trim();
    if (!accountId) {
      throw new Error("capsule.insertWithThread: accountId is required");
    }
    const name = input.name.trim();
    const avatarUrl = input.avatarUrl?.trim();
    const url = input.url?.trim();
    const description = input.description?.trim();
    const db = this.db();
    await db.write(async () => {
      await this.capsules().create((rec) => {
        rec._raw.id = id;
        rec.name = name;
        rec.avatarUrl = avatarUrl ? avatarUrl : undefined;
        rec.url = url ? url : undefined;
        rec.description = description ? description : undefined;
        rec.accountId = accountId;
      });
      await this.threads().create((rec) => {
        rec._raw.id = id;
        rec.capsuleId = id;
        rec.messageId = undefined;
        rec.lastMessageAt = new Date(0).toISOString();
        rec.clientCertShareAllowed = false;
      });
    });
    const row = await this.getByIdForAccount(accountId, id);
    if (!row) {
      throw new Error("capsule.insertWithThread: row missing after insert");
    }
    return row;
  }

  async seedDefaultCapsulesIfEmpty(accountId: string): Promise<void> {
    const existing = await this.listForAccount(accountId);
    if (existing.length > 0) return;
    for (const t of SEED_CAPSULE_TEMPLATES) {
      const rawUrl = t.url?.trim();
      await this.insertWithThread({
        accountId,
        name: t.name,
        url: rawUrl ? normalizeGeminiCapsuleRootUrl(rawUrl) : undefined,
        description: t.description,
      });
    }
  }
}

export const capsulesRepo = new CapsuleRepository();
