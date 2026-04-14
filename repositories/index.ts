import { BlobRepository } from "./blobRepository";
import { MessageRepository } from "./messageRepository";

export { BaseRepository } from "./baseRepository";
export {
  AccountRepository,
  accountsRepo,
  type AccountInsert,
  type AccountPatch,
} from "./accountRepository";
export { BlobRepository } from "./blobRepository";
export {
  CapsuleRepository,
  capsulesRepo,
  type CapsuleInsert,
  type CapsulePatch,
} from "./capsuleRepository";
export { ThreadRepository, threadsRepo } from "./threadRepository";
export { MessageRepository } from "./messageRepository";

export const blobsRepo = new BlobRepository();
export const messagesRepo = new MessageRepository();
