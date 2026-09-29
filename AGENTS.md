# Agent instructions

This is a Microsoft Managed Apps project built on the dev → test → prod ALM
template. It includes an agent guide, the **devkit**, at
`.github/skills/managed-apps-devkit/`.

- **First time here, or asked to "set up this project"?** Follow
  `.github/skills/managed-apps-devkit/playbooks/setup.md` step by step. It
  installs missing tools, signs in, registers the dev app, and ends with the app
  running locally.
- **Anything else** (menu, deploy, add a connector, share, promote, fix an
  error…): read `.github/skills/managed-apps-devkit/SKILL.md` and follow it.
  If your agent already loaded that skill, just use it.

Ground rules that apply everywhere:

- Prefer `npm run alm:*` scripts over raw `ms` or `git`; they carry the safety guards.
- Confirm with the user before registering an app, deploying beyond dev,
  promoting, sharing, deleting, or pushing.
- Never edit or merge another branch's `ms.config.json`.
- **Blocked connector?** If any tool, skill or analysis shows that a connector or
  MCP server the user wants is blocked (`Policy Status: Blocked`,
  "policy-blocked", or denied by DLP/data policy), stop building on it. Your
  reply must lead with it: name the connector and the environment the app is
  pinned to (`environmentId` in `./ms.config.json`, stage from
  `alm.config.json`). Explain that the pin can't change, and offer next steps.
  Never work around it. Full steps: `.github/skills/managed-apps-devkit/playbooks/develop.md` →
  *When a connector is blocked*.
- Keep environment, tenant and app IDs out of shared files. They belong in
  `alm.config.json` and `memory-bank.md`.
- Architecture and branch model: `docs/ALM.md`.
