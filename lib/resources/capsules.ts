import type {
  BaseRecord,
  CreateParams,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetOneParams,
} from "@refinedev/core";
import type { Capsule } from "lib/models/capsule";
import type { SqliteResourceAdapter } from "lib/sqlite/resourceAdapterTypes";
import {
  deleteCapsuleCascade,
  fetchCapsule,
  fetchCapsules,
  insertCapsuleWithDialog,
} from "lib/sqlite/queries";

export const RESOURCE = "capsules" as const;

export type { Capsule } from "lib/models/capsule";

export type CapsuleCreateVariables = {
  name: string;
  avatarUrl?: string;
  url?: string;
  description?: string;
};

export const sqliteAdapter: SqliteResourceAdapter = {
  async getList<TData extends BaseRecord>(_params: GetListParams) {
    const rows = await fetchCapsules();
    return {
      data: rows as unknown as TData[],
      total: rows.length,
    };
  },
  async getOne<TData extends BaseRecord>({ id }: GetOneParams) {
    const row = await fetchCapsule(String(id));
    if (!row) {
      throw { message: "Capsule not found", statusCode: 404 };
    }
    return { data: row as unknown as TData };
  },
  async create<TData extends BaseRecord, TVariables = unknown>({
    variables,
  }: CreateParams<TVariables>) {
    const v = variables as CapsuleCreateVariables;
    const capsule = await insertCapsuleWithDialog({
      name: v.name,
      avatarUrl: v.avatarUrl,
      url: v.url,
      description: v.description,
    });
    return { data: capsule as unknown as TData };
  },
  async deleteOne<
    TData extends BaseRecord,
    TVariables = unknown,
  >({ id }: DeleteOneParams<TVariables>): Promise<DeleteOneResponse<TData>> {
    await deleteCapsuleCascade(String(id));
    return { data: { id } as unknown as TData };
  },
};

/** Demo rows used to seed SQLite on first launch */
export const SEED_CAPSULES: Capsule[] = [
  {
    id: "1",
    name: "Alex Rivera",
    avatarUrl: "https://i.pravatar.cc/200?img=12",
    url: "gemini://kennedy.gemi.dev",
    description: "Design syncs and weekend plans",
  },
  {
    id: "2",
    name: "Jordan Lee",
    avatarUrl: "https://i.pravatar.cc/200?img=33",
    url: "gemini://jordan.example.gemi.dev",
    description: "Docs, reviews, and async updates",
  },
  {
    id: "3",
    name: "Sam Chen",
  },
  {
    id: "4",
    name: "Taylor Morgan",
    avatarUrl: "https://i.pravatar.cc/200?img=47",
    description: "Birthday thread and life updates",
  },
  {
    id: "5",
    name: "Casey Brooks",
  },
];
