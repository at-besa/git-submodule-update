const vscode = require('vscode');
const { execFile } = require('child_process');
const path = require('path');

const STATUS_LABELS = {
  ' ': 'Initialized',
  '+': 'Different commit checked out',
  '-': 'Not initialized',
  U: 'Merge conflicts',
};

const VIEW_ID = 'submoduleUpdate.view';

function resolveCwd(scm) {
  return scm?.rootUri?.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        err.stdout = stdout;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function parseSubmoduleStatus(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([ U+-])([0-9a-f]+)\s+(\S+)(?:\s+\((.+)\))?$/i);
      if (!match) return undefined;
      const [, status, sha, submodulePath, describe] = match;
      return { status, sha, path: submodulePath, describe };
    })
    .filter(Boolean);
}

async function listSubmodules(cwd) {
  const { stdout } = await runGit(['submodule', 'status', '--recursive'], cwd);
  return parseSubmoduleStatus(stdout);
}

async function runSubmoduleUpdate(scm, { flags, paths, label }) {
  const cwd = resolveCwd(scm);
  if (!cwd) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const args = ['submodule', 'update', ...flags, ...(paths?.length ? ['--', ...paths] : [])];

  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.SourceControl, title: `${label}…` },
    async () => {
      try {
        await runGit(args, cwd);
        const target = paths?.length ? paths.join(', ') : 'all submodules';
        vscode.window.showInformationMessage(`Done: ${label} (${target})`);
      } catch (err) {
        vscode.window.showErrorMessage(err.stderr || err.message || `Failed: ${label}`);
      }
    }
  );
}

class SubmoduleItem extends vscode.TreeItem {
  /**
   * @param {{ path: string, sha: string, status: string, describe?: string }} submodule
   * @param {string} cwd
   */
  constructor(submodule, cwd) {
    super(submodule.path, vscode.TreeItemCollapsibleState.None);
    this.submodulePath = submodule.path;
    this.cwd = cwd;
    this.contextValue = 'submodule';
    this.description = submodule.describe || submodule.sha.slice(0, 7);
    this.tooltip = `${submodule.path}\n${STATUS_LABELS[submodule.status] || submodule.status}\n${submodule.sha}`;
    this.iconPath = new vscode.ThemeIcon(
      submodule.status === '-' ? 'circle-outline' : 'git-commit'
    );
    this.resourceUri = vscode.Uri.file(path.join(cwd, submodule.path));
  }
}

class SubmodulesProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._cwd = resolveCwd();
  }

  refresh() {
    this._cwd = resolveCwd();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren() {
    const cwd = this._cwd;
    if (!cwd) {
      await vscode.commands.executeCommand('setContext', 'submoduleUpdate:hasSubmodules', false);
      return [];
    }

    try {
      const submodules = await listSubmodules(cwd);
      await vscode.commands.executeCommand(
        'setContext',
        'submoduleUpdate:hasSubmodules',
        submodules.length > 0
      );
      return submodules.map((sub) => new SubmoduleItem(sub, cwd));
    } catch {
      await vscode.commands.executeCommand('setContext', 'submoduleUpdate:hasSubmodules', false);
      return [];
    }
  }
}

exports.activate = (ctx) => {
  const provider = new SubmodulesProvider();
  const tree = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: false,
  });

  const refresh = () => provider.refresh();

  ctx.subscriptions.push(
    tree,
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
    vscode.commands.registerCommand('submoduleUpdate.refreshView', refresh),

    vscode.commands.registerCommand('submoduleUpdate.init', (scm) =>
      runSubmoduleUpdate(scm, {
        flags: ['--init', '--recursive'],
        label: 'Submodules Init',
      }).then(refresh)
    ),

    vscode.commands.registerCommand('submoduleUpdate.remote', (scm) =>
      runSubmoduleUpdate(scm, {
        flags: ['--remote', '--recursive'],
        label: 'Submodules Remote',
      }).then(refresh)
    ),

    vscode.commands.registerCommand('submoduleUpdate.initOne', async (item) => {
      if (!item?.submodulePath) return;
      await runSubmoduleUpdate(
        { rootUri: vscode.Uri.file(item.cwd) },
        {
          flags: ['--init', '--recursive'],
          paths: [item.submodulePath],
          label: 'Submodules Init',
        }
      );
      refresh();
    }),

    vscode.commands.registerCommand('submoduleUpdate.remoteOne', async (item) => {
      if (!item?.submodulePath) return;
      await runSubmoduleUpdate(
        { rootUri: vscode.Uri.file(item.cwd) },
        {
          flags: ['--remote', '--recursive'],
          paths: [item.submodulePath],
          label: 'Submodules Remote',
        }
      );
      refresh();
    })
  );

  refresh();
};
