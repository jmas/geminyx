import { BlobRepository } from "./blobRepository";
import { MessageRepository } from "./messageRepository";

export {
  ROOT_TAB_ROUTE_NAMES,
  SETTINGS_TAB_ACTIVE_KEY,
  clearSettingsUiCache,
  getCachedInitialRootTab,
  preloadSettingsFromDatabase,
  settingsRepo,
  type RootTabRouteName,
} from "./settingsRepository";
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
  type CapsuleListSection,
  type CapsulePatch,
} from "./capsuleRepository";
export { CategoryRepository, categoriesRepo } from "./categoryRepository";
export { ThreadRepository, threadsRepo } from "./threadRepository";
export { MessageRepository } from "./messageRepository";

export const blobsRepo = new BlobRepository();
export const messagesRepo = new MessageRepository();
