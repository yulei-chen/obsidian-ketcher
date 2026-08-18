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
in Live Preview and Reading view. Hover previews use Obsidian's **Page
preview** core plugin, which must be enabled.

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

To release version `0.2.0`:

1. Ensure `package.json`, `manifest.json`, and `versions.json` contain the new
   version, and push those changes.
2. Create and push an annotated tag without a `v` prefix:

   ```bash
   git tag -a 0.2.0 -m "0.2.0"
   git push origin 0.2.0
   ```

3. Wait for the **Release Obsidian plugin** workflow to finish.
4. Review the generated draft release, add release notes, and publish it.

The workflow rejects mismatched versions or missing assets, generates build
provenance attestations, and uploads each required asset separately.
