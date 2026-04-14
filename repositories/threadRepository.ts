import { Q } from "@nozbe/watermelondb";
import type { Thread } from "lib/models/thread";
import { Capsule as CapsuleModel } from "lib/watermelon/models/Capsule";
import { Thread as ThreadModel } from "lib/watermelon/models/Thread";
import { BaseRepository } from "repositories/baseRepository";

export class ThreadRepository extends BaseRepository {
  private threads() {
    return this.db().get<ThreadModel>("threads");
  }

  private capsules() {
    return this.db().get<CapsuleModel>("capsules");
  }

  private rowToThread(d: ThreadModel, c: CapsuleModel): Thread {
    return {
      id: d.id,
      lastMessageAt: d.lastMessageAt,
      clientCertShareAllowed: d.clientCertShareAllowed,
      capsule: {
        id: c.id,
        name: c.name,
        avatarUrl: c.avatarUrl ?? undefined,
        url: c.url ?? undefined,
        description: c.description?.trim() ? c.description.trim() : undefined,
      },
    };
  }

  async listForAccount(accountId: string): Promise<Thread[]> {
    const caps = await this.capsules()
      .query(Q.where("account_id", accountId))
      .fetch();
    const capIds = caps.map((c) => c.id);
    if (capIds.length === 0) return [];

    const threads = await this.threads()
      .query(Q.where("capsule_id", Q.oneOf(capIds)))
      .fetch();
    const capById = new Map(caps.map((c) => [c.id, c]));
    const out: Thread[] = [];
    for (const d of threads) {
      const c = capById.get(d.capsuleId);
      if (c) out.push(this.rowToThread(d, c));
    }
    out.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );
    return out;
  }

  async getByIdForAccount(
    accountId: string,
    threadId: string,
  ): Promise<Thread | null> {
    try {
      const d = await this.threads().find(threadId);
      const c = await this.capsules().find(d.capsuleId);
      if (c.accountId !== accountId) return null;
      return this.rowToThread(d, c);
    } catch {
      return null;
    }
  }

  async getById(threadId: string): Promise<Thread | null> {
    try {
      const d = await this.threads().find(threadId);
      const c = await this.capsules().find(d.capsuleId);
      return this.rowToThread(d, c);
    } catch {
      return null;
    }
  }

  async setClientCertShareAllowed(
    threadId: string,
    allowed: boolean,
  ): Promise<void> {
    const db = this.db();
    await db.write(async () => {
      const m = await this.threads().find(threadId);
      await m.update((rec) => {
        rec.clientCertShareAllowed = allowed;
      });
    });
  }
}

export const threadsRepo = new ThreadRepository();
