# Obsidian Ketcher

An Obsidian desktop plugin for viewing and drawing chemical structures and
reactions with [Ketcher](https://github.com/epam/ketcher), a web-based molecule
sketcher.

## Installation

One-click installation: [Add Ketcher to Obsidian](https://community.obsidian.md/plugins/ketcher)

or install from Obsidian under **Settings → Community plugins**.

## Get started

Select the Ketcher ribbon icon to create a new `.ket` file. New files are saved
to the folder configured under **Settings → Ketcher → Ketcher folder**.

<img src="./obsidian-ketcher-demo.gif" alt="Obsidian Ketcher demo" >

Link to a structure with `[[example.ket]]`; hovering the link displays a
read-only structure preview. Embed a structure directly in a note with
`![[example.ket]]`; click the preview to open it in Ketcher. Both forms work
in Live Preview and Reading view.

For editor features and shortcuts, see the
[Ketcher user guide](https://github.com/epam/ketcher/blob/master/documentation/help.md).

## Development

Development requires Node.js 24.14.1 or newer and npm.

```bash
npm ci
npm run dev
```

Run the production checks before committing:

```bash
npm run build
npm run lint
```

The production build creates the three release assets at the repository root:
`main.js`, `manifest.json`, and `styles.css`.

## Releasing

The release workflow follows the
[Obsidian GitHub Actions release guide](https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions).

Before the first release, open **GitHub → Settings → Actions → General →
Workflow permissions**, select **Read and write permissions**, and save.

### Bump the version

Use `npm version`. The
repository's `version` lifecycle script also synchronizes `manifest.json` and
`versions.json`.

```bash
npm version patch # 0.2.0 -> 0.2.1
npm version minor # 0.2.0 -> 0.3.0
npm version major # 0.2.0 -> 1.0.0
```