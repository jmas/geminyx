/**
 * Root layout registers a handler so Settings can return the app to onboarding
 * after deleting the SQLite file (works in production; no DevSettings.reload).
 */
let onErased: (() => void) | null = null;

export function registerLocalDatabaseEraseHandler(handler: () => void): () => void {
  onErased = handler;
  return () => {
    onErased = null;
  };
}

export function notifyLocalDatabaseErased(): void {
  onErased?.();
}
