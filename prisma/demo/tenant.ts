import {
  CompanyStatus,
  CompanyType,
  PrismaClient,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Rng } from './rng';

/**
 * The flagship demo tenant: a mid-size Nigerian industrial group with four
 * subsidiaries spanning deliberately different SASB industries, so a demo can
 * show cement, power, logistics and agriculture emission profiles side by side.
 */

export const DEMO_COMPANY_NAME = 'Meridian Industries Plc';
export const DEMO_EMAIL_DOMAIN = 'meridian-demo.com';
export const DEMO_PASSWORD = 'DemoPass123!';

/** Every demo email ends with this, which is also how the reset finds them. */
export const DEMO_EMAIL_SUFFIX = `@${DEMO_EMAIL_DOMAIN}`;

interface SubsidiarySpec {
  name: string;
  sector: string;
  industry: string;
  registration: string;
  city: string;
  /** Rough annual tCO2e, used to scale generated emissions. */
  emissionsScale: number;
}

export const DEMO_SUBSIDIARIES: SubsidiarySpec[] = [
  {
    name: 'Meridian Cement Ltd',
    sector: 'Extractives & Minerals Processing',
    industry: 'Construction Materials',
    registration: 'RC-884120',
    city: 'Sokoto',
    emissionsScale: 1.0,
  },
  {
    name: 'Meridian Power & Utilities Ltd',
    sector: 'Infrastructure',
    industry: 'Electric Utilities & Power Generators',
    registration: 'RC-884121',
    city: 'Port Harcourt',
    emissionsScale: 0.72,
  },
  {
    name: 'Meridian Logistics Ltd',
    sector: 'Transportation',
    industry: 'Road Transportation',
    registration: 'RC-884122',
    city: 'Lagos',
    emissionsScale: 0.38,
  },
  {
    name: 'Meridian AgriFoods Ltd',
    sector: 'Food & Beverage',
    industry: 'Agricultural Products',
    registration: 'RC-884123',
    city: 'Kaduna',
    emissionsScale: 0.25,
  },
];

const DEPARTMENTS = [
  { name: 'Sustainability & ESG', description: 'Owns ESG strategy, disclosure and assurance readiness.' },
  { name: 'Operations', description: 'Plant and fleet operations; primary source of activity data.' },
  { name: 'Health, Safety & Environment', description: 'HSE compliance, incident reporting and environmental permits.' },
  { name: 'Finance', description: 'Financial control, subscription billing and cost of carbon analysis.' },
  { name: 'Procurement', description: 'Supplier onboarding and upstream value-chain data collection.' },
];

/** Fabricated people. Names are invented; any resemblance is coincidental. */
const PEOPLE: Array<{
  first: string;
  last: string;
  role: string;
  dept: number;
  sub: number | null;
}> = [
  { first: 'Adaeze', last: 'Okonkwo', role: 'company_esg_admin', dept: 0, sub: null },
  { first: 'Tunde', last: 'Bakare', role: 'company_esg_subadmin', dept: 0, sub: null },
  { first: 'Ngozi', last: 'Eze', role: 'company_esg_subadmin', dept: 2, sub: null },
  { first: 'Ibrahim', last: 'Danjuma', role: 'company_esg_data_officer', dept: 1, sub: 0 },
  { first: 'Chidinma', last: 'Nwosu', role: 'company_esg_data_officer', dept: 1, sub: 0 },
  { first: 'Yusuf', last: 'Abdullahi', role: 'company_esg_data_officer', dept: 2, sub: 0 },
  { first: 'Folake', last: 'Adeyemi', role: 'company_esg_data_officer', dept: 1, sub: 1 },
  { first: 'Emeka', last: 'Obi', role: 'company_esg_data_officer', dept: 1, sub: 1 },
  { first: 'Hauwa', last: 'Suleiman', role: 'company_esg_data_officer', dept: 2, sub: 1 },
  { first: 'Segun', last: 'Oyelaran', role: 'company_esg_data_officer', dept: 1, sub: 2 },
  { first: 'Amina', last: 'Bello', role: 'company_esg_data_officer', dept: 4, sub: 2 },
  { first: 'Kelechi', last: 'Anyanwu', role: 'company_esg_data_officer', dept: 1, sub: 3 },
  { first: 'Zainab', last: 'Mohammed', role: 'company_esg_data_officer', dept: 2, sub: 3 },
  { first: 'Olumide', last: 'Fashola', role: 'company_esg_viewer', dept: 3, sub: null },
  { first: 'Blessing', last: 'Udo', role: 'company_esg_viewer', dept: 3, sub: null },
  { first: 'Musa', last: 'Garba', role: 'company_esg_viewer', dept: 4, sub: null },
  { first: 'Temitope', last: 'Alabi', role: 'company_esg_viewer', dept: 0, sub: 0 },
  { first: 'Uchenna', last: 'Igwe', role: 'company_esg_viewer', dept: 0, sub: 1 },
  { first: 'Fatima', last: 'Yakubu', role: 'company_esg_data_officer', dept: 4, sub: null },
  { first: 'Daniel', last: 'Ogunleye', role: 'company_esg_data_officer', dept: 3, sub: null },
  { first: 'Rukayat', last: 'Salami', role: 'company_esg_viewer', dept: 1, sub: 2 },
  { first: 'Chinedu', last: 'Okafor', role: 'company_esg_data_officer', dept: 1, sub: 2 },
  { first: 'Halima', last: 'Usman', role: 'company_esg_viewer', dept: 2, sub: 3 },
  { first: 'Bode', last: 'Ajayi', role: 'company_esg_data_officer', dept: 0, sub: null },
  { first: 'Nkechi', last: 'Maduka', role: 'company_esg_viewer', dept: 3, sub: 1 },
];

