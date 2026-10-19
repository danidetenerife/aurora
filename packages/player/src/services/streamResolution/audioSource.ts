import { invoke } from '@tauri-apps/api/core';

import { AudioSource } from '@aurora/hifi';
import type { StreamCandidate } from '@aurora/model';

export class AudioSourceFactory {
  private cachedStreamServerPort: number | null = null;

  async fromCandidate(candidate: StreamCandidate): Promise<AudioSource> {
    const { stream } = candidate;
    if (!stream) {
      return { url: candidate.id, protocol: 'http' };
    }

    const isHls =
      stream.protocol === 'hls' ||
      stream.url.includes('.m3u8') ||
      stream.url.includes('manifest.googlevideo.com');

    const shouldSkipProxy =
      stream.protocol === 'file' || stream.url.startsWith('http://127.0.0.1:');
    const port = shouldSkipProxy ? null : await this.streamServerPort();
    const playbackUrl = port ? this.proxiedUrl(stream.url, port) : stream.url;

    const durationMs = stream.durationMs ?? candidate.durationMs;
    return {
      url: playbackUrl,
      protocol: isHls ? 'hls' : stream.protocol,
      durationSeconds: durationMs ? durationMs / 1000 : undefined,
      ...(stream.codec ? { codec: stream.codec } : {}),
    };
  }

  private async streamServerPort(): Promise<number | null> {
    if (this.cachedStreamServerPort === null) {
      try {
        this.cachedStreamServerPort =
          await invoke<number>('stream_server_port');
      } catch {
        return null;
      }
    }
    return this.cachedStreamServerPort;
  }

  // Encode the URL in base64 and proxy through the local streaming server to bypass CORS
  // Check packages/player/src-tauri/src/stream_server.rs to see how this works
  private proxiedUrl(url: string, port: number): string {
    const utf8Bytes = new TextEncoder().encode(url);
    const binaryString = Array.from(utf8Bytes, (byte) =>
      String.fromCharCode(byte),
    ).join('');
    const encoded = btoa(binaryString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `http://127.0.0.1:${port}/stream/${encoded}`;
  }
}
