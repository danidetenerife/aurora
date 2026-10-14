import type { GistConfig, SyncAdapter, SyncPayload } from './types';

const GITHUB_API_URL = 'https://api.github.com';
const GIST_FILENAME = 'aurora_sync.json';
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MASK_MULTIPLIER = 31;
const MASK_OFFSET = 17;
const BYTE_MASK = 0xff;
const HEX_RADIX = 16;
const HASH_HEX_LENGTH = 8;

type GitHubGistResponse = {
  id: string;
  files: Record<
    string,
    {
      content?: string;
      raw_url?: string;
      filename?: string;
      truncated?: boolean;
    }
  >;
};

export function hashTokenKey(token: string): string {
  const clean = token.trim();
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < clean.length; index++) {
    hash ^= clean.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(HEX_RADIX).padStart(HASH_HEX_LENGTH, '0');
}

export function encryptTokenHandover(
  oldToken: string,
  newToken: string,
): { keyHash: string; cipher: string } {
  const keyBytes = new TextEncoder().encode(oldToken.trim());
  const plainBytes = new TextEncoder().encode(newToken.trim());
  const out = new Uint8Array(plainBytes.length);
  for (let index = 0; index < plainBytes.length; index++) {
    const keyByte = keyBytes[index % keyBytes.length] ?? 0;
    const mask =
      ((index * MASK_MULTIPLIER + MASK_OFFSET) & BYTE_MASK) ^ keyByte;
    out[index] = (plainBytes[index] ?? 0) ^ mask;
  }
  const binary = Array.from(out, (byte) => String.fromCharCode(byte)).join('');
  return {
    keyHash: hashTokenKey(oldToken),
    cipher: btoa(binary),
  };
}

