# Environments

One environment in this ALM = **one branch + one platform git remote + one app
registration + (optionally) one Dataverse org**, all recorded in
`alm.config.json → environments.<key>`. Apps cannot move between environments,
so each stage has its own app, named with a suffix: `My App [QA]`.

## Add

Add a new stage, e.g. `qa`. Replace `qa` / `QA` with the user's name throughout.

**Ask the user (one question each):** where it goes in the order
(`dev → qa → test → prod` or `dev → test → qa → prod`), and whether the
environment already exists.

**Steps** (all edits on `dev` unless stated):

1. **Environment.** If it doesn't exist, the user creates it in the Power
   Platform admin center (Sandbox, with Dataverse if the app uses it), or:
   `pac admin create --name "<name>" --type Sandbox --region <region>` (needs
   environment-creation rights). Get ID + Dataverse
   URL from `pac admin list --json`.
2. **Config.** In `alm.config.json`, add the entry and insert it into `promotionOrder`:
   ```json
   "qa": { "branch": "qa", "remote": "env-qa", "displayName": "<env name> (qa)",
           "environmentId": "<id>", "appId": "", "dataverseUrl": "https://<org>.crm.dynamics.com",
           "provisioned": false }
   ```
3. **Hardcoded stage names** (scaffold files — change them once, generally):
   - `.githooks/pre-push`: the `grep -E '^refs/heads/(test|prod)$'` list must
     include `qa` (every stage except the first).
   - `.github/workflows/ci.yml`: add `qa` to both `branches: [...]` lists.
   - Usage strings in `scripts/alm/{bootstrap,deploy,promote,solution}.mjs` are
     cosmetic; the logic already reads `alm.config.json`.
   - `docs/ALM.md`, README diagrams, `memory-bank.md`: add the stage.
   Scaffold edits should be published to the template afterwards
   ([maintain.md → Publish](maintain.md#publish)).
4. **Commit on dev:** `git commit -am "chore(alm): add qa stage"`.
5. **Branch.** Create `qa` from the stage *before* it, with **no binding**:
   ```bash
   git branch qa <previous-stage> && git checkout qa
   git rm --cached ms.config.json && rm ms.config.json      # if present
   git commit -m "chore(qa): no binding until provisioned"
   git merge dev                                             # bring in step 4 (if previous stage ≠ dev)
   ```
6. Provision it → next section, using `qa`.

**Done when** `doctor.mjs` shows `qa` provisioned, and `alm:promote -- qa` then
`alm:deploy -- qa` succeed.

## Provision

Bind a placeholder stage (`provisioned: false`, no `ms.config.json` on its
branch) to a real app. Order matters: **schema first, then the app.**

**Confirm first:** registering creates a permanent app in that environment.

```bash
# 1. Schema into the target org (role is inside the solution)
npm run alm:solution -- import <env>

# 2. Register the app from the env branch
git checkout <branch>
ms app init --display-name "<App> [<ENV>]" --environment-id <id> --repo native --non-interactive
git remote rename origin <remote>                 # ms app init always names it origin

# 3. Bind data sources to THIS environment's org, for each table
ms app add data-source --connector shared_commondataserviceforapps --as table --table <logicalname> --use-sso
```

4. Set `appId` and `provisioned: true` for the stage in `alm.config.json`.
   Make the **identical** edit on `dev` and on the env branch (commit both), so
   later promotions merge it cleanly.
5. Commit `ms.config.json` and generated files on the env branch.
6. `npm run alm:bootstrap -- <env>` (joins the new platform repo's history) → `npm run alm:deploy -- <env>`.
7. Grant access: [access.md](access.md#role), then [access.md](access.md#share).

Verify: `node .github/skills/managed-apps-devkit/scripts/doctor.mjs` on that branch.

## Rename

```bash
git checkout <branch>
# edit ms.config.json → "appDisplayName": "My App [TEST]"
git commit -am "chore(<env>): display name"
npm run alm:deploy -- <env>              # the deploy propagates the name
```

There is no rename command. `ms.config.json` is pinned per branch, so each
stage keeps its own name through promotions.

## Retire

**Confirm first** — deleting an app is not reversible from the CLI.

1. Remove the stage from `promotionOrder` (keep or delete the entry).
2. Remove it from `.githooks/pre-push` and `ci.yml` lists.
3. Optionally `ms app delete --app <appId>` ([maintain.md](maintain.md#delete)).
4. `git remote remove <remote>`; archive or delete the branch with the user's OK.
