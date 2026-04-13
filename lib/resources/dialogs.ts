import type {
  BaseRecord,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetOneParams,
} from "@refinedev/core";
import type { SqliteResourceAdapter } from "lib/sqlite/resourceAdapterTypes";
import {
  deleteCapsuleCascade,
  fetchDialog,
  fetchDialogs,
} from "lib/sqlite/queries";

export const RESOURCE = "dialogs" as const;

export type { Dialog } from "lib/models/dialog";

export const sqliteAdapter: SqliteResourceAdapter = {
  async getList<TData extends BaseRecord>(_params: GetListParams) {
    const rows = await fetchDialogs();
    return {
      data: rows as unknown as TData[],
      total: rows.length,
    };
  },
  async getOne<TData extends BaseRecord>({ id }: GetOneParams) {
    const row = await fetchDialog(String(id));
    if (!row) {
      throw { message: "Dialog not found", statusCode: 404 };
    }
    return { data: row as unknown as TData };
  },
  async deleteOne<
    TData extends BaseRecord,
    TVariables = unknown,
  >({ id }: DeleteOneParams<TVariables>): Promise<DeleteOneResponse<TData>> {
    await deleteCapsuleCascade(String(id));
    return { data: { id } as unknown as TData };
  },
};
