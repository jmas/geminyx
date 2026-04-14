import {
  addColumns,
  createTable,
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
    {
      toVersion: 3,
      steps: [
        createTable({
          name: "app_settings",
          columns: [
            { name: "setting_key", type: "string", isIndexed: true },
            { name: "value_json", type: "string" },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: "app_settings",
          columns: [
            { name: "account_id", type: "string", isIndexed: true, isOptional: true },
          ],
        }),
        unsafeExecuteSql(
          "UPDATE app_settings SET account_id = (SELECT id FROM accounts WHERE is_active = 1 LIMIT 1) WHERE account_id IS NULL;",
        ),
        unsafeExecuteSql("DELETE FROM app_settings WHERE account_id IS NULL;"),
      ],
    },
    {
      toVersion: 5,
      steps: [
        unsafeExecuteSql("ALTER TABLE app_settings RENAME TO settings;"),
      ],
    },
    {
      toVersion: 6,
      steps: [
        createTable({
          name: "capsule_categories",
          columns: [
            { name: "name", type: "string" },
            { name: "sort_order", type: "number" },
            { name: "account_id", type: "string", isIndexed: true },
          ],
        }),
        addColumns({
          table: "capsules",
          columns: [
            { name: "capsule_category_id", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: "capsules",
          columns: [
            { name: "avatar_icon", type: "string", isOptional: true },
          ],
        }),
        unsafeExecuteSql("ALTER TABLE capsules DROP COLUMN avatar_url;"),
      ],
    },
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: "capsules",
          columns: [
            {
              name: "library_visible",
              type: "boolean",
              isOptional: true,
            },
          ],
        }),
        unsafeExecuteSql(
          "UPDATE capsules SET library_visible = 1 WHERE library_visible IS NULL;",
        ),
      ],
    },
    {
      toVersion: 9,
      steps: [
        addColumns({
          table: "blobs",
          columns: [
            { name: "message_id", type: "string", isOptional: true },
            { name: "mime_type", type: "string", isOptional: true },
            { name: "content_length", type: "number", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 10,
      steps: [
        addColumns({
          table: "blobs",
          columns: [{ name: "file_name", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 11,
      steps: [
        unsafeExecuteSql("ALTER TABLE accounts DROP COLUMN avatar_url;"),
      ],
    },
  ],
});
