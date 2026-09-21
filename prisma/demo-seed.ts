/**
 * Entry point: populate a demo environment.
 *
 *   DEMO_MODE=true yarn demo:seed
 *
 * Run the base seed (yarn db:seed) first — this builds on the roles, sectors,
 * industries and subscription plans it creates.
 */
import { PrismaClient } from '@prisma/client';
import { assertDemoEnvironment } from './demo/guard';
import { seedDemo } from './demo';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  assertDemoEnvironment({ action: 'seed demo data' });
  await seedDemo(prisma);
}

main()
  .catch((error) => {
    console.error('\n✖ Demo seed failed:\n', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
