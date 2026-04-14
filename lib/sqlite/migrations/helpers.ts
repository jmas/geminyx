import type { SQLiteDatabase } from "expo-sqlite";

export async function tableColumnSet(
  db: SQLiteDatabase,
  table: "messages" | "capsules" | "dialogs" | "accounts",
): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  return new Set(rows.map((r) => r.name));
}
