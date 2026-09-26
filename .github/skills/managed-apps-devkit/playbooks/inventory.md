# See what I have

All read-only. Run the commands; do not ask the user for anything.

## Environments

Power Platform environments the signed-in user can see, with IDs and types.

```bash
pac admin list --json        # EnvironmentId, DisplayName, Type, EnvironmentUrl
```

- Present as a table: name, type (Developer / Sandbox / Production), ID, Dataverse URL.
- Mark the ones already mapped in `alm.config.json → environments` with their ALM key.
- If `pac` is missing: `dotnet tool install -g Microsoft.PowerApps.CLI.Tool`, then
  `pac auth create` (it has its own sign-in, separate from `ms`).
- **Developer**-type environments named after a person are personal developer
  environments. `ms app create` without `--environment-id` lands apps there.

## Apps

Every Managed App the user can open or edit, and the environment it is registered in.

```bash
node .github/skills/managed-apps-devkit/scripts/apps-inventory.mjs            # table
node .github/skills/managed-apps-devkit/scripts/apps-inventory.mjs --csv apps.csv
node .github/skills/managed-apps-devkit/scripts/apps-inventory.mjs --json
```

Takes ~15 s (one `ms app info` per app, 3 at a time, with retries). Offer the
CSV path (e.g. `~/Downloads/ManagedAppsInventory.csv`) if the user wants a file.

What it can and cannot see — tell the user when relevant:

- `ms app list` is tenant-wide but limited to apps **shared with the signed-in
  user** (edit or play). It is not an admin view of everyone's apps.
- The admin view is Power Platform admin center → Manage → Inventory, filtered
  to item type *Copilot Managed Runtime*. At the time of writing that item type
  did not appear in at least one tenant's export — the CLI is the reliable source.
- An app's environment is fixed at registration (`ms app create` / `ms app init
  --environment-id`). `ms app deploy` has no environment flag.

## Health

```bash
node .github/skills/managed-apps-devkit/scripts/doctor.mjs            # ~5 s, local only
node .github/skills/managed-apps-devkit/scripts/doctor.mjs --remote   # + remote drift, template version
```

Summarise only the `!` and `✗` lines, each with its fix. If everything passes,
say "Healthy" plus current branch and which environment it deploys to.

## One app

```bash
ms app info --app <appId|name> --json      # environmentId, repoType, connectors, commit, cloneUrl
ms app share list --app <appId> --json     # who has access
ms app get-settings                        # settings of the app bound in ./ms.config.json
```

Run `ms app info` for another app from a neutral directory (see SKILL.md).
Take `appId` from `alm.config.json` when the user names an environment ("the
test app").

## Schema

```bash
npm run alm:solution -- status     # solution version in repo vs every environment
```

Needs the `dataverse` CLI signed in (`dv-connect` skill if not). Drift here is
what blocks `alm:deploy` above dev.
