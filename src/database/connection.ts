import { Context, Effect, Layer } from "effect";
import postgres from "postgres";

export interface DatabaseClientService {
  readonly sql: postgres.Sql;
}

export class DatabaseClient extends Context.Tag("DatabaseClient")<
  DatabaseClient,
  DatabaseClientService
>() {}

const createClient = () =>
  postgres(process.env.DATABASE_URL!, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });

export const DatabaseLive = Layer.scoped(
  DatabaseClient,
  Effect.acquireRelease(
    Effect.sync(() => {
      const sql = createClient();
      return { sql };
    }),
    ({ sql }) => Effect.promise(() => sql.end()).pipe(Effect.orDie),
  ),
);
