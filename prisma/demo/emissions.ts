import {
  AssessmentStatus,
  DisclosureCategory,
  FuelType,
  PrismaClient,
  ReportingPeriod,
} from '@prisma/client';
import { Rng, decliningSeries } from './rng';
import { DemoTenant } from './tenant';

/**
 * Generates the reporting content that makes the demo look like a live account:
 * one assessment per subsidiary per year, each with a populated GHG Scope 1
 * tree, Scope 2 records, and a computed report row behind it.
 */

export const DEMO_YEARS = [2023, 2024, 2025];

/** Placeholder evidence document. Demo data references it instead of real files. */
const DOC = (label: string) =>
  `https://demo-assets.meridian-demo.com/evidence/${label}.pdf`;
const DOC_ID = (label: string) => `demo/evidence/${label}`;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Status per year: older years are signed off, the current year is still being
 * worked on. This gives a demo something to click through in every state.
 */
function statusForYear(year: number, index: number): AssessmentStatus {
  if (year <= 2023) return AssessmentStatus.approved;
  if (year === 2024) {
    return index === 0 ? AssessmentStatus.submitted_approved : AssessmentStatus.approved;
  }
  // Current year — spread across the in-flight states.
  const inFlight = [
    AssessmentStatus.in_progress,
    AssessmentStatus.awaiting_review,
    AssessmentStatus.in_progress,
    AssessmentStatus.unapproved_rejected,
  ];
  return inFlight[index % inFlight.length];
}

