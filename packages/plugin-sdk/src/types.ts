import type { AuroraPluginAPI } from './api';

export type PluginIcon = { type: 'link'; link: string };

export type PluginManifest = {
  name: string;
  version: string;
  description: string;
  author: string;
  main?: string;
  aurora?: {
    displayName?: string;
    category?: string;
    categories?: string[];
    icon?: PluginIcon;
    permissions?: string[];
  };
  nuclear?: {
    displayName?: string;
    category?: string;
    categories?: string[];
    icon?: PluginIcon;
    permissions?: string[];
  };
};

export type AuroraPlugin = {
  onLoad?(api: AuroraPluginAPI): void | Promise<void>;
  onUnload?(api: AuroraPluginAPI): void | Promise<void>;
  onEnable?(api: AuroraPluginAPI): void | Promise<void>;
  onDisable?(api: AuroraPluginAPI): void | Promise<void>;
};

export type NuclearPlugin = AuroraPlugin;

export type PluginMetadata = {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  category?: string;
  categories: string[];
  icon?: PluginIcon;
  permissions: string[];
};

export type LoadedPlugin = {
  metadata: PluginMetadata;
  instance: AuroraPlugin;
  path: string;
};
