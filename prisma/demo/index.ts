import { PrismaClient } from '@prisma/client';
import { Rng } from './rng';
import { seedTenant, DEMO_COMPANY_NAME, DEMO_PASSWORD, emailFor } from './tenant';
import { seedAssessments } from './emissions';
import { seedEngagement } from './engagement';

/**
 * Populates a demo environment with a complete, self-consistent tenant.
 *
 * Assumes the base seed (yarn db:seed) has already run — it relies on the
 * roles, sectors, industries and subscription plans that seed creates.
 */
export async function seedDemo(prisma: PrismaClient): Promise<void> {
  // Fixed seed keeps every run byte-identical, so demo screenshots stay valid.
  const rng = new Rng(Number(process.env.DEMO_SEED ?? 20260921));

  const existing = await prisma.company.findUnique({
    where: { name: DEMO_COMPANY_NAME },
    select: { id: true },
  });
  if (existing) {
    console.log(
      `\n⚠️  "${DEMO_COMPANY_NAME}" already exists. Run \`yarn demo:reset\` first ` +
        'if you want a clean rebuild; continuing would duplicate its data.\n',
    );
    return;
  }

  const tenant = await seedTenant(prisma, rng);
  await seedAssessments(prisma, rng, tenant);
  await seedEngagement(prisma, rng, tenant);

  console.log('\n\u001b[32m✔ Demo environment ready.\u001b[0m\n');
  console.log(`   Company   ${tenant.company.name}`);
  console.log(`   Login     ${emailFor('Adaeze', 'Okonkwo')}  (company ESG admin)`);
  console.log(`   Password  ${DEMO_PASSWORD}`);
  console.log('\n   Every demo user shares that password. All other demo logins');
  console.log('   follow first.last@meridian-demo.com.\n');
}
