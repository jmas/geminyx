import type {
  BaseRecord,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetOneParams,
} from "@refinedev/core";
import { accountsRepo, capsulesRepo, dialogsRepo } from "repositories";
import type { SqliteResourceAdapter } from "lib/sqlite/resourceAdapterTypes";

export const RESOURCE = "dialogs" as const;

export type { Dialog } from "lib/models/dialog";

async function requireActiveAccountId(): Promise<string> {
  const active = await accountsRepo.getActive();
  if (!active?.id) {
    throw { message: "No active account", statusCode: 400 };
  }
  return active.id;
}

export const sqliteAdapter: SqliteResourceAdapter = {
  async getList<TData extends BaseRecord>(_params: GetListParams) {
    const accountId = await requireActiveAccountId();
    const rows = await dialogsRepo.listForAccount(accountId);
    return {
      data: rows as unknown as TData[],
      total: rows.length,
    };
  },
  async getOne<TData extends BaseRecord>({ id }: GetOneParams) {
    const accountId = await requireActiveAccountId();
    const row = await dialogsRepo.getByIdForAccount(accountId, String(id));
    if (!row) {
      throw { message: "Dialog not found", statusCode: 404 };
    }
    return { data: row as unknown as TData };
  },
  async deleteOne<
    TData extends BaseRecord,
    TVariables = unknown,
  >({ id }: DeleteOneParams<TVariables>): Promise<DeleteOneResponse<TData>> {
    const accountId = await requireActiveAccountId();
    const existing = await dialogsRepo.getByIdForAccount(accountId, String(id));
    if (!existing) {
      throw { message: "Dialog not found", statusCode: 404 };
    }
    await capsulesRepo.deleteCascade(String(id));
    return { data: { id } as unknown as TData };
  },
};
