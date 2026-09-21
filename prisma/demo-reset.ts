/**
 * Entry point: remove everything the demo seed created.
 *
 *   DEMO_MODE=true yarn demo:reset
 *
 * This deletes rows permanently. The guard in ./demo/guard.ts is what stops it
 * being pointed at anything that is not a demo database.
 */
import { PrismaClient } from '@prisma/client';
import { assertDemoEnvironment } from './demo/guard';
import { resetDemo } from './demo/reset';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  assertDemoEnvironment({ action: 'delete demo data' });
  await resetDemo(prisma);
}

main()
  .catch((error) => {
    console.error('\n✖ Demo reset failed:\n', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
