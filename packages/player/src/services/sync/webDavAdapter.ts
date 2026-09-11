import type { SyncAdapter, SyncPayload, WebDavConfig } from './types';

const DEFAULT_SYNC_FILENAME = 'aurora_sync.json';

const buildAuthHeader = (username: string, password: string): string => {
  const token = btoa(`${username}:${password}`);
  return `Basic ${token}`;
};

const resolveFileUrl = (baseUrl: string, remotePath?: string): string => {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  const targetPath = (remotePath?.trim() || DEFAULT_SYNC_FILENAME).replace(
    /^\/+/,
    '',
  );
  return `${normalizedBase}/${targetPath}`;
};

export class WebDavAdapter implements SyncAdapter {
  private config: WebDavConfig;

  constructor(config: WebDavConfig) {
    this.config = config;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: buildAuthHeader(
        this.config.username,
        this.config.password,
      ),
      'Content-Type': 'application/json',
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const fileUrl = resolveFileUrl(this.config.url, this.config.remotePath);
      const headers = {
        Authorization: buildAuthHeader(
          this.config.username,
          this.config.password,
        ),
      };

      const response = await fetch(fileUrl, {
        method: 'HEAD',
        headers,
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok || response.status === 404 || response.status === 207) {
        return { success: true };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: 'Credenciales inválidas (usuario o contraseña errónea)',
        };
      }

      const fallbackResponse = await fetch(this.config.url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(6000),
      });

      if (fallbackResponse.ok || fallbackResponse.status === 207) {
        return { success: true };
      }

      if (fallbackResponse.status === 401 || fallbackResponse.status === 403) {
        return {
          success: false,
          error: 'Credenciales inválidas (usuario o contraseña errónea)',
        };
      }

      return {
        success: false,
        error: `Error del servidor WebDAV (código HTTP ${fallbackResponse.status})`,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo conectar al servidor WebDAV',
      };
    }
  }

  async fetchRemote(): Promise<SyncPayload | null> {
    const fileUrl = resolveFileUrl(this.config.url, this.config.remotePath);
    try {
      const response = await fetch(fileUrl, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as SyncPayload;
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async pushRemote(payload: SyncPayload): Promise<boolean> {
    const fileUrl = resolveFileUrl(this.config.url, this.config.remotePath);
    try {
      const response = await fetch(fileUrl, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(payload, null, 2),
        signal: AbortSignal.timeout(12000),
      });

      return response.ok || response.status === 201 || response.status === 204;
    } catch {
      return false;
    }
  }
}
