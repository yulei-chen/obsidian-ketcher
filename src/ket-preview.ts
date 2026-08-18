import {
	KetSerializer,
	provideEditorInstance,
	RenderStruct,
} from 'ketcher-core';
import type { Struct } from 'ketcher-core';
import { Component as ObsidianComponent } from 'obsidian';

const MAX_CACHE_ENTRIES = 50;
const PREVIEW_RENDER_EVENT_WINDOW_MS = 1_000;
const RENDER_COMPLETE_EVENT = 'renderComplete';
const BASE_RENDER_OPTIONS = {
	needCache: false,
	viewOnlyMode: true,
};

function ignoreInvalidTspanDy(callback: () => void): void {
	// Intentionally call the native method with each SVG element as `this`.
	// eslint-disable-next-line @typescript-eslint/unbound-method -- Rebind the native method to each SVG element below.
	const originalSetAttribute = SVGElement.prototype.setAttribute;
	const setAttributeWithoutInvalidDy = function (
		this: SVGElement,
		qualifiedName: string,
		value: string,
	): void {
		if (
			this.tagName.toLowerCase() === 'tspan' &&
			qualifiedName.toLowerCase() === 'dy' &&
			String(value).trim().toLowerCase() === 'nan'
		) {
			return;
		}

		originalSetAttribute.call(this, qualifiedName, value);
	};

	SVGElement.prototype.setAttribute = setAttributeWithoutInvalidDy;
	try {
		callback();
	} finally {
		if (SVGElement.prototype.setAttribute === setAttributeWithoutInvalidDy) {
			SVGElement.prototype.setAttribute = originalSetAttribute;
		}
	}
}

export class KetPreviewRenderer {
	private readonly cache = new Map<string, Struct>();
	private readonly serializer = new KetSerializer();
	private previewRenderCompleteUntil = 0;

	constructor() {
		window.addEventListener(
			RENDER_COMPLETE_EVENT,
			this.handleRenderComplete,
			true,
		);
	}

	render(data: string): Struct {
		const cached = this.cache.get(data);
		if (cached) {
			return cached;
		}

		const struct = this.serializer.deserializeMicromolecules(data);
		this.cache.set(data, struct);
		this.trimCache();
		return struct;
	}

	renderInto(containerEl: HTMLElement, struct: Struct): void {
		const rect = containerEl.getBoundingClientRect();
		const ketcherWindow = window as Window & {
			isPolymerEditorTurnedOn?: boolean;
		};
		const previousMode = ketcherWindow.isPolymerEditorTurnedOn;

		this.previewRenderCompleteUntil = Math.max(
			this.previewRenderCompleteUntil,
			window.performance.now() + PREVIEW_RENDER_EVENT_WINDOW_MS,
		);
		ketcherWindow.isPolymerEditorTurnedOn = false;
		try {
			ignoreInvalidTspanDy(() => {
				RenderStruct.render(containerEl, struct, {
					...BASE_RENDER_OPTIONS,
					height: Math.max(160, Math.round(rect.height) || 240),
					width: Math.max(280, Math.round(rect.width) || 640),
				});
			});
		} finally {
			ketcherWindow.isPolymerEditorTurnedOn = previousMode;
		}
	}

	destroy(): void {
		window.removeEventListener(
			RENDER_COMPLETE_EVENT,
			this.handleRenderComplete,
			true,
		);
		this.cache.clear();
	}

	private readonly handleRenderComplete = (event: Event): void => {
		if (
			window.performance.now() <= this.previewRenderCompleteUntil &&
			!provideEditorInstance()
		) {
			event.stopImmediatePropagation();
		}
	};

	private trimCache(): void {
		while (this.cache.size > MAX_CACHE_ENTRIES) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey === undefined) {
				return;
			}
			this.cache.delete(oldestKey);
		}
	}
}

export class KetPreviewComponent extends ObsidianComponent {
	constructor(
		private readonly containerEl: HTMLElement,
		private readonly renderer: KetPreviewRenderer,
		private readonly alt: string,
	) {
		super();
	}

	onunload(): void {
		this.containerEl.empty();
	}

	setData(data: string): void {
		this.containerEl.empty();

		if (!data.trim()) {
			this.renderEmpty();
			return;
		}

		try {
			const struct = this.renderer.render(data);
			if (struct.isBlank()) {
				this.renderEmpty();
				return;
			}

			const previewEl = this.containerEl.createDiv({
				cls: 'ketcher-preview-svg',
				attr: { 'aria-label': this.alt, role: 'img' },
			});
			const renderEl = previewEl.createDiv({
				cls: 'ketcher-struct-render',
			});
			this.renderer.renderInto(renderEl, struct);
		} catch (error) {
			this.renderError(error);
		}
	}

	setError(message: string): void {
		this.containerEl.empty();
		this.containerEl.createDiv({
			cls: 'ketcher-preview-message is-error',
			text: message,
		});
	}

	private renderEmpty(): void {
		this.containerEl.createDiv({
			cls: 'ketcher-preview-message',
			text: 'Empty chemical structure',
		});
	}

	private renderError(error: unknown): void {
		this.containerEl.empty();
		this.containerEl.createDiv({
			cls: 'ketcher-preview-message is-error',
			text:
				error instanceof Error
					? `Unable to render structure: ${error.message}`
					: 'Unable to render chemical structure',
		});
	}
}
