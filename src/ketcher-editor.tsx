import type { Ketcher } from 'ketcher-core';
import { Editor } from 'ketcher-react';
import { StandaloneStructServiceProvider } from 'ketcher-standalone';

const structServiceProvider = new StandaloneStructServiceProvider();

interface KetcherEditorProps {
	onError: (message: string) => void;
	onInit: (ketcher: Ketcher) => void;
}

export function KetcherEditor({
	onError,
	onInit,
}: KetcherEditorProps) {
	return (
		<div className="ketcher-container">
			<Editor
				errorHandler={onError}
				onInit={onInit}
				staticResourcesUrl="./"
				structServiceProvider={structServiceProvider}
			/>
		</div>
	);
}
