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
  try {
    const saved = localStorage.getItem(STORAGE_KEY_AUTO_CAR_MODE);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
};

const isNativeCarEnvironment = (): boolean => {
  try {
    if (typeof window === 'undefined') {
      return false;
    }
    return (
      (window as unknown as { AndroidCar?: unknown }).AndroidCar !==
        undefined ||
      (window as unknown as { __AURORA_CAR_MODE__?: boolean })
        .__AURORA_CAR_MODE__ === true ||
      localStorage.getItem('aurora:car_mode') === 'true'
    );
  } catch {
    return false;
  }
};

export const useCarModeStore = create<CarModeState>((set) => ({
  isCarMode: isNativeCarEnvironment(),
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

  if (isNativeCarEnvironment()) {
    useCarModeStore.setState({ isCarMode: true, enteredViaBluetooth: false });
  }

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
      if (
        useCarModeStore.getState().autoCarModeEnabled &&
        !useCarModeStore.getState().isCarMode
      ) {
        useCarModeStore.setState({
          isCarMode: true,
          enteredViaBluetooth: true,
        });
      }
    }

    await NativeMediaSessionPlugin.addListener(
      'bluetoothStateChanged',
      (data: BluetoothStateData) => {
        const { isConnected, deviceName } = data;
        useCarModeStore.setState({
          isBluetoothConnected: isConnected,
          bluetoothDeviceName: deviceName || (isConnected ? 'Bluetooth' : ''),
        });

        if (isConnected) {
          if (
            useCarModeStore.getState().autoCarModeEnabled &&
            !useCarModeStore.getState().isCarMode
          ) {
            useCarModeStore.setState({
              isCarMode: true,
              enteredViaBluetooth: true,
            });
          }
        } else {
          const state = useCarModeStore.getState();
          if (
            state.isCarMode &&
            state.enteredViaBluetooth &&
            !isNativeCarEnvironment()
          ) {
            state.exitCarMode();
          }
        }
      },
    );
  } catch (error) {
    console.warn('Failed to initialize Car Mode Bluetooth listener:', error);
  }
};
