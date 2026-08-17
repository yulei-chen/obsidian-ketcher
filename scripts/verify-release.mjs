import { accessSync, constants, readFileSync } from 'node:fs';

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (!tag) {
	throw new Error('Provide the release tag as an argument or GITHUB_REF_NAME.');
}

if (!/^\d+\.\d+\.\d+$/.test(tag)) {
	throw new Error(`Release tag must use x.y.z without a v prefix: ${tag}`);
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

if (manifest.version !== tag) {
	throw new Error(
		`manifest.json version ${manifest.version} does not match tag ${tag}.`,
	);
}

if (packageJson.version !== tag) {
	throw new Error(
		`package.json version ${packageJson.version} does not match tag ${tag}.`,
	);
}

for (const asset of ['main.js', 'manifest.json', 'styles.css']) {
	accessSync(asset, constants.R_OK);
}
