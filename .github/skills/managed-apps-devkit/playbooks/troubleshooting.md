# Troubleshooting

First run `node .github/skills/managed-apps-devkit/scripts/doctor.mjs` — most
failures are a missing prerequisite or a wrong binding. Then match the error.

| Error / symptom | Cause | Fix |
| --- | --- | --- |
| `Git Credential Manager is installed but not configured` | GCM not registered as helper (common on macOS) | `git credential-manager configure` |
| `fatal: Cannot prompt because user interactivity has been disabled` | Agent shell disables Git prompts | ALM scripts handle it. Manual push: `GIT_TERMINAL_PROMPT=1 GCM_INTERACTIVE=1 GCM_GUI_PROMPT=0 git push …`, or ask the user to run it in their terminal |
| `! [rejected] … (fetch first)` on first push to a platform repo | New platform repo has its own "Initial commit" | `npm run alm:bootstrap -- <env>` |
| `'.' is not empty` from `ms app create` | `.git` counts as content | Use `ms app init` in an existing repo |
| App landed in the wrong environment | Created without `--environment-id` (auto-routed to personal dev env) | Can't move it. Create a new app with the right `--environment-id`; delete the stray one |
| `ms app info` fails for an app you can see in `ms app list` | Run inside a project; it defaulted to `./ms.config.json`'s environment | Run from a neutral directory, or pass `-e <environmentId>` |
| `ms.config.json targets the wrong environment/app` from `alm:deploy` | Binding from another branch leaked in | Do not deploy. `git log -- ms.config.json`; restore this branch's version |
| Merge conflict in `ms.config.json` during promotion | Merge driver not registered in this clone | `npm run alm:setup`; keep the **target's** copy (`git checkout --ours ms.config.json`) |
| `Schema drift: <env> has vX but the repo ships vY` | Solution not imported into target | `npm run alm:solution -- import <env>`, then redeploy |
| `Environment "<env>" is not provisioned yet` | Placeholder stage | [environments.md → Provision](environments.md#provision) |
| `Blocked: direct push to '<branch>'` | pre-push hook guarding env branches | Use `alm:promote` / `alm:deploy`. Emergency only: `ALM_ALLOW_PUSH=1 git push …` |
| `Invalid ms.config.json for shared connection policy enforcement` | Shared connection missing `allowedActions` | Declare least-privilege actions per table/connector (plugin `allowed-actions` guidance) |
| `The Microsoft GitHub App can't access the bound repository` | GitHub App not installed on the owner (EMU accounts usually can't) | Use a platform-managed repo (`--repo native`) |
| `External artifact deployment is not enabled` | App registered with `--repo none` | Admin enables *External artifacts* (PPAC → Copilot → Settings → Managed apps), or re-register with `--repo native` |
| App opens, then errors on first data load for some users | Shared, but no Dataverse role | [access.md → Role](access.md#role) |
| `dataverse: command not found` in scripts | Dataverse CLI not on PATH | Install/sign in via `dv-connect`; add its bin dir to PATH |
| Token / 401 errors from `ms` | Expired sign-in | `ms auth login` (check `ms auth status` shows the expected account) |
| 403 on deploy / app missing from `ms app list` | No maker rights in that environment, or not shared | Ask the environment admin; confirm with `ms app list --json` |
| Playwright e2e can't sign in | Passkey/FIDO-only account under automation | Use a password or Authenticator account |
| A scaffold fix "disappeared" | Ran `alm:upgrade` before `alm:template push` | `git checkout <fix-commit> -- <path>`; publish, then upgrade |

Still stuck: gather `ms --version`, the exact command, full error text and
`doctor.mjs` output, and check `ms <command> --help` — the CLI is in preview and
flags change.
