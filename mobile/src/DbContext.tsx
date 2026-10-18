import { createContext, useContext } from "react";
import type { Database } from "sql.js";
import type { ContentVersion } from "./db";

export type DbContextValue = {
  db: Database;
  version: ContentVersion | null;
};

export const DbContext = createContext<DbContextValue | null>(null);

export function useDb(): DbContextValue {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error("useDb must be used within the loaded-database boundary");
  return ctx;
}
