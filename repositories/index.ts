import { AccountRepository } from "./accountRepository";
import { BlobRepository } from "./blobRepository";
import { CapsuleRepository } from "./capsuleRepository";
import { ThreadRepository } from "./threadRepository";
import { MessageRepository } from "./messageRepository";

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
