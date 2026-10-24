import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useSettingsStore } from '../stores/settingsStore';
import { resetInMemoryTauriStore } from '../test/utils/inMemoryTauriStore';
import {
  filterSyncableSettings,
  isDeviceSpecificSettingKey,
  p2pSyncService,
} from './p2pSyncService';
import { playbackHost } from './playbackHost';

describe('Volume and Audio Settings Regression Tests', () => {
  beforeEach(() => {
    resetInMemoryTauriStore();
    useSettingsStore.setState({
      definitions: {},
      values: {},
      loaded: true,
    });
  });

  afterEach(() => {
    p2pSyncService.stopBackgroundSyncWatcher();
  });

  describe('Device-specific setting keys isolation', () => {
    it('identifies all forms of volume, mute, shuffle, and repeat as device-specific', () => {
      const deviceSpecificKeys = [
        'core.playback.volume',
        'playback.volume',
        'core.volume',
        'volume',
        'core.playback.muted',
        'playback.muted',
        'core.muted',
        'muted',
        'core.playback.shuffle',
        'playback.shuffle',
        'shuffle',
        'core.playback.repeat',
        'playback.repeat',
        'repeat',
        'plugin.sample.volume',
        'plugin.sample.muted',
      ];

      for (const key of deviceSpecificKeys) {
        expect(isDeviceSpecificSettingKey(key)).toBe(true);
      }
    });

    it('identifies syncable settings as not device-specific', () => {
      const syncableKeys = [
        'core.playback.discovery',
        'core.general.language',
        'plugin.lyrics.fontSize',
      ];

      for (const key of syncableKeys) {
        expect(isDeviceSpecificSettingKey(key)).toBe(false);
      }
    });

    it('strips volume, mute, shuffle, and repeat completely when filtering syncable settings', () => {
      const allSettings = {
        'core.playback.volume': 0.35,
        'playback.volume': 0.35,
        volume: 0.35,
        'core.playback.muted': true,
        'playback.muted': true,
        muted: true,
        'core.playback.shuffle': true,
        'playback.shuffle': true,
        'core.playback.repeat': 'all',
        'playback.repeat': 'all',
        'core.general.language': 'en_US',
      };

      const filtered = filterSyncableSettings(allSettings);

      expect(filtered['core.playback.volume']).toBeUndefined();
      expect(filtered['playback.volume']).toBeUndefined();
      expect(filtered['volume']).toBeUndefined();
      expect(filtered['core.playback.muted']).toBeUndefined();
      expect(filtered['playback.muted']).toBeUndefined();
      expect(filtered['muted']).toBeUndefined();
      expect(filtered['core.playback.shuffle']).toBeUndefined();
      expect(filtered['playback.shuffle']).toBeUndefined();
      expect(filtered['core.playback.repeat']).toBeUndefined();
      expect(filtered['playback.repeat']).toBeUndefined();
      expect(filtered['core.general.language']).toBe('en_US');
    });
  });

  describe('Remote sync payload protection', () => {
    it('never overwrites local desktop volume, shuffle, or repeat when importing a remote backup', async () => {
      useSettingsStore.setState({
        values: {
          'core.playback.volume': 0.72,
          'core.playback.muted': false,
          'core.playback.shuffle': false,
          'core.playback.repeat': 'off',
        },
      });

      const maliciousOrStaleRemotePayload = {
        version: 1,
        timestamp: Date.now(),
        settings: {
          'core.playback.volume': 0.1,
          'playback.volume': 0.1,
          volume: 0.1,
          'core.playback.muted': true,
          'playback.muted': true,
          'core.playback.shuffle': true,
          'playback.shuffle': true,
          'core.playback.repeat': 'all',
          'playback.repeat': 'all',
        },
      };

      await p2pSyncService.importLibraryBackup(
        JSON.stringify(maliciousOrStaleRemotePayload),
      );

      const stateValues = useSettingsStore.getState().values;
      expect(stateValues['core.playback.volume']).toBe(0.72);
      expect(stateValues['core.playback.muted']).toBe(false);
      expect(stateValues['core.playback.shuffle']).toBe(false);
      expect(stateValues['core.playback.repeat']).toBe('off');
    });
  });

  describe('Synchronous store updates', () => {
    it('updates in-memory Zustand values synchronously upon setValue call', async () => {
      expect(
        useSettingsStore.getState().values['core.playback.volume'],
      ).toBeUndefined();

      const promise = useSettingsStore
        .getState()
        .setValue('core.playback.volume', 0.65);

      expect(useSettingsStore.getState().values['core.playback.volume']).toBe(
        0.65,
      );
      expect(useSettingsStore.getState().values['playback.volume']).toBe(0.65);

      await promise;
      expect(useSettingsStore.getState().values['core.playback.volume']).toBe(
        0.65,
      );
    });
  });

  describe('playbackHost volume manipulation safeguards', () => {
    it('clamps volume below zero to zero', async () => {
      await playbackHost.setVolume(-0.5);
      expect(await playbackHost.getVolume()).toBe(0);
    });

    it('clamps volume above one to one', async () => {
      await playbackHost.setVolume(1.5);
      expect(await playbackHost.getVolume()).toBe(1);
    });

    it('falls back to default when passed NaN or non-finite numbers', async () => {
      await playbackHost.setVolume(NaN);
      expect(await playbackHost.getVolume()).toBe(1);

      await playbackHost.setVolume(Infinity);
      expect(await playbackHost.getVolume()).toBe(1);
    });

    it('rounds volume to two decimal places preventing precision drift', async () => {
      await playbackHost.setVolume(0.5500001);
      expect(await playbackHost.getVolume()).toBe(0.55);

      await playbackHost.setVolume(0.123456);
      expect(await playbackHost.getVolume()).toBe(0.12);
    });

    it('toggles muted state without changing stored volume level', async () => {
      await playbackHost.setVolume(0.42);
      await playbackHost.setMuted(true);

      expect(await playbackHost.isMuted()).toBe(true);
      expect(await playbackHost.getVolume()).toBe(0.42);

      await playbackHost.setMuted(false);
      expect(await playbackHost.isMuted()).toBe(false);
      expect(await playbackHost.getVolume()).toBe(0.42);
    });
  });
});
