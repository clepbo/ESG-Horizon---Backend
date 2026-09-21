# Deploying the demo

Puts the demo environment on a public URL you can send to a client. The API
seeds itself on first boot, so a few minutes after the deploy finishes the demo
is populated and ready to log into.

This describes a **demo** deployment. It is not a production topology — see
[Caveats](#caveats).

## Render (recommended)

`render.yaml` in this repo is a Blueprint describing all three pieces: a
Postgres database, the API, and the frontend.

1. Go to [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints)
   → **New Blueprint Instance**.
2. Pick this repository and the branch holding the deploy config.
3. Render shows the three resources it will create. Apply.
4. Wait for both services to go green. The API's first boot runs migrations and
   both seeds, which takes a few minutes — watch its logs for
   `✔ Demo environment ready.`
5. Open the frontend service's URL and sign in.

Render generates the demo `JWT_SECRET` itself, so no secret is copied from
anywhere. Nothing in `render.yaml` contains a credential.

### Build order

The frontend bakes the API URL into its client bundle at build time, so it must
build *after* the API service exists. Render handles this through the
`fromService` reference. If the frontend happens to build first and points at
nothing, redeploy it once the API is up.

## Railway / Fly.io / anywhere else with Docker

Both repos have a `Dockerfile` that works standalone.

**API** — needs a Postgres instance and these variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | your demo Postgres connection string |
| `JWT_SECRET` | any throwaway value — never the production key |
| `DEMO_MODE` | `true` |
| `DEMO_ALLOW_RISKY_URL` | `true` if the DB host contains `render.com`, `neon.tech`, etc. |
| `ALLOWED_ORIGINS` | `*` for the demo, or the frontend's URL |

**Frontend** — build arg, not a runtime variable:

```bash
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-api-host .
```

`NEXT_PUBLIC_*` values are compiled into the client bundle, so changing the API
URL means rebuilding the image, not restarting it.

## Logging in

Every demo account shares the password **`DemoPass123!`**. Start with
`adaeze.okonkwo@meridian-demo.com` (company ESG admin). See [DEMO.md](./DEMO.md)
for the full account list and what the dataset contains.

On first sign-in the app shows its welcome tour. Click **Opt Out** once to land
straight on the dashboard from then on — it is a per-browser `localStorage`
flag, so do it in whichever browser you demo from.

## Caveats

**Free tiers sleep.** Render's free web services spin down after ~15 minutes
idle and take ~50 seconds to wake. Open the link a minute before a client call,
or use a paid instance for anything scheduled.

**Free Postgres expires.** Render's free database is removed after 30 days. When
that happens, recreate it and redeploy — the API reseeds from empty on boot, so
nothing is lost.

**CORS is wide open.** `ALLOWED_ORIGINS=*` is set to avoid a circular reference
between the two services. Fine for a demo with fabricated data; never do this on
a deployment holding anything real.

**Email and uploads are off.** Brevo and Cloudinary are left unset, so invitation
emails and file uploads will not work. Nothing in the demo dataset depends on
them — evidence documents are referenced by placeholder URL. Add sandbox keys if
you need to exercise those flows.

**Social login is off.** The Supabase variables are placeholders. Email and
password sign-in is unaffected.

## Re-seeding a deployed demo

The demo seed refuses to run when its tenant already exists, so a redeploy will
not duplicate anything. To rebuild the dataset, open a shell on the API service:

```bash
./node_modules/.bin/ts-node prisma/demo-reset.ts
./node_modules/.bin/ts-node prisma/demo-seed.ts
```

Both go through the safety guard, which needs `DEMO_MODE=true` — already set by
the blueprint.
