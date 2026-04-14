import {
  schemaMigrations,
  unsafeExecuteSql,
} from "@nozbe/watermelondb/Schema/migrations";

export const geminyxMigrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        unsafeExecuteSql("ALTER TABLE dialogs RENAME TO threads;"),
        unsafeExecuteSql(
          "ALTER TABLE messages RENAME COLUMN dialog_id TO thread_id;",
        ),
      ],
    },
  ],
});
