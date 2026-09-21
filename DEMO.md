# Demo environment

A self-contained, fully-populated copy of the platform for client showcases.
It runs against its own database and its own credentials, so demos never touch
production data and never add dummy records to the real system.

All demo content is **fabricated**. No production data is copied, and no real
company, person or figure appears in it.

## Quick start

```bash
cp .env.demo.example .env          # then edit DATABASE_URL and JWT_SECRET
createdb horizon_demo              # or point DATABASE_URL at any empty database

yarn install
yarn prisma migrate deploy         # apply the schema
yarn db:seed                       # reference data: roles, sectors, plans
yarn demo:seed                     # the demo tenant itself
```

Or, once `.env` is in place, the whole chain in one step:

```bash
yarn demo:up
```

## Commands

| Command | What it does |
| --- | --- |
| `yarn demo:seed` | Populates the demo tenant. Refuses to run if it already exists. |
| `yarn demo:reset` | Deletes everything the demo seed created. Leaves reference data intact. |
| `yarn demo:rebuild` | `reset` + `db:seed` + `demo:seed` — a clean slate between client sessions. |
| `yarn demo:up` | `migrate deploy` + `db:seed` + `demo:seed` — first-time setup. |

## Logging in

Every demo user shares one password: **`DemoPass123!`**

| Login | Role |
| --- | --- |
| `adaeze.okonkwo@meridian-demo.com` | Company ESG admin — start here |
| `tunde.bakare@meridian-demo.com` | ESG sub-admin (reviewer/approver) |
| `ibrahim.danjuma@meridian-demo.com` | Data officer |
| `olumide.fashola@meridian-demo.com` | Viewer (read-only) |

All 25 demo accounts follow `first.last@meridian-demo.com`.

## What the demo contains

**Meridian Industries Plc** — a mid-size Nigerian industrial group.

| | |
| --- | --- |
| Subsidiaries | 4 — cement, power & utilities, logistics, agrifoods |
| Users | 25 across 5 departments and 4 role types |
| Assessments | 12 — three reporting years x four subsidiaries |
| GHG data | Full Scope 1 tree (stationary, mobile, process, fugitive) + Scope 2 location- and market-based |
| Reports | 12, with ESG scores, grades and pillar breakdowns |
| Targets | Group net-zero pathway to 2030 plus an interim Scope 2 renewable target |
| Tasks | 10 across every status, with assignees and comments |
| Audit log | 180 entries; 40 recent-activity records |
| Billing | Enterprise subscription with 8 invoices, one outstanding |

The subsidiaries sit in deliberately different SASB industries so a demo can
show contrasting emission profiles side by side.

### The story the data tells

Group emissions decline steadily year on year, which is what a prospect should
see on the trend chart:

| Year | Scope 1 | Scope 2 | Scope 3 | Total (tCO2e) |
| --- | --- | --- | --- | --- |
| 2023 | 99,636 | 42,874 | 149,673 | 292,183 |
| 2024 | 88,788 | 38,053 | 139,115 | 265,955 |
| 2025 | 81,080 | 33,365 | 133,561 | 248,005 |

Assessment states are spread on purpose so every screen has something to show:
2023 fully approved, 2024 approved with one awaiting sign-off, and 2025 still in
flight — two in progress, one awaiting review, one rejected with a reason
attached.

## Safety

Both `demo:seed` and `demo:reset` go through a guard (`prisma/demo/guard.ts`)
that refuses to run unless:

1. `DEMO_MODE=true` is set, **and**
2. `DATABASE_URL` does not look like a production or managed host
   (`prod`, `production`, `live`, `neon.tech`, `supabase.co`, `rds.amazonaws.com`,
   `render.com`, `railway.app`)

The second check can be waived with `DEMO_ALLOW_RISKY_URL=true` when the target
really is disposable. Do not set it on a database you care about — `demo:reset`
deletes rows permanently.

`demo:reset` only removes rows belonging to the demo tenant. Reference data
(roles, sectors, industries, subscription plans) and any other company in the
database are left untouched.

## Reproducibility

The seed is deterministic: every run produces byte-identical data, so recorded
walkthroughs and screenshots stay valid. Set `DEMO_SEED` to a different integer
for a different-but-equally-consistent dataset.

## Extending the demo

| File | Contains |
| --- | --- |
| `prisma/demo/tenant.ts` | Company, subsidiaries, departments, the 25 people |
| `prisma/demo/emissions.ts` | Assessments, disclosure topics, Scope 1/2 data, reports |
| `prisma/demo/engagement.ts` | Targets, tasks, audit log, activity feed, billing |
| `prisma/demo/rng.ts` | Deterministic random helpers and the declining-trend generator |
| `prisma/demo/guard.ts` | The safety check described above |
| `prisma/demo/reset.ts` | Teardown, in dependency order |

To add another demo tenant, add an entry to `DEMO_SUBSIDIARIES` or call
`seedTenant` with different constants — the emissions and engagement modules
take the tenant as an argument and do not assume a single company.
