import {
	addIcon,
	Notice,
	normalizePath,
	Plugin,
	TFile,
	TFolder,
} from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { getErrorMessage } from './errors';
import { registerKetEmbedProcessor } from './ket-embed';
import { KetPreviewRenderer } from './ket-preview';
import { KetView, VIEW_TYPE_KET } from './ket-view';
import {
	DEFAULT_SETTINGS,
	KetcherSettingTab,
	parseSettings,
} from './settings';
import type { KetcherSettings } from './settings';

export default class ObsidianKetcher extends Plugin {
	settings!: KetcherSettings;
	private readonly previewRenderer = new KetPreviewRenderer();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_KET,
			(leaf) => new KetView(leaf, this.previewRenderer),
		);
		this.registerExtensions(['ket'], VIEW_TYPE_KET);
		registerKetEmbedProcessor(this, this.previewRenderer);
		this.register(() => this.previewRenderer.destroy());

		addIcon(
			'ketcher',
			`<path fill="currentColor" clip-rule="evenodd" d="m47.75,2.91c1.93,-1.1 4.22,-1.1 6.15,0l35.56,20.84c1.93,1.1 3.07,3.12 3.07,5.32l-0.33,42.81c0,2.2 -1.15,4.22 -3.07,5.32l-35.26,20.27c-1.93,1.1 -4.22,1.1 -6.15,0l-36.21,-20.35c-1.88,-1.1 -3.03,-3.12 -3.03,-5.32l0,-43.72c0,-2.2 1.15,-4.22 3.03,-5.32l36.23,-19.86zm-31.8,27.39l0,40.24l34.88,20.1l34.83,-20.1l0,-40.24l-34.83,-20.15l-34.88,20.15z" fill-rule="evenodd" />
			<path fill="currentColor" d="m74.14,36.96l0,26.89l6.15,3.53l0,-34l-6.15,3.58zm-23.31,-20.56l-29.46,16.98l6.1,3.53l23.36,-13.45l0,-7.07l0,0zm-29.46,50.98l29.46,17.02l0,-7.07l-23.36,-13.49l-6.1,3.53z" />`,
		);

		this.addRibbonIcon('ketcher', 'Create new structure', async () => {
			try {
				await this.createAndOpenDrawing(this.createDrawingFilename());
			} catch (error) {
				new Notice(
					`Unable to create a KET file: ${getErrorMessage(error)}`,
				);
			}
		});

		this.addSettingTab(new KetcherSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = parseSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async createAndOpenDrawing(
		filename: string,
		foldername?: string,
		initialData?: string,
	): Promise<string> {
		const file = await this.createDrawing(
			filename,
			foldername,
			initialData,
		);
		await this.openDrawing(file, true);
		return file.path;
	}

	async createDrawing(
		filename: string,
		foldername?: string,
		initialData?: string,
	): Promise<TFile> {
		const folderPath = normalizePath(
			foldername?.trim() || this.settings.folder || DEFAULT_SETTINGS.folder,
		);
		await this.ensureFolder(folderPath);

		const filePath = normalizePath(`${folderPath}/${filename}`);
		if (this.app.vault.getAbstractFileByPath(filePath)) {
			throw new Error(`A file already exists at ${filePath}.`);
		}

		return this.app.vault.create(filePath, initialData ?? '');
	}

	async ensureFolder(folderPath: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(folderPath);

		if (existing instanceof TFolder) {
			return;
		}

		if (existing instanceof TFile) {
			throw new Error(
				`The folder cannot be created because a file exists at ${folderPath}.`,
			);
		}

		await this.app.vault.adapter.mkdir(folderPath);
	}

	async openDrawing(
		drawingFile: TFile,
		active = false,
		subpath?: string,
	): Promise<void> {
		const leaf: WorkspaceLeaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(
			drawingFile,
			subpath
				? { active, eState: { subpath } }
				: { active },
		);
	}

	private createDrawingFilename(): string {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		return `Ketcher ${timestamp}.ket`;
	}
}
