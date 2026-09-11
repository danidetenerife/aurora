import { AuroraPluginAPI } from './index.js';

describe('AuroraPluginAPI', () => {
  it('should create an instance', () => {
    const api = new AuroraPluginAPI();
    expect(api).toBeInstanceOf(AuroraPluginAPI);
  });
});
