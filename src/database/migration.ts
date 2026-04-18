import { Effect } from "effect";
import {
  createApiKeyTable,
  createEmailLogIndexes,
  createEmailLogsTable,
  createRateLimitRulesTable,
  createSandboxEnvironmentTable,
  createSchemaMigrationsTable,
  createWebhookEndpointTable,
  createWorkflowIndexes,
  createWorkflowStepsTable,
  createWorkflowTable,
} from "./schema";
import { DatabaseClient, DatabaseLive } from "./connection";

type Migration = {
  readonly name: string;
  readonly statements: ReadonlyArray<string>;
};

const migrations: ReadonlyArray<Migration> = [
  {
    name: "001_create_schema_migrations",
    statements: [createSchemaMigrationsTable],
  },
  {
    name: "002_create_workflow_tables",
    statements: [
      createWorkflowTable,
      createWorkflowStepsTable,
      createApiKeyTable,
      createSandboxEnvironmentTable,
      createRateLimitRulesTable,
      createWebhookEndpointTable,
    ],
  },
  {
    name: "003_create_indexes",
    statements: [createWorkflowIndexes],
  },
  {
    name: "004_create_email_logs_table",
    statements: [createEmailLogsTable],
  },
  {
    name: "005_create_email_log_indexes",
    statements: [createEmailLogIndexes],
  },
];

const ensureMigrationTable = Effect.gen(function* () {
  const db = yield* DatabaseClient;

  yield* Effect.promise(() => db.sql.unsafe(createSchemaMigrationsTable));
});

const hasMigrationRun = (name: string) =>
  Effect.gen(function* () {
    const db = yield* DatabaseClient;

    const rows = yield* Effect.promise(
      () =>
        db.sql<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM schema_migrations
          WHERE name = ${name}
        ) AS exists
      `,
    );

    return rows[0]?.exists === true;
  });

const runSingleMigration = (migration: Migration) =>
  Effect.gen(function* () {
    const alreadyRan = yield* hasMigrationRun(migration.name);

    if (alreadyRan) {
      console.log(`Skipping ${migration.name}`);
      return;
    }

    console.log(`Running ${migration.name}`);

    const db = yield* DatabaseClient;

    yield* Effect.promise(() =>
      db.sql.begin(async () => {
        for (const statement of migration.statements) {
          await db.sql.unsafe(statement);
        }

        await db.sql`
          INSERT INTO schema_migrations (name)
          VALUES (${migration.name})
        `;
      }),
    );

    console.log(`Completed ${migration.name}`);
  });

const migrate = Effect.gen(function* () {
  yield* ensureMigrationTable;

  for (const migration of migrations) {
    yield* runSingleMigration(migration);
  }

  console.log("All migrations completed successfully.");
});

Effect.runPromise(migrate.pipe(Effect.provide(DatabaseLive))).catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

// {
//   name: "004_add_phone_to_workflows",
//   statements: [
//     `ALTER TABLE workflows ADD COLUMN phone TEXT;`
//   ]
// }
