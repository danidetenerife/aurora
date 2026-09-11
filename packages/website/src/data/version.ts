export const version = '1.48.6';
export const versionTag = `v${version}`;
export const releaseTag = `v${version}`;
export const releaseUrl = (filename: string) =>
  `https://github.com/danidetenerife/aurora/releases/download/${releaseTag}/${filename}`;
