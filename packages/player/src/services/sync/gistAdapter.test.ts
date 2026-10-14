import { GistAdapter } from './gistAdapter';

describe('GistAdapter', () => {
  const config = {
    token: 'ghp_test_token_123',
    gistId: 'gist_abc_123',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('verifies token via GitHub user endpoint', async () => {
    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      expect(url).toBe('https://api.github.com/user');
      expect(options?.headers).toHaveProperty(
        'Authorization',
        'Bearer ghp_test_token_123',
      );
      return Response.json({ login: 'octocat' });
    });

    const adapter = new GistAdapter(config);
    const result = await adapter.testConnection();
    expect(result.success).toBe(true);
  });

  it('fetches existing gist content', async () => {
    const payload = { timestamp: 12345, playlists: [] };
    vi.stubGlobal('fetch', async (url: string) => {
      expect(url).toBe('https://api.github.com/gists/gist_abc_123');
      return Response.json({
        id: 'gist_abc_123',
        files: {
          'aurora_sync.json': {
            content: JSON.stringify(payload),
          },
        },
      });
    });

    const adapter = new GistAdapter(config);
    const data = await adapter.fetchRemote();
    expect(data).toEqual(payload);
  });

  it('updates existing gist on pushRemote', async () => {
    let patchedBody = '';
    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      expect(url).toBe('https://api.github.com/gists/gist_abc_123');
      expect(options?.method).toBe('PATCH');
      patchedBody = options?.body as string;
      return Response.json({ id: 'gist_abc_123' });
    });

    const adapter = new GistAdapter(config);
    const success = await adapter.pushRemote({ timestamp: 8888 });
    expect(success).toBe(true);
    expect(JSON.parse(patchedBody).files['aurora_sync.json'].content).toContain(
      '8888',
    );
  });

  it('creates new gist if gistId is empty', async () => {
    let createdBody = '';
    let savedGistId = '';
    const adapter = new GistAdapter({ token: 'ghp_test' }, (newId) => {
      savedGistId = newId;
    });

    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      if (url.includes('per_page=50')) {
        return Response.json([]);
      }
      expect(url).toBe('https://api.github.com/gists');
      expect(options?.method).toBe('POST');
      createdBody = options?.body as string;
      return Response.json({ id: 'newly_created_gist_id' });
    });

    const success = await adapter.pushRemote({ timestamp: 7777 });
    expect(success).toBe(true);
    expect(savedGistId).toBe('newly_created_gist_id');
    expect(JSON.parse(createdBody).public).toBe(false);
  });

  it('falls back to unauthenticated GET and auto-refreshes expired token via tokenHandover', async () => {
    const { encryptTokenHandover } = await import('./gistAdapter');
    const oldToken = 'ghp_expired_token_12345678901234567890';
    const newToken = 'gho_fresh_token_9876543210987654321098';
    const handover = encryptTokenHandover(oldToken, newToken);
    const payload = {
      timestamp: 99999,
      playlists: [],
      tokenHandover: handover,
    };

    let refreshedToken = '';
    const calls: Array<{ url: string; auth?: string }> = [];

    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      const headers = (options?.headers ?? {}) as Record<string, string>;
      calls.push({ url, auth: headers.Authorization });

      if (headers.Authorization === `Bearer ${oldToken}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      if (url === 'https://api.github.com/gists/gist_abc_123') {
        return Response.json({
          id: 'gist_abc_123',
          files: {
            'aurora_sync.json': {
              content: JSON.stringify(payload),
            },
          },
        });
      }
      if (
        url === 'https://api.github.com/user' &&
        headers.Authorization === `Bearer ${newToken}`
      ) {
        return Response.json({ login: 'danidetenerife' });
      }
      return new Response('Not found', { status: 404 });
    });

    const adapter = new GistAdapter(
      { token: oldToken, gistId: 'gist_abc_123' },
      undefined,
      (token) => {
        refreshedToken = token;
      },
    );

    const connResult = await adapter.testConnection();
    expect(connResult.success).toBe(true);
    expect(refreshedToken).toBe(newToken);
    expect(calls.some((call) => call.auth === undefined)).toBe(true);
  });
});
