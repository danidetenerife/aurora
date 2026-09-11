import type { AuroraPlugin } from '@aurora/plugin-sdk';

export class AuroraPluginBuilder {
  private plugin: AuroraPlugin = {};

  withOnLoad(onLoad: AuroraPlugin['onLoad']): AuroraPluginBuilder {
    this.plugin.onLoad = onLoad;
    return this;
  }

  withOnEnable(onEnable: AuroraPlugin['onEnable']): AuroraPluginBuilder {
    this.plugin.onEnable = onEnable;
    return this;
  }

  withOnDisable(onDisable: AuroraPlugin['onDisable']): AuroraPluginBuilder {
    this.plugin.onDisable = onDisable;
    return this;
  }

  withOnUnload(onUnload: AuroraPlugin['onUnload']): AuroraPluginBuilder {
    this.plugin.onUnload = onUnload;
    return this;
  }

  build(): AuroraPlugin {
    return { ...this.plugin };
  }
}
