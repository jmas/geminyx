import type {
  BaseRecord,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetOneParams,
} from "@refinedev/core";
import { capsulesRepo, dialogsRepo } from "repositories";
import type { SqliteResourceAdapter } from "lib/sqlite/resourceAdapterTypes";

export const RESOURCE = "dialogs" as const;

export type { Dialog } from "lib/models/dialog";

export const sqliteAdapter: SqliteResourceAdapter = {
  async getList<TData extends BaseRecord>(_params: GetListParams) {
    const rows = await dialogsRepo.list();
    return {
      data: rows as unknown as TData[],
      total: rows.length,
    };
  },
  async getOne<TData extends BaseRecord>({ id }: GetOneParams) {
    const row = await dialogsRepo.getById(String(id));
    if (!row) {
      throw { message: "Dialog not found", statusCode: 404 };
    }
    return { data: row as unknown as TData };
  },
  async deleteOne<
    TData extends BaseRecord,
    TVariables = unknown,
  >({ id }: DeleteOneParams<TVariables>): Promise<DeleteOneResponse<TData>> {
    await capsulesRepo.deleteCascade(String(id));
    return { data: { id } as unknown as TData };
  },
};
