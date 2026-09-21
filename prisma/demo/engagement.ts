import {
  BillingCycle,
  EmissionScope,
  InvoiceStatus,
  PrismaClient,
  SubscriptionStatus,
  TargetType,
  TaskStatus,
} from '@prisma/client';
import { Rng } from './rng';
import { DemoTenant } from './tenant';

/**
 * Everything around the reporting data that makes an account look worked-in:
 * reduction targets, an active task board, an audit trail, recent activity and
 * a billing history.
 */

const TASKS: Array<{ name: string; status: TaskStatus; topics: string[]; dueInDays: number }> = [
  { name: 'Collect Q4 diesel purchase records — Sokoto plant', status: TaskStatus.completed, topics: ['Scope 1', 'Stationary Combustion'], dueInDays: -42 },
  { name: 'Reconcile fleet fuel cards against telematics', status: TaskStatus.completed, topics: ['Scope 1', 'Mobile Combustion'], dueInDays: -28 },
  { name: 'Upload Ikeja Electric invoices for FY2025', status: TaskStatus.in_progress, topics: ['Scope 2', 'Location-based'], dueInDays: 6 },
  { name: 'Obtain supplier-specific emission factors from IPP', status: TaskStatus.in_progress, topics: ['Scope 2', 'Market-based'], dueInDays: 13 },
  { name: 'Complete LDAR survey for Port Harcourt facility', status: TaskStatus.pending, topics: ['Scope 1', 'Fugitive Emissions'], dueInDays: 21 },
  { name: 'Review water withdrawal data for stressed regions', status: TaskStatus.pending, topics: ['Water Management'], dueInDays: 27 },
  { name: 'Refresh anti-corruption training completion figures', status: TaskStatus.on_hold, topics: ['Governance', 'Business Ethics'], dueInDays: 34 },
  { name: 'Verify clinker production tonnage with plant manager', status: TaskStatus.approved, topics: ['Scope 1', 'Process Emissions'], dueInDays: -12 },
  { name: 'Resubmit Q3 Scope 2 evidence after review rejection', status: TaskStatus.declined, topics: ['Scope 2', 'Evidence'], dueInDays: 4 },
  { name: 'Draft FY2025 limited assurance readiness pack', status: TaskStatus.in_progress, topics: ['Assurance'], dueInDays: 45 },
];

const TASK_COMMENTS = [
  'Plant manager has confirmed the figures — attaching the signed log now.',
  'Still waiting on the distribution company to reissue the September invoice.',
  'Cross-checked against last year; the variance is explained by the new kiln line.',
  'Flagging this for the sustainability lead, the boundary treatment needs a decision.',
  'Evidence uploaded. Moving to review.',
];

const AUDIT_ACTIONS: Array<{ module: string; action: string; entity: string; status: string }> = [
  { module: 'Assessment', action: 'CREATE', entity: 'Assessment', status: 'SUCCESS' },
  { module: 'Assessment', action: 'SUBMIT_FOR_REVIEW', entity: 'Assessment', status: 'SUCCESS' },
  { module: 'Assessment', action: 'APPROVE', entity: 'Assessment', status: 'SUCCESS' },
  { module: 'Assessment', action: 'REJECT', entity: 'Assessment', status: 'SUCCESS' },
  { module: 'GHG Data', action: 'UPDATE', entity: 'Scope1Data', status: 'SUCCESS' },
  { module: 'GHG Data', action: 'UPLOAD_EVIDENCE', entity: 'ElectricityHeat', status: 'SUCCESS' },
  { module: 'User Management', action: 'INVITE_USER', entity: 'Invitation', status: 'SUCCESS' },
  { module: 'User Management', action: 'UPDATE_ROLE', entity: 'User', status: 'SUCCESS' },
  { module: 'Authentication', action: 'LOGIN', entity: 'User', status: 'SUCCESS' },
  { module: 'Authentication', action: 'LOGIN', entity: 'User', status: 'FAILURE' },
  { module: 'Report', action: 'GENERATE', entity: 'Report', status: 'SUCCESS' },
  { module: 'Report', action: 'EXPORT_PDF', entity: 'Report', status: 'SUCCESS' },
  { module: 'Target', action: 'CREATE', entity: 'Target', status: 'SUCCESS' },
  { module: 'Subsidiary', action: 'UPDATE', entity: 'Subsidiary', status: 'SUCCESS' },
];

