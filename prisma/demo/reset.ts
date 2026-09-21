import { PrismaClient } from '@prisma/client';
import { DEMO_COMPANY_NAME, DEMO_EMAIL_SUFFIX } from './tenant';

/**
 * Removes everything the demo seed created, so a demo can be reset between
 * client sessions without touching anything else in the database.
 *
 * Deletion order matters: children before parents, because several relations
 * are restrictive rather than cascading.
 */
export async function resetDemo(prisma: PrismaClient): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { name: DEMO_COMPANY_NAME },
    select: { id: true },
  });

  if (!company) {
    console.log(`Nothing to reset — "${DEMO_COMPANY_NAME}" does not exist.`);
    return;
  }

  const companyId = company.id;
  console.log(`🧹 Resetting demo tenant "${DEMO_COMPANY_NAME}" (id ${companyId})…`);

  const subsidiaries = await prisma.subsidiary.findMany({
    where: { parentCompanyId: companyId },
    select: { id: true },
  });
  const subsidiaryIds = subsidiaries.map((s) => s.id);

  const users = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_SUFFIX } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const assessments = await prisma.assessment.findMany({
    where: { companyId },
    select: { id: true },
  });
  const assessmentIds = assessments.map((a) => a.id);

  const tasks = await prisma.task.findMany({
    where: { createdById: { in: userIds } },
    select: { id: true },
  });
  const taskIds = tasks.map((t) => t.id);

  // Reporting content. The Scope 1 tree and disclosure topics cascade from
  // Assessment, so deleting assessments clears them.
  await prisma.report.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
  await prisma.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.taskAssignment.deleteMany({
    where: { OR: [{ taskId: { in: taskIds } }, { assessmentId: { in: assessmentIds } }] },
  });
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  await prisma.assessment.deleteMany({ where: { companyId } });

  // Scope 2 hangs off subsidiaries rather than assessments.
  await prisma.locationBasedS2.deleteMany({ where: { subsidiaryId: { in: subsidiaryIds } } });
  await prisma.marketBasedS2.deleteMany({ where: { subsidiaryId: { in: subsidiaryIds } } });

  // Targets, billing, audit and activity.
  await prisma.scopeTarget.deleteMany({ where: { target: { companyId } } });
  await prisma.generalTarget.deleteMany({ where: { target: { companyId } } });
  await prisma.target.deleteMany({ where: { companyId } });
  await prisma.invoice.deleteMany({ where: { company_id: companyId } });
  await prisma.companySubscription.deleteMany({ where: { company_id: companyId } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.activities.deleteMany({ where: { companyId } });
  await prisma.invitation.deleteMany({ where: { companyId } });
  await prisma.refreshToken.deleteMany({ where: { user_id: { in: userIds } } });

  // Structure. Users must be detached from departments and subsidiaries before
  // those rows can go, and the company's created_by/updated_by cleared before
  // the users themselves are removed.
  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { departmentId: null, subsidiaryId: null },
  });
  await prisma.department.deleteMany({ where: { companyId } });
  await prisma.subsidiary.deleteMany({ where: { parentCompanyId: companyId } });
  await prisma.company.update({
    where: { id: companyId },
    data: { created_by: null, updated_by: null, current_subscription_tier: null },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.company.delete({ where: { id: companyId } });

  console.log('   ✓ Demo tenant removed.');
}
