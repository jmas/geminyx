import type {
  BaseRecord,
  CreateParams,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetOneParams,
  UpdateParams,
  UpdateResponse,
} from "@refinedev/core";
import { normalizeGeminiCapsuleRootUrl } from "lib/models/gemini";
import { accountsRepo, capsulesRepo, type CapsulePatch } from "repositories";
import type { SqliteResourceAdapter } from "lib/sqlite/resourceAdapterTypes";

export const RESOURCE = "capsules" as const;

export type { Capsule } from "lib/models/capsule";

export type CapsuleCreateVariables = {
  name: string;
  avatarUrl?: string;
  url?: string;
  description?: string;
};

export type CapsuleUpdateVariables = CapsulePatch;

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
    const rows = await capsulesRepo.listForAccount(accountId);
    return {
      data: rows as unknown as TData[],
      total: rows.length,
    };
  },
  async getOne<TData extends BaseRecord>({ id }: GetOneParams) {
    const accountId = await requireActiveAccountId();
    const row = await capsulesRepo.getByIdForAccount(accountId, String(id));
    if (!row) {
      throw { message: "Capsule not found", statusCode: 404 };
    }
    return { data: row as unknown as TData };
  },
  async create<TData extends BaseRecord, TVariables = unknown>({
    variables,
  }: CreateParams<TVariables>) {
    const accountId = await requireActiveAccountId();
    const v = variables as CapsuleCreateVariables;
    const rawUrl = v.url?.trim();
    const capsule = await capsulesRepo.insertWithDialog({
      name: v.name,
      avatarUrl: v.avatarUrl,
      url: rawUrl ? normalizeGeminiCapsuleRootUrl(rawUrl) : undefined,
      description: v.description,
      accountId,
    });
    return { data: capsule as unknown as TData };
  },
  async update<TData extends BaseRecord, TVariables = unknown>({
    id,
    variables,
  }: UpdateParams<TVariables>): Promise<UpdateResponse<TData>> {
    const accountId = await requireActiveAccountId();
    const existing = await capsulesRepo.getByIdForAccount(accountId, String(id));
    if (!existing) {
      throw { message: "Capsule not found", statusCode: 404 };
    }
    const v = variables as CapsuleUpdateVariables;
    const rawUrl = v.url?.trim();
    await capsulesRepo.patch(String(id), {
      ...v,
      url: rawUrl ? normalizeGeminiCapsuleRootUrl(rawUrl) : "",
    });
    const row = await capsulesRepo.getByIdForAccount(accountId, String(id));
    if (!row) {
      throw { message: "Capsule not found", statusCode: 404 };
    }
    return { data: row as unknown as TData };
  },
  async deleteOne<TData extends BaseRecord, TVariables = unknown>({
    id,
  }: DeleteOneParams<TVariables>): Promise<DeleteOneResponse<TData>> {
    const accountId = await requireActiveAccountId();
    const existing = await capsulesRepo.getByIdForAccount(accountId, String(id));
    if (!existing) {
      throw { message: "Capsule not found", statusCode: 404 };
    }
    await capsulesRepo.deleteCascade(String(id));
    return { data: { id } as unknown as TData };
  },
};

export { SEED_CAPSULES } from "./seedCapsules";
