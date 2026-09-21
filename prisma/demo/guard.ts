/**
 * Safety guard for the demo seed.
 *
 * The demo seed writes a large amount of fabricated data and the reset command
 * deletes rows outright. Neither must ever touch a real environment, so both
 * refuse to run unless this guard passes.
 */

const PROD_URL_HINTS = [
  'prod',
  'production',
  'live',
  'neon.tech',
  'supabase.co',
  'rds.amazonaws.com',
  'render.com',
  'railway.app',
];

export interface GuardOptions {
  /** What the caller is about to do, used in error messages. */
  action: string;
}

function fail(message: string): never {
  console.error('\n\u001b[31m✖ Demo guard refused to run.\u001b[0m\n');
  console.error(message.trim() + '\n');
  process.exit(1);
}

/**
 * Throws (and exits) unless the current environment is explicitly marked as a
 * demo environment. Two independent checks have to pass: an opt-in flag, and a
 * database URL that does not look like production.
 */
export function assertDemoEnvironment({ action }: GuardOptions): void {
  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (process.env.DEMO_MODE !== 'true') {
    fail(`
Refusing to ${action} because DEMO_MODE is not set to "true".

This is deliberate: it is the check that stops the demo seed from ever running
against a real database. Set DEMO_MODE=true in the environment you actually
want to populate (see .env.demo.example), and run the command again.
    `);
  }

  if (!databaseUrl) {
    fail(`
Refusing to ${action} because DATABASE_URL is not set.

Point it at your demo database before running this.
    `);
  }

  const lowered = databaseUrl.toLowerCase();
  const hint = PROD_URL_HINTS.find((h) => lowered.includes(h));
  if (hint && process.env.DEMO_ALLOW_RISKY_URL !== 'true') {
    fail(`
Refusing to ${action}: DATABASE_URL contains "${hint}", which looks like a
hosted or production database rather than a local demo one.

If this really is a throwaway demo database, re-run with:

    DEMO_ALLOW_RISKY_URL=true

Do not set that flag to get past this message on a database you care about —
the reset command deletes rows permanently.
    `);
  }

  console.log(`🔒 Demo guard passed (DEMO_MODE=true) — safe to ${action}.`);
}
