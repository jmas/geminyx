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
import { capsulesRepo, type CapsulePatch } from "repositories";
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

export const sqliteAdapter: SqliteResourceAdapter = {
  async getList<TData extends BaseRecord>(_params: GetListParams) {
    const rows = await capsulesRepo.list();
    return {
      data: rows as unknown as TData[],
      total: rows.length,
    };
  },
  async getOne<TData extends BaseRecord>({ id }: GetOneParams) {
    const row = await capsulesRepo.getById(String(id));
    if (!row) {
      throw { message: "Capsule not found", statusCode: 404 };
    }
    return { data: row as unknown as TData };
  },
  async create<TData extends BaseRecord, TVariables = unknown>({
    variables,
  }: CreateParams<TVariables>) {
    const v = variables as CapsuleCreateVariables;
    const rawUrl = v.url?.trim();
    const capsule = await capsulesRepo.insertWithDialog({
      name: v.name,
      avatarUrl: v.avatarUrl,
      url: rawUrl ? normalizeGeminiCapsuleRootUrl(rawUrl) : undefined,
      description: v.description,
    });
    return { data: capsule as unknown as TData };
  },
  async update<TData extends BaseRecord, TVariables = unknown>({
    id,
    variables,
  }: UpdateParams<TVariables>): Promise<UpdateResponse<TData>> {
    const v = variables as CapsuleUpdateVariables;
    const rawUrl = v.url?.trim();
    await capsulesRepo.patch(String(id), {
      ...v,
      url: rawUrl ? normalizeGeminiCapsuleRootUrl(rawUrl) : "",
    });
    const row = await capsulesRepo.getById(String(id));
    if (!row) {
      throw { message: "Capsule not found", statusCode: 404 };
    }
    return { data: row as unknown as TData };
  },
  async deleteOne<TData extends BaseRecord, TVariables = unknown>({
    id,
  }: DeleteOneParams<TVariables>): Promise<DeleteOneResponse<TData>> {
    await capsulesRepo.deleteCascade(String(id));
    return { data: { id } as unknown as TData };
  },
};

export { SEED_CAPSULES } from "./seedCapsules";
