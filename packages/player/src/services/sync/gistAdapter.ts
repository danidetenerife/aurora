import type { GistConfig, SyncAdapter, SyncPayload } from './types';

const GITHUB_API_URL = 'https://api.github.com';
const GIST_FILENAME = 'aurora_sync.json';

type GitHubGistResponse = {
  id: string;
  files: Record<
    string,
    { content?: string; raw_url?: string; filename?: string }
  >;
};

export class GistAdapter implements SyncAdapter {
  private config: GistConfig;
  private onGistIdResolved?: (gistId: string) => void;

  constructor(config: GistConfig, onGistIdResolved?: (gistId: string) => void) {
    this.config = config;
    this.onGistIdResolved = onGistIdResolved;
  }

  private getHeaders(): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.config.token.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${GITHUB_API_URL}/user`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        return { success: true };
      }

      if (response.status === 401) {
        return { success: false, error: 'Token de GitHub inválido o expirado' };
      }

      return {
        success: false,
        error: `GitHub API error: ${response.statusText}`,
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
    let activeGistId = this.config.gistId;
    if (!activeGistId) {
      activeGistId = (await this.findExistingGist()) ?? undefined;
    }

    if (!activeGistId) {
      return null;
    }

    try {
      const response = await fetch(`${GITHUB_API_URL}/gists/${activeGistId}`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(8000),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const gistData = (await response.json()) as GitHubGistResponse;
      const fileData = gistData.files?.[GIST_FILENAME];
      if (!fileData?.content) {
        return null;
      }

      return JSON.parse(fileData.content) as SyncPayload;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async pushRemote(payload: SyncPayload): Promise<boolean> {
    let activeGistId = this.config.gistId;
    if (!activeGistId) {
      activeGistId = (await this.findExistingGist()) ?? undefined;
    }

    const fileContent = JSON.stringify(payload, null, 2);

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