async function seedScope1Tree(
  prisma: PrismaClient,
  rng: Rng,
  ghgDataId: number,
  scale: number,
): Promise<void> {
  const scope1 = await prisma.scope1Data.create({
    data: { ghgDataId, completed: true },
  });

  // --- Stationary combustion -------------------------------------------------
  const stationary = await prisma.stationarySources.create({
    data: { scope1DataId: scope1.id, completed: true },
  });
  await prisma.electricityHeat.create({
    data: {
      stationarySourcesId: stationary.id,
      dieselFuelType: FuelType.diesel,
      dieselVolume: rng.round(48_000 * scale, 92_000 * scale),
      gasFuelType: FuelType.natural_gas,
      gasVolume: rng.round(120_000 * scale, 260_000 * scale),
      files: [{ name: 'generator-fuel-log.pdf', url: DOC('generator-fuel-log') }],
    },
  });
  await prisma.industrialProcesses.create({
    data: {
      stationarySourcesId: stationary.id,
      selectedFuelType: FuelType.natural_gas,
      fuelVolume: rng.round(310_000 * scale, 520_000 * scale),
      files: [{ name: 'kiln-throughput.xlsx', url: DOC('kiln-throughput') }],
    },
  });
  await prisma.oilGasOperations.create({
    data: {
      stationarySourcesId: stationary.id,
      selectedFuelType: FuelType.diesel,
      fuelVolume: rng.round(26_000 * scale, 58_000 * scale),
      files: [{ name: 'boiler-readings.pdf', url: DOC('boiler-readings') }],
    },
  });

  // --- Mobile combustion -----------------------------------------------------
  const mobile = await prisma.mobileSources.create({
    data: { scope1DataId: scope1.id, completed: true },
  });
  await prisma.roadTransport.create({
    data: {
      mobileSourcesId: mobile.id,
      dieselTruckFuelType: FuelType.diesel,
      dieselTruckVolume: rng.round(140_000 * scale, 320_000 * scale),
      carPetrolVolume: rng.round(9_000 * scale, 24_000 * scale),
      carDieselVolume: rng.round(12_000 * scale, 31_000 * scale),
      files: [{ name: 'fleet-fuel-card-statement.csv', url: DOC('fleet-fuel-card') }],
    },
  });
  await prisma.vehicleEquipment.create({
    data: {
      mobileSourcesId: mobile.id,
      forkliftFuelType: FuelType.diesel,
      forkliftVolume: rng.round(3_400 * scale, 8_900 * scale),
      heavyDutyFuelType: FuelType.diesel,
      heavyDutyVolume: rng.round(22_000 * scale, 61_000 * scale),
      tractorFuelType: FuelType.diesel,
      tractorVolume: rng.round(5_100 * scale, 14_000 * scale),
      files: [{ name: 'plant-equipment-hours.xlsx', url: DOC('plant-equipment-hours') }],
    },
  });
  await prisma.marineAviation.create({
    data: {
      mobileSourcesId: mobile.id,
      helicopterFuelType: FuelType.gasoline,
      helicopterVolume: rng.round(400 * scale, 1_800 * scale),
      vesselFuelType: FuelType.diesel,
      vesselVolume: rng.round(7_200 * scale, 19_000 * scale),
      otherFuelType: FuelType.other,
      files: [{ name: 'charter-manifest.pdf', url: DOC('charter-manifest') }],
    },
  });

  // --- Process emissions -----------------------------------------------------
  const process = await prisma.processEmissions.create({
    data: { scope1DataId: scope1.id, completed: true },
  });
  await prisma.cO2Release.create({
    data: {
      processEmissionsId: process.id,
      clinkerQuantity: rng.round(180_000 * scale, 340_000 * scale),
      calciumOxide: rng.round(62, 66),
      magnesiumOxide: rng.round(1.2, 2.4),
      files: [{ name: 'clinker-production.xlsx', url: DOC('clinker-production') }],
    },
  });
  await prisma.gasFlaring.create({
    data: {
      processEmissionsId: process.id,
      gasVolume: rng.round(1_200_000 * scale, 2_600_000 * scale),
      carbonContent: rng.round(68, 76),
      files: [{ name: 'flare-meter-readings.pdf', url: DOC('flare-meter-readings') }],
    },
  });
  await prisma.fertilizerEmissions.create({
    data: {
      processEmissionsId: process.id,
      products: [
        { name: 'Urea', tonnes: rng.round(900 * scale, 2_400 * scale) },
        { name: 'NPK 15-15-15', tonnes: rng.round(600 * scale, 1_800 * scale) },
      ],
      feedstock: rng.round(4_200 * scale, 9_600 * scale),
      files: [{ name: 'fertiliser-application-log.csv', url: DOC('fertiliser-log') }],
    },
  });
  await prisma.entericFermentation.create({
    data: {
      processEmissionsId: process.id,
      animals: [
        { type: 'Cattle (dairy)', head: rng.int(320, 780) },
        { type: 'Cattle (beef)', head: rng.int(150, 460) },
        { type: 'Goats', head: rng.int(400, 1_100) },
      ],
      files: [{ name: 'livestock-census.pdf', url: DOC('livestock-census') }],
    },
  });
  await prisma.methaneNitrousOxide.create({
    data: {
      processEmissionsId: process.id,
      animals: [
        { type: 'Cattle (dairy)', head: rng.int(320, 780) },
        { type: 'Poultry', head: rng.int(8_000, 24_000) },
      ],
      manureSystem: 'Solid storage',
      files: [{ name: 'manure-management-plan.pdf', url: DOC('manure-plan') }],
    },
  });

  // --- Fugitive emissions ----------------------------------------------------
  const fugitive = await prisma.fugitiveEmissions.create({
    data: { scope1DataId: scope1.id, completed: true },
  });
  await prisma.methaneLeaks.create({
    data: {
      fugitiveEmissionsId: fugitive.id,
      compressors: rng.round(12, 48),
      pumps: rng.round(8, 32),
      prds: rng.round(4, 19),
      openEnded: rng.round(6, 26),
      seals: rng.round(9, 34),
      wellheads: rng.round(3, 15),
      manifolds: rng.round(5, 21),
      hoses: rng.round(2, 11),
      drains: rng.round(1, 8),
      sampling: rng.round(1, 6),
      others: rng.round(2, 9),
      methanePercent: rng.round(78, 92),
      files: [{ name: 'ldar-survey.pdf', url: DOC('ldar-survey') }],
    },
  });
  await prisma.ventingNaturalGas.create({
    data: {
      fugitiveEmissionsId: fugitive.id,
      volumeOfGasVented: rng.round(38_000 * scale, 96_000 * scale),
      methane: rng.round(82, 91),
      carbonDioxide: rng.round(1.1, 3.4),
      ethane: rng.round(3.2, 6.8),
      propane: rng.round(1.0, 2.9),
      butanes: rng.round(0.3, 1.2),
      wellheads: rng.round(2, 9),
      nitrogen: rng.round(0.6, 2.1),
      hydrogenSulfide: rng.round(0.01, 0.18),
      others: rng.round(0.2, 0.9),
      files: [{ name: 'vent-gas-composition.pdf', url: DOC('vent-gas-composition') }],
    },
  });
  await prisma.incompleteCombustion.create({
    data: {
      fugitiveEmissionsId: fugitive.id,
      volumeToFlare: rng.round(220_000 * scale, 540_000 * scale),
      flareEfficiency: rng.round(96.5, 99.2),
      gasComposition: rng.round(71, 84),
      files: [{ name: 'flare-efficiency-test.pdf', url: DOC('flare-efficiency-test') }],
    },
  });
  await prisma.hFCLeaks.create({
    data: {
      fugitiveEmissionsId: fugitive.id,
      R134a: true,
      R410A: true,
      R404A: false,
      R407C: rng.chance(0.5),
      R507A: false,
      others: rng.round(1.2, 6.8),
      refrigerantSystem: 'Central chiller plant and split units',
      refrigerantAdded: rng.round(18, 72),
      files: [{ name: 'refrigerant-logbook.pdf', url: DOC('refrigerant-logbook') }],
    },
  });
}

