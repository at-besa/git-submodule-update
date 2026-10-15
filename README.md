# Git Submodule Update

VS Code extension that adds git submodule update actions to the **Source Control** view:

- Toolbar buttons and a **Submodules** submenu in the `…` menu for updating **all** submodules
- A **Submodules** list in the Source Control sidebar with **each submodule by name**, plus Init / Remote actions per row

> VS Code does not allow extensions to inject dynamic entries into the `…` menu (menu contributions are fixed in `package.json`). Per-submodule actions therefore live in the sidebar list, where names can update with the repo.

| Action | Where | Runs |
| --- | --- | --- |
| Init All | Toolbar / `…` → Submodules / view title | `git submodule update --init --recursive` |
| Remote All | Toolbar / `…` → Submodules / view title | `git submodule update --remote --recursive` |
| Init / Remote | Inline (or context menu) on a submodule row | same flags, for that submodule path only |

![Submodules Init button](docs/submodules-init.png)

![Submodules Remote button](docs/submodules-remote.png)

Commands are also available from the Command Palette under **Git Submodules**. Each command runs in the root of the repository the action belongs to (falls back to the first workspace folder), shows progress in the Source Control view, and reports success or the git error as a notification.

## Requirements

- VS Code `^1.80.0`
- `git` available on the `PATH`

## Installation

1. Download the latest `.vsix` from the [Releases](https://github.com/at-besa/git-submodule-update/releases) page.
2. Install it:
   ```sh
   code --install-extension git-submodule-update-<version>.vsix
   ```
   or use **Extensions → … → Install from VSIX…**.

## Development

```sh
npm ci
npm run package   # builds a .vsix in the project root
```

Press `F5` in VS Code to launch an Extension Development Host.

## Releases

Releases are fully automated with [semantic-release](https://github.com/semantic-release/semantic-release) and GitHub Actions on every push to `main`. The version is derived from [Conventional Commits](https://www.conventionalcommits.org/):

| Commit type | Release |
| --- | --- |
| `fix:` | patch (`0.0.x`) |
| `feat:` | minor (`0.x.0`) |
| `feat!:` / `BREAKING CHANGE:` footer | major (`x.0.0`) |
| `docs:`, `chore:`, `refactor:`, … | no release |

On release, the workflow updates `package.json` and `CHANGELOG.md`, tags the commit, builds the `.vsix` and attaches it to the GitHub release.

## License

[GPL-3.0](LICENSE)
