import { Q } from "@nozbe/watermelondb";
import type { Thread } from "lib/models/thread";
import { AppBlob } from "lib/watermelon/models/Blob";
import { Capsule as CapsuleModel } from "lib/watermelon/models/Capsule";
import { Message as MessageModel } from "lib/watermelon/models/Message";
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
        avatarIcon: c.avatarIcon?.trim() ? c.avatarIcon.trim() : undefined,
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

  /**
   * Removes all messages and the thread row for this conversation. Does not
   * delete the capsule (thread id equals capsule id). Use
   * `ensureThreadForCapsule` when the user opens the capsule again.
   */
  async deleteConversation(threadId: string): Promise<void> {
    const db = this.db();
    await db.write(async () => {
      const messages = db.get<MessageModel>("messages");
      const blobs = db.get<AppBlob>("blobs");
      const msgRows = await messages
        .query(Q.where("thread_id", threadId))
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
        const d = await this.threads().find(threadId);
        await d.destroyPermanently();
      } catch {
        /* no thread */
      }
    });
  }

  /**
   * Creates a thread row for a capsule if missing. Thread id matches capsule id.
   */
  async ensureThreadForCapsule(capsuleId: string): Promise<void> {
    try {
      await this.threads().find(capsuleId);
      return;
    } catch {
      /* create below */
    }
    const db = this.db();
    await db.write(async () => {
      await this.capsules().find(capsuleId);
      await this.threads().create((rec) => {
        rec._raw.id = capsuleId;
        rec.capsuleId = capsuleId;
        rec.messageId = undefined;
        rec.lastMessageAt = new Date(0).toISOString();
        rec.clientCertShareAllowed = false;
      });
    });
  }
}

export const threadsRepo = new ThreadRepository();
