export type Category = {
  id: string;
  /** Owning account; categories are never shared across accounts. */
  accountId: string;
  name: string;
  sortOrder: number;
};