const ACTIVITY_TYPES = ['assessment', 'report', 'target', 'user', 'data'];

export async function seedEngagement(
  prisma: PrismaClient,
  rng: Rng,
  tenant: DemoTenant,
): Promise<void> {
  console.log('🎯 Seeding targets, tasks, audit trail and billing…');

  // --- Reduction targets -----------------------------------------------------
  const groupTarget = await prisma.target.upsert({
    where: { companyId_name: { companyId: tenant.company.id, name: 'Group Net-Zero Pathway 2030' } },
    update: {},
    create: {
      name: 'Group Net-Zero Pathway 2030',
      companyId: tenant.company.id,
      type: TargetType.BOTH,
      description:
        'Group-wide commitment to halve absolute Scope 1 and 2 emissions against a 2023 baseline, aligned to a 1.5°C pathway.',
      baselineYear: 2023,
      targetYear: 2030,
      createdById: tenant.adminUserId,
    },
  });

  await prisma.generalTarget.upsert({
    where: { targetId: groupTarget.id },
    update: {},
    create: {
      targetId: groupTarget.id,
      reductionPercentage: 50,
      baselineYearEmission: 123_100,
      targetEmission: 61_550,
      currentEmission: 101_480,
    },
  });

  const scopeTargets: Array<{ scope: EmissionScope; pct: number; baseline: number }> = [
    { scope: EmissionScope.SCOPE1, pct: 45, baseline: 41_500 },
    { scope: EmissionScope.SCOPE2, pct: 60, baseline: 18_200 },
    { scope: EmissionScope.SCOPE3, pct: 30, baseline: 63_400 },
  ];
  for (const st of scopeTargets) {
    await prisma.scopeTarget.upsert({
      where: { targetId_scope: { targetId: groupTarget.id, scope: st.scope } },
      update: {},
      create: {
        targetId: groupTarget.id,
        scope: st.scope,
        reductionPercentage: st.pct,
        baselineYearEmission: st.baseline,
        targetEmission: Math.round(st.baseline * (1 - st.pct / 100) * 100) / 100,
        currentEmission: Math.round(st.baseline * rng.float(0.78, 0.93) * 100) / 100,
        baselineYear: 2023,
        targetYear: 2030,
      },
    });
  }

  const interimTarget = await prisma.target.upsert({
    where: { companyId_name: { companyId: tenant.company.id, name: 'Interim Scope 2 Renewable Target 2027' } },
    update: {},
    create: {
      name: 'Interim Scope 2 Renewable Target 2027',
      companyId: tenant.company.id,
      type: TargetType.SCOPE,
      description:
        'Source 40% of group electricity from certified renewable supply by 2027, evidenced through EACs.',
      baselineYear: 2023,
      targetYear: 2027,
      createdById: tenant.adminUserId,
    },
  });
  await prisma.scopeTarget.upsert({
    where: { targetId_scope: { targetId: interimTarget.id, scope: EmissionScope.SCOPE2 } },
    update: {},
    create: {
      targetId: interimTarget.id,
      scope: EmissionScope.SCOPE2,
      reductionPercentage: 40,
      baselineYearEmission: 18_200,
      targetEmission: 10_920,
      currentEmission: 14_860,
      baselineYear: 2023,
      targetYear: 2027,
    },
  });

  // --- Task board ------------------------------------------------------------
  const assessments = await prisma.assessment.findMany({
    where: { companyId: tenant.company.id },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  for (let i = 0; i < TASKS.length; i += 1) {
    const spec = TASKS[i];
    const creator = tenant.dataOfficerIds[i % tenant.dataOfficerIds.length];
    const task = await prisma.task.create({
      data: {
        taskName: spec.name,
        dueDate: new Date(Date.now() + spec.dueInDays * 24 * 60 * 60 * 1000),
        status: spec.status,
        createdById: creator,
      },
    });

    // One or two assignees per task.
    const assigneeCount = rng.int(1, 2);
    for (let a = 0; a < assigneeCount; a += 1) {
      const userId = tenant.dataOfficerIds[(i + a + 1) % tenant.dataOfficerIds.length];
      await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          userId,
          topics: spec.topics,
          assessmentId: assessments.length ? rng.pick(assessments).id : null,
          startedAt:
            spec.status === TaskStatus.pending
              ? null
              : new Date(Date.now() - rng.int(2, 40) * 24 * 60 * 60 * 1000),
        },
      });
    }

    const commentCount = rng.int(0, 3);
    for (let c = 0; c < commentCount; c += 1) {
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          commenter: `Demo User ${rng.int(1, 25)}`,
          comment: rng.pick(TASK_COMMENTS),
          createdAt: new Date(Date.now() - rng.int(1, 30) * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // --- Audit trail -----------------------------------------------------------
  const users = await prisma.user.findMany({
    where: { companyId: tenant.company.id },
    select: { id: true, email: true, first_name: true, last_name: true, role: { select: { name: true } } },
  });

  for (let i = 0; i < 180; i += 1) {
    const actor = rng.pick(users);
    const entry = rng.pick(AUDIT_ACTIONS);
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        actorName: `${actor.first_name ?? ''} ${actor.last_name ?? ''}`.trim(),
        actorEmail: actor.email,
        actorRole: actor.role?.name ?? null,
        module: entry.module,
        action: entry.action,
        entity: entry.entity,
        entityId: String(rng.int(1, 240)),
        status: entry.status,
        ipAddress: `102.${rng.int(64, 91)}.${rng.int(0, 255)}.${rng.int(1, 254)}`,
        metadata: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          source: 'web',
        },
        createdAt: new Date(Date.now() - rng.int(1, 400) * 24 * 60 * 60 * 1000),
      },
    });
  }

  // --- Recent activity feed --------------------------------------------------
  for (let i = 0; i < 40; i += 1) {
    const entry = rng.pick(AUDIT_ACTIONS);
    await prisma.activities.create({
      data: {
        title: `${entry.action.replace(/_/g, ' ').toLowerCase()} on ${entry.entity}`,
        description: `${entry.module} activity recorded for ${tenant.company.name}.`,
        createdById: rng.pick(users).id,
        companyId: tenant.company.id,
        status: entry.status,
        type: rng.pick(ACTIVITY_TYPES),
        createdAt: new Date(Date.now() - rng.int(1, 90) * 24 * 60 * 60 * 1000),
      },
    });
  }

  // --- Subscription and billing history --------------------------------------
  const plan =
    (await prisma.subscription.findFirst({ where: { name: 'Enterprise' } })) ??
    (await prisma.subscription.findFirst({ orderBy: { price_annual: 'desc' } }));

  if (plan) {
    await prisma.company.update({
      where: { id: tenant.company.id },
      data: { current_subscription_tier: plan.id },
    });

    const start = new Date(Date.UTC(2024, 0, 1));
    await prisma.companySubscription.create({
      data: {
        company_id: tenant.company.id,
        subscription_id: plan.id,
        start_date: start,
        end_date: new Date(Date.UTC(2026, 11, 31)),
        status: SubscriptionStatus.ACTIVE,
        billing_cycle: BillingCycle.YEARLY,
        auto_renew: true,
        amount: plan.price_annual,
        billing_contact_name: 'Adaeze Okonkwo',
        billing_contact_email: 'billing@meridian-demo.com',
        billing_address: '14 Ozumba Mbadiwe Avenue, Victoria Island, Lagos',
        created_by: tenant.adminUserId,
        updated_by: tenant.adminUserId,
      },
    });

    // Two years of invoices, most settled, one outstanding.
    for (let i = 0; i < 8; i += 1) {
      const billingDate = new Date(Date.UTC(2024, i * 3, 1));
      const isLatest = i === 7;
      await prisma.invoice.create({
        data: {
          invoice_id: `DEMO-INV-${2024}${String(i + 1).padStart(3, '0')}`,
          company_id: tenant.company.id,
          amount: Math.round((plan.price_annual / 4) * 100) / 100,
          status: isLatest ? InvoiceStatus.PENDING : InvoiceStatus.PAID,
          billing_date: billingDate,
          next_payment_date: new Date(Date.UTC(2024, (i + 1) * 3, 1)),
          download_url: `https://demo-assets.meridian-demo.com/invoices/DEMO-INV-${2024}${String(i + 1).padStart(3, '0')}.pdf`,
        },
      });
    }
  } else {
    console.log('   ! No subscription plans found — skipping billing history.');
  }

  console.log(
    `   ✓ 2 targets, ${TASKS.length} tasks, 180 audit entries, 40 activities, billing history`,
  );
}
