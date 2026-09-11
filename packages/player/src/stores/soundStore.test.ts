import { useSoundStore } from './soundStore';

describe('call interruptions', () => {
  afterEach(() => {
    useSoundStore.setState({ callActive: false, status: 'stopped', src: null });
  });

  it('pauses immediately and prevents delayed playback from restarting during a call', () => {
    useSoundStore.getState().play();
    useSoundStore.getState().setCallActive(true);
    expect(useSoundStore.getState().status).toBe('paused');
    useSoundStore.getState().setSrc({ url: '/next.mp3', protocol: 'http' });
    useSoundStore.getState().play();
    expect(useSoundStore.getState().status).toBe('paused');
    useSoundStore.getState().setCallActive(false);
    expect(useSoundStore.getState().status).toBe('paused');
    useSoundStore.getState().play();
    expect(useSoundStore.getState().status).toBe('playing');
  });
});