export function decryptTokenHandover(
  oldToken: string,
  handover?: { keyHash: string; cipher: string },
): string | null {
  if (!handover?.keyHash || !handover?.cipher || !oldToken.trim()) {
    return null;
  }
  if (hashTokenKey(oldToken) !== handover.keyHash) {
    return null;
  }
  try {
    const keyBytes = new TextEncoder().encode(oldToken.trim());
    const binary = atob(handover.cipher);
    const cipherBytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const plainBytes = new Uint8Array(cipherBytes.length);
    for (let index = 0; index < cipherBytes.length; index++) {
      const keyByte = keyBytes[index % keyBytes.length] ?? 0;
      const mask =
        ((index * MASK_MULTIPLIER + MASK_OFFSET) & BYTE_MASK) ^ keyByte;
      plainBytes[index] = (cipherBytes[index] ?? 0) ^ mask;
    }
    const candidate = new TextDecoder().decode(plainBytes).trim();
    if (
      candidate.startsWith('gho_') ||
      candidate.startsWith('ghp_') ||
      candidate.startsWith('github_pat_')
    ) {
      return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

export class GistAdapter implements SyncAdapter {
  private config: GistConfig;
  private onGistIdResolved?: (gistId: string) => void;
  private onTokenRefreshed?: (newToken: string) => void | Promise<void>;
  private lastFetchedHandover?: { keyHash: string; cipher: string };

  constructor(
    config: GistConfig,
    onGistIdResolved?: (gistId: string) => void,
    onTokenRefreshed?: (newToken: string) => void | Promise<void>,
  ) {
    this.config = { ...config };
    this.onGistIdResolved = onGistIdResolved;
    this.onTokenRefreshed = onTokenRefreshed;
  }

  private getPublicHeaders(): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  }

  private getHeaders(): Record<string, string> {
    const base = this.getPublicHeaders();
    const trimmed = this.config.token.trim();
    if (trimmed) {
      base.Authorization = `Bearer ${trimmed}`;
    }
    return base;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      let response = await fetch(`${GITHUB_API_URL}/user`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
      });

      if (response.status === 401 && this.config.gistId) {
        const prevToken = this.config.token;
        try {
          await this.fetchRemote();
        } catch {
          // ignore
        }
        if (this.config.token !== prevToken) {
          response = await fetch(`${GITHUB_API_URL}/user`, {
            method: 'GET',
            headers: this.getHeaders(),
            signal: AbortSignal.timeout(6000),
          });
        }
      }

      if (response.ok) {
        return { success: true };
      }

      if (response.status === 401) {
        return { success: false, error: 'Token de GitHub inválido o expirado' };
      }

      return {
        success: false,
        error: `GitHub API error: ${response.statusText || response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo conectar a GitHub',
      };
    }
  }

  private async findExistingGist(): Promise<string | null> {
    try {
      const response = await fetch(`${GITHUB_API_URL}/gists?per_page=50`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return null;
      }

      const gists = (await response.json()) as GitHubGistResponse[];
      const match = gists.find(
        (gist) => gist.files && GIST_FILENAME in gist.files,
      );
      if (match) {
        this.config.gistId = match.id;
        this.onGistIdResolved?.(match.id);
        return match.id;
      }

      return null;
    } catch {
      return null;
    }
  }

  async fetchRemote(): Promise<SyncPayload | null> {
    let activeGistId = this.config.gistId?.trim();
    if (!activeGistId) {
      activeGistId = (await this.findExistingGist()) ?? undefined;
    }

    if (!activeGistId) {
      return null;
    }

    try {
      let response = await fetch(`${GITHUB_API_URL}/gists/${activeGistId}`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(8000),
      });

      if (response.status === 401) {
        response = await fetch(`${GITHUB_API_URL}/gists/${activeGistId}`, {
          method: 'GET',
          headers: this.getPublicHeaders(),
          signal: AbortSignal.timeout(8000),
        });
      }

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Token de GitHub inválido o expirado (HTTP 401)');
        }
        throw new Error(
          `HTTP ${response.status}: ${response.statusText || 'Error'}`,
        );
      }

      const gistData = (await response.json()) as GitHubGistResponse;
      const fileData = gistData.files?.[GIST_FILENAME];
      if (!fileData) {
        return null;
      }

      let rawContent = fileData.content;
      if ((fileData.truncated || !rawContent) && fileData.raw_url) {
        const rawResp = await fetch(fileData.raw_url, {
          signal: AbortSignal.timeout(8000),
        });
        if (rawResp.ok) {
          rawContent = await rawResp.text();
        }
      }

      if (!rawContent) {
        return null;
      }

      const parsed = JSON.parse(rawContent) as SyncPayload;
      if (parsed.tokenHandover) {
        this.lastFetchedHandover = parsed.tokenHandover;
        const recoveredToken = decryptTokenHandover(
          this.config.token,
          parsed.tokenHandover,
        );
        if (recoveredToken && recoveredToken !== this.config.token) {
          this.config.token = recoveredToken;
          await this.onTokenRefreshed?.(recoveredToken);
        }
      }

      return parsed;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async pushRemote(payload: SyncPayload): Promise<boolean> {
    let activeGistId = this.config.gistId?.trim();
    if (!activeGistId) {
      activeGistId = (await this.findExistingGist()) ?? undefined;
    }

    const enrichedPayload: SyncPayload = {
      ...payload,
      ...(payload.tokenHandover || this.lastFetchedHandover
        ? { tokenHandover: payload.tokenHandover ?? this.lastFetchedHandover }
        : {}),
    };
    const fileContent = JSON.stringify(enrichedPayload, null, 2);

    try {
      if (activeGistId) {
        const response = await fetch(
          `${GITHUB_API_URL}/gists/${activeGistId}`,
          {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify({
              description: 'Aurora Music Player Sync Data',
              files: {
                [GIST_FILENAME]: {
                  content: fileContent,
                },
              },
            }),
            signal: AbortSignal.timeout(10000),
          },
        );

        return response.ok;
      }

      const createResponse = await fetch(`${GITHUB_API_URL}/gists`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          description: 'Aurora Music Player Sync Data',
          public: false,
          files: {
            [GIST_FILENAME]: {
              content: fileContent,
            },
          },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (createResponse.ok) {
        const newGist = (await createResponse.json()) as GitHubGistResponse;
        this.config.gistId = newGist.id;
        this.onGistIdResolved?.(newGist.id);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}
