const url = process.env.CAPACITOR_SERVER_URL?.trim();

if (!url) {
  console.error("CAPACITOR_SERVER_URL is required for production native sync.");
  console.error(
    "Example: CAPACITOR_SERVER_URL=https://app.cloudandcore.co.il bun run mobile:sync:prod",
  );
  process.exit(1);
}

try {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Production native builds must use an HTTPS URL.");
  }
} catch (error) {
  console.error(`Invalid CAPACITOR_SERVER_URL: ${url}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
