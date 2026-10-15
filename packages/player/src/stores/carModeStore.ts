import { create } from 'zustand';

import {
  NativeMediaSessionPlugin,
  type BluetoothStateData,
} from '../services/nativeMediaSession';
import { isCapacitorEnvironment } from '../services/universalStore';

const STORAGE_KEY_AUTO_CAR_MODE = 'aurora_auto_car_mode_enabled';

type CarModeState = {
  isCarMode: boolean;
  enteredViaBluetooth: boolean;
  autoCarModeEnabled: boolean;
  isBluetoothConnected: boolean;
  bluetoothDeviceName: string;
  enterCarMode: () => void;
  exitCarMode: () => void;
  toggleCarMode: () => void;
  setAutoCarModeEnabled: (enabled: boolean) => void;
};

const getInitialAutoCarMode = (): boolean => {
  return false;
};

export const useCarModeStore = create<CarModeState>((set) => ({
  isCarMode: false,
  enteredViaBluetooth: false,
  autoCarModeEnabled: getInitialAutoCarMode(),
  isBluetoothConnected: false,
  bluetoothDeviceName: '',

  enterCarMode: () => {
    set({ isCarMode: true, enteredViaBluetooth: false });
  },

  exitCarMode: () => {
    set({ isCarMode: false, enteredViaBluetooth: false });
  },

  toggleCarMode: () => {
    set((state) => ({
      isCarMode: !state.isCarMode,
      enteredViaBluetooth: false,
    }));
  },

  setAutoCarModeEnabled: (enabled: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_CAR_MODE, String(enabled));
    } catch {
      // ignore
    }
    set({ autoCarModeEnabled: enabled });
  },
}));

let isInitialized = false;

export const initCarModeService = async (): Promise<void> => {
  if (isInitialized) {
    return;
  }
  isInitialized = true;

  if (!isCapacitorEnvironment()) {
    return;
  }

  try {
    const initialStatus = await NativeMediaSessionPlugin.isBluetoothConnected();
    if (initialStatus?.isConnected) {
      useCarModeStore.setState({
        isBluetoothConnected: true,
        bluetoothDeviceName: initialStatus.deviceName || 'Bluetooth',
      });
    }

    await NativeMediaSessionPlugin.addListener(
      'bluetoothStateChanged',
      (data: BluetoothStateData) => {
        const { isConnected, deviceName } = data;
        useCarModeStore.setState({
          isBluetoothConnected: isConnected,
          bluetoothDeviceName: deviceName || (isConnected ? 'Bluetooth' : ''),
        });
      },
    );
  } catch (error) {
    console.warn('Failed to initialize Bluetooth listener:', error);
  }
};