async function seedScope2(
  prisma: PrismaClient,
  rng: Rng,
  subsidiaryId: number,
  creatorId: number,
  year: number,
  scale: number,
): Promise<void> {
  await prisma.locationBasedS2.create({
    data: {
      name: `Location-based Scope 2 — FY${year}`,
      subsidiaryId,
      creator_id: creatorId,
      total_electricity_consumption: rng.round(2_400_000 * scale, 5_800_000 * scale),
      reporting_period_consumption: ReportingPeriod.MONTHLY,
      electricity_supplier: 'Ikeja Electric (demo)',
      invoice_from_electricity_distribution_companies_url: DOC('disco-invoice'),
      invoice_from_electricity_distribution_companies_url_public_id: DOC_ID('disco-invoice'),
      smart_or_sub_meter_reading_url: DOC('meter-reading'),
      smart_or_sub_meter_reading_url_public_id: DOC_ID('meter-reading'),
      utility_contract_or_purchase_agreement_url: DOC('utility-contract'),
      utility_contract_or_purchase_agreement_url_public_id: DOC_ID('utility-contract'),
      amount_of_cooling_energy_consumed: rng.round(180_000 * scale, 420_000 * scale),
      purchased_cooling_type_of_cooling_system_used: 'Absorption chiller',
      purchased_cooling_reporting_period: ReportingPeriod.QUARTERLY,
      cooling_energy_invoices_from_service_providers_url: DOC('cooling-invoice'),
      cooling_energy_invoices_from_service_providers_url_public_id: DOC_ID('cooling-invoice'),
      equipment_performance_log_url: DOC('equipment-log'),
      equipment_performance_log_url_public_id: DOC_ID('equipment-log'),
      sub_metering_records_url: DOC('sub-metering'),
      sub_metering_records_url_public_id: DOC_ID('sub-metering'),
      total_steam_consumed: rng.round(42_000 * scale, 118_000 * scale),
      source_of_steam_consumed: 'Third-party industrial steam supplier',
      purchased_steam_reporting_period: ReportingPeriod.MONTHLY,
      supplier_invoice_for_steam_purchased_url: DOC('steam-invoice'),
      supplier_invoice_for_steam_purchased_url_public_id: DOC_ID('steam-invoice'),
      metered_record_for_steam_consumed_url: DOC('steam-meter'),
      metered_record_for_steam_consumed_url_public_id: DOC_ID('steam-meter'),
      contracts_with_third_party_providers_url: DOC('steam-contract'),
      contracts_with_third_party_providers_url_public_id: DOC_ID('steam-contract'),
      was_heating_energy_purchased: true,
      total_energyGJ: rng.round(9_800 * scale, 26_000 * scale),
      supplier: 'Lagos Industrial Heat Ltd (demo)',
      invoices_for_heating_services_url: DOC('heating-invoice'),
      invoices_for_heating_services_url_public_id: DOC_ID('heating-invoice'),
      metered_heating_records_url: DOC('heating-meter'),
      metered_heating_records_url_public_id: DOC_ID('heating-meter'),
      supplier_contracts_url: DOC('heating-contract'),
      supplier_contracts_url_public_id: DOC_ID('heating-contract'),
      certification_of_refigirant_type_url: DOC('refrigerant-cert'),
      certification_of_refigirant_type_url_public_id: DOC_ID('refrigerant-cert'),
    },
  });

  await prisma.marketBasedS2.create({
    data: {
      name: `Market-based Scope 2 — FY${year}`,
      subsidiaryId,
      creator_id: creatorId,
      total_electricity_consumed: rng.round(2_400_000 * scale, 5_800_000 * scale),
      supplier_specific_emission_factor: rng.round(0.38, 0.52, 4),
      electricity_supplier_contract_with_ipps_url: DOC('ipp-contract'),
      electricity_supplier_contract_with_ipps_url_public_id: DOC_ID('ipp-contract'),
      supplier_issued_emmission_factor_documentation_url: DOC('supplier-ef'),
      supplier_issued_emmission_factor_documentation_url_public_id: DOC_ID('supplier-ef'),
      invoices_and_bills_from_ipp_url: DOC('ipp-invoice'),
      invoices_or_bills_from_ipp_url_public_id: DOC_ID('ipp-invoice'),
      total_grid_energy_consumed: rng.round(1_100_000 * scale, 3_200_000 * scale),
      eac_or_rec_certificate_url: DOC('rec-certificate'),
      eac_or_rec_certificate_url_public_id: DOC_ID('rec-certificate'),
      emission_factor_applied: rng.round(0.36, 0.49, 4),
      energy_attribute_certificate_url: DOC('eac'),
      energy_attribute_certificate_url_public_id: DOC_ID('eac'),
      grid_consumption_invoices_url: DOC('grid-invoice'),
      grid_consumption_invoices_url_public_id: DOC_ID('grid-invoice'),
      contracts_or_purchased_agreement_url: DOC('ppa'),
      contracts_or_purchased_agreement_url_public_id: DOC_ID('ppa'),
      purchased_electricity_total_electricity_consumed: rng.round(900_000 * scale, 2_100_000 * scale),
      residual_mix_emission_factor_applied: rng.round(0.41, 0.55, 4),
      grid_electricity_invoices_url: DOC('grid-electricity-invoice'),
      grid_electricity_invoices_url_public_id: DOC_ID('grid-electricity-invoice'),
      nigerian_grid_emission_factor_documentation_url: DOC('ng-grid-ef'),
      nigerian_grid_emission_factor_documentation_url_public_id: DOC_ID('ng-grid-ef'),
      supplier_contacts_url: DOC('supplier-contacts'),
      supplier_contacts_url_public_id: DOC_ID('supplier-contacts'),
      purchased_cooling_quantity_consumed: rng.round(120_000 * scale, 380_000 * scale),
      purchased_cooling_supplier_specific_emission_factor_applied: rng.round(0.12, 0.28, 4),
      supplier_invoices_for_cooling_or_steam_purchases_url: DOC('cooling-steam-invoice'),
      supplier_invoices_for_cooling_or_steam_purchases_url_public_id: DOC_ID('cooling-steam-invoice'),
      supplier_emission_factor_data_sheet_url: DOC('ef-datasheet'),
      supplier_emission_factor_data_sheet_url_public_id: DOC_ID('ef-datasheet'),
      performance_or_operational_logs_url: DOC('operational-logs'),
      performance_or_operational_logs_url_public_id: DOC_ID('operational-logs'),
    },
  });
}