/**
 * Inline SVG logo for the demo company, as a data URI.
 *
 * Two reasons it is inlined rather than a hosted URL: the demo runs without
 * Cloudinary configured, and the frontend's custom image loader passes `data:`
 * sources through untouched, so it renders with no network dependency.
 *
 * It also matters functionally — the onboarding-progress endpoint treats a
 * company profile as incomplete without company_logo_url, which would land the
 * demo on a setup checklist instead of the populated dashboard.
 */
const DEMO_LOGO_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
      '<rect width="120" height="120" rx="24" fill="#0f766e"/>' +
      '<path d="M26 84V36h12l22 30 22-30h12v48H82V58L60 88 38 58v26z" fill="#ffffff"/>' +
      '</svg>',
  );

export const emailFor = (first: string, last: string): string =>
  `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + DEMO_EMAIL_SUFFIX;

export interface DemoTenant {
  company: { id: number; name: string };
  adminUserId: number;
  subsidiaries: Array<{ id: number; name: string; spec: SubsidiarySpec }>;
  departmentIds: number[];
  userIds: number[];
  /** Data officers, handy for assigning tasks and authoring audit entries. */
  dataOfficerIds: number[];
}

async function resolveIndustryId(
  prisma: PrismaClient,
  sectorName: string,
  industryName: string,
): Promise<number> {
  const sector = await prisma.sector.findUnique({ where: { name: sectorName } });
  if (!sector) {
    throw new Error(
      `Sector "${sectorName}" not found. Run the base seed (yarn db:seed) before the demo seed.`,
    );
  }
  const industry = await prisma.industry.findUnique({
    where: { sectorId_name: { sectorId: sector.id, name: industryName } },
  });
  if (!industry) {
    throw new Error(
      `Industry "${industryName}" not found in sector "${sectorName}". Run the base seed first.`,
    );
  }
  return industry.id;
}

export async function seedTenant(
  prisma: PrismaClient,
  rng: Rng,
): Promise<DemoTenant> {
  console.log('🏢 Seeding demo tenant…');

  const roles = await prisma.role.findMany();
  const roleId = (name: string): number => {
    const role = roles.find((r) => r.name === name);
    if (!role) {
      throw new Error(
        `Role "${name}" not found. Run the base seed (yarn db:seed) before the demo seed.`,
      );
    }
    return role.id;
  };

  const parentIndustryId = await resolveIndustryId(
    prisma,
    'Resource Transformation',
    'Industrial Machinery & Goods',
  );

  // The company's own creator must exist first, so the admin is created with no
  // company and then linked once the company row is in place.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const adminSpec = PEOPLE[0];
  const admin = await prisma.user.upsert({
    where: { email: emailFor(adminSpec.first, adminSpec.last) },
    update: {},
    create: {
      email: emailFor(adminSpec.first, adminSpec.last),
      password: passwordHash,
      first_name: adminSpec.first,
      last_name: adminSpec.last,
      phone_number: '+2348030000001',
      roleId: roleId(adminSpec.role),
      status: UserStatus.active,
      has_viewed_dashboard: true,
      last_login: new Date(Date.now() - 1000 * 60 * 60 * 6),
    },
  });

  const company = await prisma.company.upsert({
    where: { name: DEMO_COMPANY_NAME },
    update: {},
    create: {
      name: DEMO_COMPANY_NAME,
      registration_number: 'RC-884119',
      industryId: parentIndustryId,
      isinCode: 'NGMERID00019',
      isoCountryCode: 'NG',
      address: '14 Ozumba Mbadiwe Avenue, Victoria Island',
      country: 'Nigeria',
      currency: 'NGN',
      contact_email: `esg${DEMO_EMAIL_SUFFIX}`,
      website: 'https://meridian-demo.com',
      contact_phone: '+2341234567',
      status: CompanyStatus.active,
      company_type: CompanyType.esg,
      staff_strength: '1000-5000',
      company_logo_url: DEMO_LOGO_DATA_URI,
      requireAssessmentReview: true,
      created_by: admin.id,
      updated_by: admin.id,
    },
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: { companyId: company.id },
  });

  // Subsidiaries — the admin is team lead initially; real leads are assigned
  // once their user rows exist.
  const subsidiaries: DemoTenant['subsidiaries'] = [];
  for (const spec of DEMO_SUBSIDIARIES) {
    const industryId = await resolveIndustryId(prisma, spec.sector, spec.industry);
    const row = await prisma.subsidiary.upsert({
      where: { name_parentCompanyId: { name: spec.name, parentCompanyId: company.id } },
      update: {},
      create: {
        name: spec.name,
        registration_number: spec.registration,
        isoCountryCode: 'NG',
        industryId,
        address: `Plot ${rng.int(10, 240)}, Industrial Layout, ${spec.city}`,
        country: 'Nigeria',
        currency: 'NGN',
        contact_email: `${spec.name.split(' ')[1].toLowerCase()}${DEMO_EMAIL_SUFFIX}`,
        website: `https://meridian-demo.com/${spec.name.split(' ')[1].toLowerCase()}`,
        contact_phone: `+23480${rng.int(10000000, 99999999)}`,
        status: CompanyStatus.active,
        created_by: admin.id,
        updated_by: admin.id,
        parentCompanyId: company.id,
        teamLeadId: admin.id,
      },
    });
    subsidiaries.push({ id: row.id, name: row.name, spec });
  }

  // Remaining users. Departments do not exist yet, so departmentId is applied
  // in a second pass below.
  const userIds: number[] = [admin.id];
  const dataOfficerIds: number[] = [];
  const usersByIndex: Array<{ id: number; dept: number }> = [
    { id: admin.id, dept: adminSpec.dept },
  ];

  for (let i = 1; i < PEOPLE.length; i += 1) {
    const person = PEOPLE[i];
    const email = emailFor(person.first, person.last);
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: passwordHash,
        first_name: person.first,
        last_name: person.last,
        phone_number: `+23480${String(30000000 + i).padStart(8, '0')}`,
        roleId: roleId(person.role),
        companyId: company.id,
        subsidiaryId: person.sub === null ? null : subsidiaries[person.sub].id,
        status: UserStatus.active,
        has_viewed_dashboard: rng.chance(0.8),
        last_login: new Date(Date.now() - rng.int(1, 30) * 24 * 60 * 60 * 1000),
      },
    });
    userIds.push(user.id);
    usersByIndex.push({ id: user.id, dept: person.dept });
    if (person.role === 'company_esg_data_officer') dataOfficerIds.push(user.id);
  }

  // Departments, each led by the first user assigned to it.
  const departmentIds: number[] = [];
  for (let d = 0; d < DEPARTMENTS.length; d += 1) {
    const dept = DEPARTMENTS[d];
    const lead = usersByIndex.find((u) => u.dept === d) ?? usersByIndex[0];
    const row = await prisma.department.upsert({
      where: { companyId_name: { companyId: company.id, name: dept.name } },
      update: {},
      create: {
        name: dept.name,
        description: dept.description,
        leadId: lead.id,
        contact_email:
          dept.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 14) + DEMO_EMAIL_SUFFIX,
        companyId: company.id,
      },
    });
    departmentIds.push(row.id);
  }

  // Second pass: attach each user to their department.
  for (const u of usersByIndex) {
    await prisma.user.update({
      where: { id: u.id },
      data: { departmentId: departmentIds[u.dept] },
    });
  }

  // Give each subsidiary a real team lead drawn from its own staff.
  for (let s = 0; s < subsidiaries.length; s += 1) {
    const memberIndex = PEOPLE.findIndex((pp) => pp.sub === s);
    if (memberIndex > 0) {
      await prisma.subsidiary.update({
        where: { id: subsidiaries[s].id },
        data: { teamLeadId: usersByIndex[memberIndex].id },
      });
    }
  }

  console.log(
    `   ✓ ${company.name}: ${subsidiaries.length} subsidiaries, ` +
      `${DEPARTMENTS.length} departments, ${userIds.length} users`,
  );

  return {
    company: { id: company.id, name: company.name },
    adminUserId: admin.id,
    subsidiaries,
    departmentIds,
    userIds,
    dataOfficerIds,
  };
}
