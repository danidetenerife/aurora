/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
	readonly DEV: boolean;
	readonly MODE: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare const process: {
	env: Record<string, string | undefined>;
};