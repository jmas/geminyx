import type {
  BaseRecord,
  CreateParams,
  DataProvider,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetListResponse,
  GetOneParams,
  HttpError,
  UpdateParams,
  UpdateResponse,
} from "@refinedev/core";
import { RESOURCE as ACCOUNTS_RESOURCE, sqliteAdapter as accountsSqlite } from "lib/resources/accounts";
import { RESOURCE as CAPSULES_RESOURCE, sqliteAdapter as capsulesSqlite } from "lib/resources/capsules";
import { RESOURCE as DIALOGS_RESOURCE, sqliteAdapter as dialogsSqlite } from "lib/resources/dialogs";
import { RESOURCE as MESSAGES_RESOURCE, sqliteAdapter as messagesSqlite } from "lib/resources/messages";
import type { SqliteResourceAdapter } from "lib/sqlite/resourceAdapterTypes";

export const RESOURCES = {
  accounts: ACCOUNTS_RESOURCE,
  capsules: CAPSULES_RESOURCE,
  dialogs: DIALOGS_RESOURCE,
  messages: MESSAGES_RESOURCE,
} as const;

type KnownResource = (typeof RESOURCES)[keyof typeof RESOURCES];

const SQLITE_ADAPTERS: Record<KnownResource, SqliteResourceAdapter> = {
  [ACCOUNTS_RESOURCE]: accountsSqlite,
  [CAPSULES_RESOURCE]: capsulesSqlite,
  [DIALOGS_RESOURCE]: dialogsSqlite,
  [MESSAGES_RESOURCE]: messagesSqlite,
};

function adapterFor(resource: string): SqliteResourceAdapter | undefined {
  return SQLITE_ADAPTERS[resource as KnownResource];
}

const notSupportedError = (): HttpError => ({
  message: "Not supported for this resource",
  statusCode: 405,
});

export const refineDataProvider: DataProvider = {
  getApiUrl: () => "sqlite://geminyx.db",

  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const a = adapterFor(params.resource);
    if (a?.getList) {
      return a.getList<TData>(params);
    }
    return { data: [], total: 0 };
  },

  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<{ data: TData }> => {
    const a = adapterFor(params.resource);
    if (a?.getOne) {
      return a.getOne<TData>(params);
    }
    throw notSupportedError();
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = unknown>(
    params: CreateParams<TVariables>,
  ): Promise<{ data: TData }> => {
    const a = adapterFor(params.resource);
    if (a?.create) {
      return a.create<TData, TVariables>(params);
    }
    throw notSupportedError();
  },

  update: async <
    TData extends BaseRecord = BaseRecord,
    TVariables = unknown,
  >(params: UpdateParams<TVariables>): Promise<UpdateResponse<TData>> => {
    const a = adapterFor(params.resource);
    if (a?.update) {
      return a.update<TData, TVariables>(params);
    }
    throw notSupportedError();
  },

  deleteOne: async <
    TData extends BaseRecord = BaseRecord,
    TVariables = unknown,
  >(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    const a = adapterFor(params.resource);
    if (a?.deleteOne) {
      return a.deleteOne<TData, TVariables>(params);
    }
    throw notSupportedError();
  },
};
