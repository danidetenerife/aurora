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
});
