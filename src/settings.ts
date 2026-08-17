import {
	App,
	normalizePath,
	PluginSettingTab,
	Setting,
} from 'obsidian';
import type ObsidianKetcher from './main';

export interface KetcherSettings {
	folder: string;
}

export const DEFAULT_SETTINGS: KetcherSettings = {
	folder: 'Ketcher',
};

export function normalizeFolder(value: unknown): string {
	if (typeof value !== 'string') {
		return DEFAULT_SETTINGS.folder;
	}

	const folder = normalizePath(value.trim());
	return folder || DEFAULT_SETTINGS.folder;
}

export function parseSettings(data: unknown): KetcherSettings {
	if (typeof data !== 'object' || data === null || !('folder' in data)) {
		return { ...DEFAULT_SETTINGS };
	}

	return {
		folder: normalizeFolder(data.folder),
	};
}

export class KetcherSettingTab extends PluginSettingTab {
	private readonly plugin: ObsidianKetcher;

	constructor(app: App, plugin: ObsidianKetcher) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Ketcher folder')
			.setDesc('The location for new ket files.')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.folder)
					.setValue(this.plugin.settings.folder)
					.onChange(async (value) => {
						this.plugin.settings.folder = normalizeFolder(value);
						await this.plugin.saveSettings();
					}),
			);
	}
}
