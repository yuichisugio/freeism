export const pointsQueryKeys = {
  accountReopen: ["points", "account", "reopen"] as const,
  csvExport: (exportId: string) => ["points", "csv-export", exportId] as const,
  ownerships: ["points", "ownerships"] as const,
  profile: (pointsUserId: string) => ["points", "profile", pointsUserId] as const,
  reconciliation: ["points", "admin", "reconciliation"] as const,
  search: (query: string) => ["points", "search", query] as const,
} as const;
