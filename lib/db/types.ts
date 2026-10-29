import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

/** Any Drizzle Postgres database or transaction for our schema (Neon, PGlite, pg). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
