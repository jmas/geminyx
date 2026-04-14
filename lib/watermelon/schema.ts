import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const geminyxSchema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: "accounts",
      columns: [
        { name: "name", type: "string" },
        { name: "email", type: "string", isOptional: true },
        { name: "avatar_url", type: "string", isOptional: true },
        { name: "capsule_url", type: "string", isOptional: true },
        { name: "gemini_client_p12_base64", type: "string", isOptional: true },
        {
          name: "gemini_client_p12_passphrase",
          type: "string",
          isOptional: true,
        },
        { name: "is_active", type: "boolean" },
      ],
    }),
    tableSchema({
      name: "capsules",
      columns: [
        { name: "name", type: "string" },
        { name: "avatar_url", type: "string", isOptional: true },
        { name: "url", type: "string", isOptional: true },
        { name: "description", type: "string", isOptional: true },
        { name: "account_id", type: "string" },
      ],
    }),
    tableSchema({
      name: "threads",
      columns: [
        { name: "capsule_id", type: "string" },
        { name: "message_id", type: "string", isOptional: true },
        { name: "last_message_at", type: "string" },
        { name: "client_cert_share_allowed", type: "boolean" },
      ],
    }),
    tableSchema({
      name: "messages",
      columns: [
        { name: "thread_id", type: "string" },
        { name: "content_length", type: "number" },
        { name: "body", type: "string", isOptional: true },
        { name: "blob_id", type: "string", isOptional: true },
        { name: "status", type: "number", isOptional: true },
        { name: "meta", type: "string", isOptional: true },
        { name: "sent_at", type: "string" },
        { name: "is_outgoing", type: "boolean" },
        { name: "request_path", type: "string" },
      ],
    }),
    tableSchema({
      name: "blobs",
      columns: [{ name: "body_base64", type: "string" }],
    }),
  ],
});