/** Disclosure topics attached to each assessment. */
const TOPICS: Array<{ category: DisclosureCategory; topic: string; subtopic: string }> = [
  { category: DisclosureCategory.industry_specific, topic: 'Greenhouse Gas Emissions', subtopic: 'Scope 1 Direct Emissions' },
  { category: DisclosureCategory.industry_specific, topic: 'Greenhouse Gas Emissions', subtopic: 'Scope 2 Indirect Emissions' },
  { category: DisclosureCategory.industry_specific, topic: 'Energy Management', subtopic: 'Grid Electricity and Renewables' },
  { category: DisclosureCategory.industry_specific, topic: 'Water & Wastewater Management', subtopic: 'Water Withdrawn in Stressed Regions' },
  { category: DisclosureCategory.industry_specific, topic: 'Air Quality', subtopic: 'NOx, SOx and Particulate Matter' },
  { category: DisclosureCategory.supplementary, topic: 'Employee Health & Safety', subtopic: 'Recordable Incident Rate' },
  { category: DisclosureCategory.supplementary, topic: 'Workforce Diversity', subtopic: 'Gender Representation in Management' },
  { category: DisclosureCategory.supplementary, topic: 'Business Ethics', subtopic: 'Anti-Corruption Training Coverage' },
];

function gradeFor(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 65) return 'C';
  if (score >= 55) return 'D';
  return 'E';
}

