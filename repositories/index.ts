import { BlobRepository } from "./blobRepository";
import { MessageRepository } from "./messageRepository";

export {
  ROOT_TAB_ROUTE_NAMES,
  SETTINGS_TAB_ACTIVE_KEY,
  SETTINGS_UI_LANGUAGE_KEY,
  parseAppLanguagePreference,
  clearSettingsUiCache,
  getCachedInitialRootTab,
  preloadSettingsFromDatabase,
  settingsRepo,
  type AppLanguagePreference,
  type RootTabRouteName,
} from "./settingsRepository";
export { BaseRepository } from "./baseRepository";
export {
  AccountRepository,
  accountsRepo,
  type AccountInsert,
  type AccountPatch,
} from "./accountRepository";
export { BlobRepository, type BlobViewPayload } from "./blobRepository";
export {
  CapsuleRepository,
  capsulesRepo,
  type CapsuleInsert,
  type CapsuleListSection,
  type CapsulePatch,
} from "./capsuleRepository";
export { CategoryRepository, categoriesRepo } from "./categoryRepository";
export { ThreadRepository, threadsRepo } from "./threadRepository";
export {
  MESSAGES_PAGE_SIZE,
  MessageRepository,
  type MessageCreateVariables,
} from "./messageRepository";

export const blobsRepo = new BlobRepository();
export const messagesRepo = new MessageRepository();
