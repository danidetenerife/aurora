import { WebDavAdapter } from './webDavAdapter';

describe('WebDavAdapter', () => {
  const config = {
    url: 'https://cloud.example.com/remote.php/dav/files/user/',
    username: 'testuser',
    password: 'testpassword',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects successfully when HEAD returns 200 or 404', async () => {
    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      expect(url).toBe(
        'https://cloud.example.com/remote.php/dav/files/user/aurora_sync.json',
      );
      expect(options?.method).toBe('HEAD');
      expect(options?.headers).toHaveProperty(
        'Authorization',
        'Basic dGVzdHVzZXI6dGVzdHBhc3N3b3Jk',
      );
      return new Response(null, { status: 404 });
    });

    const adapter = new WebDavAdapter(config);
    const result = await adapter.testConnection();
    expect(result.success).toBe(true);
  });

  it('reports invalid credentials when receiving 401', async () => {
    vi.stubGlobal('fetch', async () => {
      return new Response(null, { status: 401 });
    });

    const adapter = new WebDavAdapter(config);
    const result = await adapter.testConnection();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Credenciales');
  });

  it('fetches remote JSON payload correctly', async () => {
    const mockPayload = {
      timestamp: 123456789,
      favorites: { tracks: [] },
    };

    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      expect(options?.method).toBe('GET');
      return Response.json(mockPayload);
    });

    const adapter = new WebDavAdapter(config);
    const data = await adapter.fetchRemote();
    expect(data).toEqual(mockPayload);
  });

  it('pushes payload using PUT', async () => {
    let receivedBody = '';
    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      expect(options?.method).toBe('PUT');
      receivedBody = options?.body as string;
      return new Response(null, { status: 204 });
    });

    const adapter = new WebDavAdapter(config);
    const success = await adapter.pushRemote({
      timestamp: 9999,
      favorites: {},
    });

    expect(success).toBe(true);
    expect(JSON.parse(receivedBody).timestamp).toBe(9999);
  });
});
