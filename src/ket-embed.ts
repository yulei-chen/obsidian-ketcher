import {
	App,
	Component,
	Keymap,
	MarkdownRenderChild,
	MarkdownView,
	parseLinktext,
	TFile,
} from 'obsidian';
import type {
	HoverParent,
	HoverPopover,
	MarkdownPostProcessorContext,
	Plugin,
} from 'obsidian';
import { getErrorMessage } from './errors';
import {
	KetPreviewComponent,
	KetPreviewRenderer,
} from './ket-preview';

const KET_EXTENSION = 'ket';
const HOVER_SOURCE_ID = 'ketcher';

function resolveKetFile(
	plugin: Plugin,
	linktext: string,
	sourcePath: string,
): TFile | null {
	const { path } = parseLinktext(linktext);
	const file = plugin.app.metadataCache.getFirstLinkpathDest(path, sourcePath);
	return file?.extension.toLowerCase() === KET_EXTENSION ? file : null;
}

class KetEmbedRenderChild extends MarkdownRenderChild {
	private readonly preview: KetPreviewComponent;
	private refreshSequence = 0;

	constructor(
		containerEl: HTMLElement,
		private readonly app: App,
		private readonly file: TFile,
		private readonly sourcePath: string,
		renderer: KetPreviewRenderer,
	) {
		super(containerEl);
		this.preview = new KetPreviewComponent(
			containerEl,
			renderer,
			`Chemical structure from ${file.basename}`,
		);
	}

	onload(): void {
		this.containerEl.empty();
		this.containerEl.addClass('ketcher-embed');
		this.containerEl.setAttribute('role', 'link');
		this.containerEl.setAttribute('tabindex', '0');
		this.containerEl.setAttribute('aria-label', `Open ${this.file.basename}`);
		this.addChild(this.preview);

		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file.path === this.file.path) {
					void this.refresh();
				}
			}),
		);

		this.registerDomEvent(this.containerEl, 'click', (event) => {
			if (event.button !== 0 && event.button !== 1) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			void this.app.workspace.openLinkText(
				this.file.path,
				this.sourcePath,
				Keymap.isModEvent(event),
			);
		});

		this.registerDomEvent(this.containerEl, 'keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') {
				return;
			}

			event.preventDefault();
			void this.app.workspace.openLinkText(
				this.file.path,
				this.sourcePath,
				false,
			);
		});

		void this.refresh();
	}

	onunload(): void {
		this.refreshSequence += 1;
	}

	private async refresh(): Promise<void> {
		const sequence = ++this.refreshSequence;
		try {
			const data = await this.app.vault.cachedRead(this.file);
			if (sequence === this.refreshSequence) {
				this.preview.setData(data);
			}
		} catch (error) {
			if (sequence === this.refreshSequence) {
				this.preview.setError(
					`Unable to read ${this.file.name}: ${getErrorMessage(error)}`,
				);
			}
		}
	}
}

interface LivePreviewEmbed {
	child: KetEmbedRenderChild;
	filePath: string;
}

class KetLivePreviewManager extends Component implements HoverParent {
	hoverPopover: HoverPopover | null = null;
	private readonly embeds = new Map<HTMLElement, LivePreviewEmbed>();
	private observer?: MutationObserver;
	private scanQueued = false;

	constructor(
		private readonly plugin: Plugin,
		private readonly renderer: KetPreviewRenderer,
	) {
		super();
	}

	onload(): void {
		this.observer = new MutationObserver(() => this.queueScan());
		this.observer.observe(document.body, {
			attributes: true,
			attributeFilter: ['src'],
			childList: true,
			subtree: true,
		});

		this.registerDomEvent(
			window,
			'mouseover',
			(event) => this.handleMouseover(event),
			{ capture: true },
		);
		this.queueScan();
	}

	onunload(): void {
		this.observer?.disconnect();
		this.observer = undefined;
		this.hoverPopover?.unload();
		this.hoverPopover = null;
		for (const { child } of this.embeds.values()) {
			this.removeChild(child);
		}
		this.embeds.clear();
	}

	private queueScan(): void {
		if (this.scanQueued) {
			return;
		}

		this.scanQueued = true;
		queueMicrotask(() => {
			this.scanQueued = false;
			this.scan();
		});
	}

	private scan(): void {
		for (const [element, entry] of this.embeds) {
			if (
				!element.isConnected ||
				!element.closest('.markdown-source-view.is-live-preview')
			) {
				this.removeChild(entry.child);
				this.embeds.delete(element);
			}
		}

		document
			.querySelectorAll<HTMLElement>(
				'.markdown-source-view.is-live-preview [src]',
			)
			.forEach((element) => this.processEmbed(element));
	}

	private processEmbed(element: HTMLElement): void {
		const linktext = element.getAttribute('src');
		const sourceFile = this.findSourceFile(element);
		const file =
			linktext && sourceFile
				? resolveKetFile(this.plugin, linktext, sourceFile.path)
				: null;
		const existing = this.embeds.get(element);

		if (!file || !sourceFile) {
			if (existing) {
				this.removeChild(existing.child);
				this.embeds.delete(element);
			}
			return;
		}

		if (existing?.filePath === file.path) {
			return;
		}
		if (existing) {
			this.removeChild(existing.child);
		}

		const child = new KetEmbedRenderChild(
			element,
			this.plugin.app,
			file,
			sourceFile.path,
			this.renderer,
		);
		this.addChild(child);
		this.embeds.set(element, { child, filePath: file.path });
	}

	private handleMouseover(event: MouseEvent): void {
		const link =
			event.target instanceof Element
				? event.target.closest<HTMLElement>(
						'a.internal-link[data-href], .cm-hmd-internal-link',
					)
				: null;
		if (!link) {
			return;
		}

		const sourceFile = this.findSourceFile(link);
		const linktext =
			link.getAttribute('data-href') ?? link.textContent?.trim() ?? null;
		const file =
			sourceFile && linktext
				? resolveKetFile(this.plugin, linktext, sourceFile.path)
				: null;
		if (!file || !sourceFile) {
			return;
		}

		event.stopImmediatePropagation();
		event.stopPropagation();
		this.plugin.app.workspace.trigger('hover-link', {
			event,
			source: HOVER_SOURCE_ID,
			hoverParent: this,
			targetEl: link,
			linktext: file.path,
			sourcePath: sourceFile.path,
		});
	}

	private findSourceFile(element: Element): TFile | null {
		let result: TFile | null = null;
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (
				!result &&
				leaf.view instanceof MarkdownView &&
				leaf.view.containerEl.contains(element)
			) {
				result = leaf.view.file;
			}
		});
		return result;
	}
}

export function registerKetEmbedProcessor(
	plugin: Plugin,
	renderer: KetPreviewRenderer,
): void {
	plugin.registerHoverLinkSource(HOVER_SOURCE_ID, {
		display: 'Ketcher',
		defaultMod: false,
	});
	plugin.addChild(new KetLivePreviewManager(plugin, renderer));
	plugin.registerMarkdownPostProcessor(
		(element: HTMLElement, context: MarkdownPostProcessorContext) => {
			const embeds = element.findAllSelf(
				'[src]:not(.ketcher-embed)',
			);

			embeds.forEach((embed) => {
				const linktext = embed.getAttribute('src');
				if (!linktext) {
					return;
				}

				const file = resolveKetFile(
					plugin,
					linktext,
					context.sourcePath,
				);
				if (!file) {
					return;
				}

				context.addChild(
					new KetEmbedRenderChild(
						embed,
						plugin.app,
						file,
						context.sourcePath,
						renderer,
					),
				);
			});
		},
	);
}
