# Ship

`alm:deploy` pushes the environment branch to its platform repo (as `main`),
mirrors to GitHub, and runs `ms app deploy --commit <HEAD>`. It refuses unless
branch, clean tree, `ms.config.json` (app + environment), connection references,
solution version and build all check out. **Let it refuse** — fix the cause,
never bypass.

Environment order and names come from `alm.config.json → promotionOrder`
(default `dev → test → prod`). Everything below works for any extra stage such
as `qa`.

## Dev

**Confirm:** not needed for dev (still state what will happen).

```bash
git checkout dev && git merge --no-ff feature/<name>
npm run alm:deploy -- dev
```

First deploy to a new platform repo fails with *rejected (fetch first)* →
`npm run alm:bootstrap -- dev`, then retry.

**Done when** the output shows `Deployed dev @ <sha>`. Give the Play URL
(`https://play.managedapps.cloud.microsoft/apps/<appId>`).

## Promote

To environment `<next>` (the one after the current in `promotionOrder`).

**Confirm first:** "Promote `<prev>` → `<next>` and deploy to `<displayName>`? This updates the live app."

```bash
npm run alm:promote  -- <next>            # merges previous stage in; verifies ms.config.json untouched
npm run alm:solution -- status            # does <next> need the new schema?
npm run alm:solution -- import <next>     # only if its version differs — BEFORE deploying
npm run alm:deploy   -- <next>
```

- `--from <env>` on `alm:promote` overrides the source stage (rarely needed).
- If promote reports a conflict in `ms.config.json`: keep the **target's** copy
  (`git checkout --ours ms.config.json`). Check `npm run alm:setup` has been run.
- Run the sequence one environment at a time; verify each Play URL before the next.

## Preview

See code running without making it live.

- Local: `ms app dev` on the branch (fastest, no push).
- Cloud: `ms app play --mode preview [--commit <sha> | --branch <b>] --no-browser`
  opens the latest successful **cloud build** — the commit must already be on
  that app's platform repo. In this ALM only `alm:deploy` pushes there, so cloud
  preview is mainly useful for inspecting a *previous* commit. *Unverified* for
  every repo mode; if it errors, fall back to local.

## Rollback

App-only changes: redeploy the last good commit from the same branch.

```bash
git checkout <env-branch>
git log --oneline -15                  # pick the last good sha with the user
ms app deploy --commit <sha>           # the one sanctioned raw deploy
```

**Confirm first.** The branch HEAD still contains the bad change — follow up
with a revert commit on `dev` and promote it, or the next deploy re-ships it.

Schema changes do not roll back cleanly (managed solutions can't be downgraded
by import). Prefer a forward fix; this is why schema changes should be additive.

## Hotfix

A fix for production **without** the unfinished work sitting in `dev`.

```bash
npm run alm:hotfix -- start <name>     # branches hotfix/<name> from the LAST stage (prod)
# fix, commit, verify with ms app dev
npm run alm:hotfix -- land <name>      # merges to prod, back-merges into every earlier stage
npm run alm:deploy -- prod             # confirm first
npm run alm:deploy -- dev              # optional; ship the back-merge to earlier stages
```

The back-merge is the step people forget; without it the next promotion
silently reverts the fix. If the hotfix needs a schema change, see
`docs/ALM.md → Schema changes` before starting.

After any production deploy: update `memory-bank.md` (date, env, sha).
