import dataSource from './data-source';

async function main() {
  await dataSource.initialize();

  try {
    const migrations = await dataSource.runMigrations();

    console.log(
      `Database migrations completed: ${migrations.length} migration(s) executed.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Database migration failed:', error);
  process.exit(1);
});