export interface EmissionsSummary {
  assessments: number;
  reports: number;
  scope2Records: number;
}

export async function seedAssessments(
  prisma: PrismaClient,
  rng: Rng,
  tenant: DemoTenant,
): Promise<EmissionsSummary> {
  console.log('📊 Seeding assessments, GHG data and reports…');

  let assessments = 0;
  let reports = 0;
  let scope2Records = 0;

  for (let s = 0; s < tenant.subsidiaries.length; s += 1) {
    const sub = tenant.subsidiaries[s];
    const scale = sub.spec.emissionsScale;

    // Each subsidiary improves year on year, which is the story the dashboard
    // should tell when a prospect looks at the trend chart.
    const scope1Series = decliningSeries(rng, 41_500 * scale, DEMO_YEARS.length, 0.09);
    const scope2Series = decliningSeries(rng, 18_200 * scale, DEMO_YEARS.length, 0.11);
    const scope3Series = decliningSeries(rng, 63_400 * scale, DEMO_YEARS.length, 0.06);

    for (let y = 0; y < DEMO_YEARS.length; y += 1) {
      const year = DEMO_YEARS[y];
      const status = statusForYear(year, s);
      const isClosed =
        status === AssessmentStatus.approved ||
        status === AssessmentStatus.submitted_approved;

      const reviewer = tenant.adminUserId;
      const author = tenant.dataOfficerIds[(s + y) % tenant.dataOfficerIds.length];
      const createdAt = new Date(Date.UTC(year, 0, rng.int(8, 26)));
      const submittedAt = isClosed ? new Date(Date.UTC(year + 1, 1, rng.int(3, 24))) : null;

      const assessment = await prisma.assessment.create({
        data: {
          subsidiary: sub.name,
          companyId: tenant.company.id,
          status,
          startMonth: MONTHS[0],
          startYear: String(year),
          endMonth: MONTHS[11],
          endYear: String(year),
          created_by: author,
          updated_by: author,
          reviewed_by: isClosed ? reviewer : null,
          submittedAt,
          reviewedAt: submittedAt,
          approvedAt: status === AssessmentStatus.approved ? submittedAt : null,
          rejection_reason:
            status === AssessmentStatus.unapproved_rejected
              ? 'Scope 2 market-based figures do not reconcile with the supplier invoices provided. Please re-upload Q3 evidence.'
              : null,
          createdAt,
          assessmentData: {
            reportingBoundary: 'Operational control',
            consolidationApproach: 'Operational control',
            baseYear: 2023,
            assuranceLevel: isClosed ? 'Limited assurance' : 'Not yet assured',
            standardsApplied: ['GHG Protocol Corporate Standard', 'SASB', 'IFRS S2'],
            completedSections: isClosed ? 100 : rng.int(38, 82),
          },
        },
      });
      assessments += 1;

      // Disclosure topics; the Scope 1 topic carries the GHG data tree.
      for (const topic of TOPICS) {
        const row = await prisma.disclosureTopic.create({
          data: {
            assessmentId: assessment.id,
            category: topic.category,
            topic: topic.topic,
            subtopic: topic.subtopic,
          },
        });

        if (topic.subtopic === 'Scope 1 Direct Emissions') {
          const ghg = await prisma.ghgData.create({
            data: { disclosureTopicId: row.id },
          });
          await seedScope1Tree(prisma, rng, ghg.id, scale);
        }
      }

      await seedScope2(prisma, rng, sub.id, author, year, scale);
      scope2Records += 2;

      // Every assessment carries a report row. In-flight ones are partial —
      // the Report model tracks that through `progress` / `completed_sections`
      // — but they still contribute figures, so the group trend chart stays
      // continuous across all three years instead of falling off a cliff at
      // the current reporting year.
      {
        const scope1 = scope1Series[y];
        const scope2 = scope2Series[y];
        const scope3 = scope3Series[y];
        const total = Math.round((scope1 + scope2 + scope3) * 100) / 100;
        const esgScore = Math.round(rng.float(62, 88) * 10) / 10;

        await prisma.report.create({
          data: {
            assessmentId: assessment.id,
            startMonth: MONTHS[0],
            startYear: String(year),
            endMonth: MONTHS[11],
            endYear: String(year),
            subsidiary: sub.name,
            progress: isClosed ? 100 : rng.int(46, 88),
            ghg_total_emissions: total,
            ghg_scope_one: scope1,
            ghg_scope_two: scope2,
            ghg_scope_three: scope3,
            ghg_datacount_scope_one: rng.int(18, 34),
            ghg_datacount_scope_two: rng.int(8, 16),
            ghg_datacount_scope_three: rng.int(11, 27),
            environmental_total_emissions: total,
            environmental_scope_one: scope1,
            environmental_scope_two: scope2,
            environmental_scope_three: scope3,
            environmental_datacount_scope_one: rng.int(14, 28),
            environmental_datacount_scope_two: rng.int(6, 14),
            environmental_datacount_scope_three: rng.int(9, 21),
            social_total_emissions: Math.round(total * 0.18 * 100) / 100,
            social_scope_one: Math.round(scope1 * 0.12 * 100) / 100,
            social_scope_two: Math.round(scope2 * 0.15 * 100) / 100,
            social_scope_three: Math.round(scope3 * 0.21 * 100) / 100,
            social_datacount_scope_one: rng.int(5, 13),
            social_datacount_scope_two: rng.int(3, 9),
            social_datacount_scope_three: rng.int(4, 11),
            governance_total_emissions: Math.round(total * 0.09 * 100) / 100,
            governance_scope_one: Math.round(scope1 * 0.07 * 100) / 100,
            governance_scope_two: Math.round(scope2 * 0.08 * 100) / 100,
            governance_scope_three: Math.round(scope3 * 0.1 * 100) / 100,
            governance_datacount_scope_one: rng.int(3, 8),
            governance_datacount_scope_two: rng.int(2, 6),
            governance_datacount_scope_three: rng.int(2, 7),
            completed_sections: isClosed ? 100 : rng.int(46, 88),
            total_sections: 100,
            esgScore,
            esgGrade: gradeFor(esgScore),
            esgPillars: {
              environmental: Math.round(rng.float(58, 90) * 10) / 10,
              social: Math.round(rng.float(60, 92) * 10) / 10,
              governance: Math.round(rng.float(65, 94) * 10) / 10,
            },
          },
        });
        reports += 1;
      }
    }
  }

  console.log(
    `   ✓ ${assessments} assessments, ${reports} reports, ${scope2Records} Scope 2 records`,
  );
  return { assessments, reports, scope2Records };
}
