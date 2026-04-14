import type {
  BaseRecord,
  CrudFilter,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetOneParams,
  UpdateParams,
  UpdateResponse,
} from "@refinedev/core";
import type { Account } from "lib/models/account";
import { accountsRepo, type AccountPatch } from "repositories";
import type { SqliteResourceAdapter } from "lib/sqlite/resourceAdapterTypes";

export const RESOURCE = "accounts" as const;

export type { Account } from "lib/models/account";

function eqFilterValue(
  filters: CrudFilter[] | undefined,
  field: string,
): unknown {
  if (!filters?.length) return undefined;
  for (const f of filters) {
    if ("field" in f && f.field === field && f.operator === "eq") {
      const v = f.value;
      if (Array.isArray(v)) {
        return v[0];
      }
      return v;
    }
  }
  return undefined;
}

function activeOnlyFromFilters(
  filters: CrudFilter[] | undefined,
): boolean | undefined {
  const v = eqFilterValue(filters, "is_active");
  if (v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return undefined;
}

type AccountUpdateVariables = AccountPatch;

export const sqliteAdapter: SqliteResourceAdapter = {
  async getList<TData extends BaseRecord>({ filters }: GetListParams) {
    const activeOnly = activeOnlyFromFilters(filters);
    const rows = await accountsRepo.list(
      activeOnly === undefined ? {} : { activeOnly },
    );
    return {
      data: rows as unknown as TData[],
      total: rows.length,
    };
  },
  async getOne<TData extends BaseRecord>({ id }: GetOneParams) {
    const row = await accountsRepo.getById(String(id));
    if (!row) {
      throw { message: "Account not found", statusCode: 404 };
    }
    return { data: row as unknown as TData };
  },
  async update<TData extends BaseRecord, TVariables = unknown>({
    id,
    variables,
  }: UpdateParams<TVariables>): Promise<UpdateResponse<TData>> {
    await accountsRepo.patch(String(id), variables as AccountUpdateVariables);
    const row = await accountsRepo.getById(String(id));
    if (!row) {
      throw { message: "Account not found", statusCode: 404 };
    }
    return { data: row as unknown as TData };
  },
  async deleteOne<TData extends BaseRecord, TVariables = unknown>({
    id,
  }: DeleteOneParams<TVariables>): Promise<DeleteOneResponse<TData>> {
    const deleted = await accountsRepo.deleteById(String(id));
    if (!deleted) {
      throw { message: "Account not found", statusCode: 404 };
    }
    return { data: deleted as unknown as TData };
  },
};
