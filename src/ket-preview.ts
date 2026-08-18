import {
	KetSerializer,
	provideEditorInstance,
	RenderStruct,
} from 'ketcher-core';
import type { Struct } from 'ketcher-core';
import { Component as ObsidianComponent } from 'obsidian';

const MAX_CACHE_ENTRIES = 50;
const MIN_PREVIEW_HEIGHT_PX = 120;
const MIN_PREVIEW_WIDTH_PX = 160;
const PREVIEW_BOND_LENGTH_PX = 40;
const PREVIEW_PADDING_PX = 20;
const PREVIEW_RENDER_EVENT_WINDOW_MS = 1_000;
const RENDER_COMPLETE_EVENT = 'renderComplete';
const BASE_RENDER_OPTIONS = {
	microModeScale: PREVIEW_BOND_LENGTH_PX,
	needCache: false,
	rescaleAmount: 1,
	viewOnlyMode: true,
};

const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg';

interface CoordinateBounds {
	max: { x: number; y: number };
	min: { x: number; y: number };
}

function calculatePreviewDimension(extent: number, minimum: number): number {
	const finiteExtent = Number.isFinite(extent) ? Math.max(0, extent) : 0;
	return Math.max(
		minimum,
		Math.ceil(
			finiteExtent * PREVIEW_BOND_LENGTH_PX + PREVIEW_PADDING_PX * 2,
		),
	);
}

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
		const { height, width } = this.getCanvasSize(struct);
		const ketcherWindow = window as Window & {
			isPolymerEditorTurnedOn?: boolean;
		};
		const previousMode = ketcherWindow.isPolymerEditorTurnedOn;
		containerEl.style.width = `${width}px`;

		this.previewRenderCompleteUntil = Math.max(
			this.previewRenderCompleteUntil,
			window.performance.now() + PREVIEW_RENDER_EVENT_WINDOW_MS,
		);
		ketcherWindow.isPolymerEditorTurnedOn = false;
		try {
			ignoreInvalidTspanDy(() => {
				RenderStruct.render(containerEl, struct, {
					...BASE_RENDER_OPTIONS,
					height,
					width,
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

	private getCanvasSize(struct: Struct): { height: number; width: number } {
		const normalizedStruct = RenderStruct.prepareStruct(struct.clone());
		normalizedStruct.rescale();
		const bounds = normalizedStruct.getCoordBoundingBox() as CoordinateBounds;
		const structureWidth = Math.max(0, bounds.max.x - bounds.min.x);
		const structureHeight = Math.max(0, bounds.max.y - bounds.min.y);

		return {
			height: calculatePreviewDimension(
				structureHeight,
				MIN_PREVIEW_HEIGHT_PX,
			),
			width: calculatePreviewDimension(
				structureWidth,
				MIN_PREVIEW_WIDTH_PX,
			),
		};
	}

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
			});
			const renderEl = previewEl.createDiv({
				cls: 'ketcher-struct-render',
			});
			this.renderer.renderInto(renderEl, struct);
			this.addAccessibleSvgTitle(renderEl);
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

	private addAccessibleSvgTitle(renderEl: HTMLElement): void {
		const svg = renderEl.querySelector('svg');
		if (!svg) {
			return;
		}

		const title = document.createElementNS(SVG_NAMESPACE_URI, 'title');
		title.textContent = this.alt;
		svg.prepend(title);
		svg.setAttribute('role', 'img');
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
