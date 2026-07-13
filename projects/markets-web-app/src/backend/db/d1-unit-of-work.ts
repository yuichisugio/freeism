export interface D1UnitOfWork {
  batch<T = unknown>(statements: readonly D1PreparedStatement[]): Promise<readonly D1Result<T>[]>;
}

export function createD1UnitOfWork(database: D1Database): D1UnitOfWork {
  return {
    batch: <T>(statements: readonly D1PreparedStatement[]) => database.batch<T>([...statements]),
  };
}
