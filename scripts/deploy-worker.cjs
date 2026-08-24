// Thin stub for a REST-based Worker deploy, mirroring the pattern in
// Across's scripts/deploy-worker.cjs. This machine has no Cloudflare API
// token configured and no wrangler (Windows ARM64 has no workerd build),
// so this script intentionally does NOT run a deploy — it documents the
// exact manual steps the account owner still needs to do.
//
// Once CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / CF_D1_DATABASE_ID are
// available, replace the body of main() with the same REST-upload flow
// Across uses (PUT the worker script + bindings via the Cloudflare API),
// reading worker/index.js directly since it has no external imports.

function main() {
  console.log(`
Matched — Worker deploy is manual for now. Steps:

1. Create a D1 database:
   npx wrangler d1 create matched-db
   (or via the Cloudflare dashboard: Workers & Pages -> D1 -> Create database)

2. Apply the schemas in order:
   npx wrangler d1 execute matched-db --file=migrations/0001_initial.sql --remote
   npx wrangler d1 execute matched-db --file=migrations/0002_daily_results.sql --remote
   npx wrangler d1 execute matched-db --file=migrations/0003_activity.sql --remote

3. Create a Worker (dashboard -> Workers & Pages -> Create -> Worker),
   paste the full contents of worker/index.js into Quick Edit, and deploy.

4. Bind it:
   - D1 database binding named DB -> matched-db
   - Durable Object binding named ROOM -> class RoomDO (this same script)
     (first deploy needs a migration that defines the RoomDO class; see
     Cloudflare's Durable Object migration docs)

5. Set Worker secrets/variables:
   - APP_KEY (secret)        -> must match window.APP_KEY in config.js
   - ALLOWED_ORIGIN (var)    -> e.g. https://<you>.github.io

6. Copy the Worker's *.workers.dev URL into config.js's window.WORKER_URL.

This script does not touch any Cloudflare account. See AGENTS.md for the
same note in context.
`);
}

main();
