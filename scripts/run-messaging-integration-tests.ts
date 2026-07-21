const databaseUrl = process.env.MESSAGING_TEST_DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error(
    "MESSAGING_TEST_DATABASE_URL is required; the release-gate database integration suite was not run.",
  );
  process.exit(1);
}

const child = Bun.spawn(["bun", "test", "tests/integration/unifiedMessagingDatabase.test.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, MESSAGING_TEST_DATABASE_URL: databaseUrl },
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(await child.exited);
