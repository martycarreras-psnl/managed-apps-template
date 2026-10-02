# Contributing

This project welcomes contributions and suggestions. Most contributions require you to
agree to a Contributor License Agreement (CLA) declaring that you have the right to,
and actually do, grant us the rights to use your contribution. For details, visit
https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need
to provide a CLA and decorate the PR appropriately (e.g., status check, comment). Simply
follow the instructions provided by the bot. You will only need to do this once across
all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/)
or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## How changes reach this template

This repository is **published** from a separate ALM source repo, and each publish overwrites it.
Your issue or pull request here is the right place to start. A maintainer reviews it, ports the
change into the source repo, and publishes a new tagged release (`scaffold-vX.Y.Z`). Your pull
request is then closed with a link to the release that includes it.

## Getting Started

1. **Fork the repository** and clone your fork locally.
2. **Install dependencies** with npm (Node.js 22 or later):
   ```bash
   npm install
   npm run alm:setup        # merge driver + git hooks, once per clone
   ```
3. **Build and lint** to confirm everything passes:
   ```bash
   npm run build
   npm run lint
   ```
4. **Make your changes** on a feature branch.
5. **Build and lint again**, and syntax-check any script you touched:
   ```bash
   npm run build
   npm run lint
   node --check scripts/alm/<file>.mjs
   ```
6. **Open a pull request** against `main`.

You don't need a Power Platform environment for most changes. Anything that deploys, promotes, or
talks to Dataverse needs one: describe how you tested it in the pull request.

## What We're Looking For

- Bug fixes in the `alm:*` scripts (`scripts/alm/`), git hooks, or CI
- Improvements to the devkit skill and its playbooks (`.github/skills/managed-apps-devkit/`)
- Clearer agent guidance in `AGENTS.md`
- Better error messages and recovery hints
- Documentation clarity and typo fixes, in `docs/` and the README
- Cross-platform compatibility (Windows, macOS, Linux)

## Guidelines

### Code Style

- Scripts use **Node.js ESM** (`.mjs`, `import`/`export`).
- Use `execFileSync` with argument arrays for subprocess calls, never template strings in shell commands.
- Shared helpers live in `scripts/alm/lib.mjs`. Reuse them (`fail`, `ok`, `git`, `almConfig`, …).
- Every guard should fail loudly with a next step: `fail('What went wrong.', 'Run: npm run …')`.
- Match the existing style. `npm run lint` must pass.

### Safety rules

- Never commit environment, tenant or app IDs. `alm.config.json` in this template stays unprovisioned.
- Don't weaken a deploy or promotion guard to make something pass. Fix the cause.
- Changes to `ms.config.json` handling must keep the per-branch binding (`merge=ours`) intact.

### Commits

- Use conventional commit messages: `fix:`, `feat:`, `chore:`, `docs:`.
- One logical change per commit.

### Docs that must stay in step

If you add or change something a user can do (a devkit menu item, an `npm run alm:*` command or flag,
a script, or a workflow), update the matching guide in the same pull request:

- `docs/advanced.html`: a phrase in `#ask` and the relevant section
- `docs/grow.html`: `#start`, if it applies without Dataverse
- `docs/ALM.md` and the README, for headline changes

## Pull Request Checklist

- [ ] `npm run build` and `npm run lint` pass
- [ ] Syntax check passes on modified `.mjs` files: `node --check <file>`
- [ ] No secrets, credentials, or environment, tenant or app IDs in the diff
- [ ] Commit messages follow conventional format
- [ ] PR description explains the why, not just the what
- [ ] User-facing changes include the matching guide updates

## Reporting Issues

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce (include the `npm run alm:*` command and its output)
- Your OS, Node.js version, and `ms --version`

For security vulnerabilities, see [SECURITY.md](SECURITY.md).
