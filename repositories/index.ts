import { AccountRepository } from "./accountRepository";
import { BlobRepository } from "./blobRepository";
import { CapsuleRepository } from "./capsuleRepository";
import { DialogRepository } from "./dialogRepository";
import { MessageRepository } from "./messageRepository";

export { AccountRepository, type AccountInsert, type AccountPatch } from "./accountRepository";
export { BlobRepository } from "./blobRepository";
export {
  CapsuleRepository,
  capsulesRepo,
  type CapsuleInsert,
  type CapsulePatch,
} from "./capsuleRepository";
export { DialogRepository } from "./dialogRepository";
export { MessageRepository } from "./messageRepository";

export const accountsRepo = new AccountRepository();
export const blobsRepo = new BlobRepository();
export const dialogsRepo = new DialogRepository();
export const messagesRepo = new MessageRepository();

