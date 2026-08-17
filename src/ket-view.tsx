import type { Ketcher } from 'ketcher-core';
import { Notice, TextFileView } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { getErrorMessage } from './errors';
import { KetcherEditor } from './ketcher-editor';

export const VIEW_TYPE_KET = 'ket-view';

export class KetView extends TextFileView {
	private changeSequence = 0;
	private changeSubscriber?: unknown;
	private generation = 0;
	private isReady = false;
	private ketcher?: Ketcher;
	private reactRoot?: Root;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewData(): string {
		return this.data;
	}

	setViewData(data: string, clear: boolean): void {
		if (clear) {
			this.clear();
			this.data = data;
			this.mountEditor();
			return;
		}

		this.data = data;
		this.changeSequence += 1;

		if (this.ketcher && this.isReady) {
			void this.loadDataIntoEditor(this.ketcher, this.generation, data);
		}
	}

	clear(): void {
		this.generation += 1;
		this.changeSequence += 1;
		this.isReady = false;
		this.unsubscribeFromChanges();
		this.ketcher = undefined;
		this.reactRoot?.unmount();
		this.reactRoot = undefined;
		this.contentEl.empty();
		this.data = '';
	}

	getViewType(): string {
		return VIEW_TYPE_KET;
	}

	getIcon(): string {
		return 'ketcher';
	}

	getDisplayText(): string {
		return this.file?.basename ?? 'Ketcher';
	}

	onOpen(): Promise<void> {
		this.addAction('save', 'Save', () => {
			void this.saveFromEditor();
		});
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.clear();
		return Promise.resolve();
	}

	private mountEditor(): void {
		const generation = this.generation;
		this.reactRoot = createRoot(this.contentEl);
		this.reactRoot.render(
			<KetcherEditor
				onError={(message) => {
					this.showError('Ketcher error', message);
				}}
				onInit={(ketcher) => {
					void this.initializeKetcher(ketcher, generation);
				}}
			/>,
		);
	}

	private async initializeKetcher(
		ketcher: Ketcher,
		generation: number,
	): Promise<void> {
		if (generation !== this.generation) {
			return;
		}

		this.ketcher = ketcher;

		try {
			await ketcher.setMolecule(this.data);

			if (generation !== this.generation || this.ketcher !== ketcher) {
				return;
			}

			this.changeSubscriber = ketcher.editor.subscribe('change', () => {
				void this.handleEditorChange(ketcher, generation);
			});
			this.isReady = true;
		} catch (error) {
			if (generation === this.generation) {
				this.showError('Unable to load the KET file', error);
			}
		}
	}

	private async loadDataIntoEditor(
		ketcher: Ketcher,
		generation: number,
		data: string,
	): Promise<void> {
		try {
			await ketcher.setMolecule(data);
		} catch (error) {
			if (generation === this.generation && this.ketcher === ketcher) {
				this.showError('Unable to update the KET view', error);
			}
		}
	}

	private async handleEditorChange(
		ketcher: Ketcher,
		generation: number,
	): Promise<void> {
		const sequence = ++this.changeSequence;

		try {
			const data = await ketcher.getKet();

			if (
				generation !== this.generation ||
				sequence !== this.changeSequence ||
				this.ketcher !== ketcher
			) {
				return;
			}

			this.data = data;
			this.requestSave();
		} catch (error) {
			if (generation === this.generation && this.ketcher === ketcher) {
				this.showError('Unable to prepare the KET file for saving', error);
			}
		}
	}

	private async saveFromEditor(): Promise<void> {
		const { ketcher } = this;
		const generation = this.generation;

		if (!ketcher || !this.isReady) {
			new Notice('Ketcher is still loading.');
			return;
		}

		try {
			const data = await ketcher.getKet();

			if (generation !== this.generation || this.ketcher !== ketcher) {
				return;
			}

			this.data = data;
			await this.save();
			new Notice('Your structures and reactions have been saved.');
		} catch (error) {
			if (generation === this.generation) {
				this.showError('Unable to save the KET file', error);
			}
		}
	}

	private unsubscribeFromChanges(): void {
		if (this.ketcher && this.changeSubscriber !== undefined) {
			this.ketcher.editor.unsubscribe('change', this.changeSubscriber);
		}

		this.changeSubscriber = undefined;
	}

	private showError(action: string, error: unknown): void {
		new Notice(`${action}: ${getErrorMessage(error)}`);
	}
}
