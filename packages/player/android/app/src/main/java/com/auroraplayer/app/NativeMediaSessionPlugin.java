package com.auroraplayer.app;

import android.bluetooth.BluetoothA2dp;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothHeadset;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeMediaSessionPlugin")
public class NativeMediaSessionPlugin extends Plugin {
    private static final String TAG = "NativeMediaSessionPlugin";

    private static NativeMediaSessionPlugin instance;
    private static String pendingAction = null;
    private static long pendingPosition = -1;
    private AudioManager audioManager;
    private AudioDeviceCallback audioDeviceCallback;
    private BroadcastReceiver bluetoothReceiver;
    private boolean lastBluetoothConnected = false;
    private String lastDeviceName = "";

    @Override
    public void load() {
        instance = this;
        setupBluetoothMonitoring();
        flushPendingMediaAction();
    }

    public static NativeMediaSessionPlugin getInstance() {
        return instance;
    }

    private void setupBluetoothMonitoring() {
        try {
            audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && audioManager != null) {
                audioDeviceCallback = new AudioDeviceCallback() {
                    @Override
                    public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                        checkAndNotifyBluetoothState();
                    }

                    @Override
                    public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                        checkAndNotifyBluetoothState();
                    }
                };
                audioManager.registerAudioDeviceCallback(audioDeviceCallback, null);
            }

            bluetoothReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    String action = intent.getAction();
                    if (BluetoothDevice.ACTION_ACL_CONNECTED.equals(action)
                            || BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action)
                            || BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED.equals(action)
                            || AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(action)) {
                        checkAndNotifyBluetoothState();
                        if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(action)) {
                            notifyMediaAction("pause", -1);
                        }
                    }
                }
            };

            IntentFilter filter = new IntentFilter();
            filter.addAction(BluetoothDevice.ACTION_ACL_CONNECTED);
            filter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);
            filter.addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED);
            filter.addAction(AudioManager.ACTION_AUDIO_BECOMING_NOISY);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(bluetoothReceiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                getContext().registerReceiver(bluetoothReceiver, filter);
            }

            checkAndNotifyBluetoothState();
        } catch (Throwable t) {
            // Ignore if bluetooth permissions or callbacks are not available
        }
    }

    private synchronized void checkAndNotifyBluetoothState() {
        boolean isConnected = isBluetoothAudioConnected();
        String deviceName = isConnected ? (lastDeviceName.isEmpty() ? "Bluetooth Audio" : lastDeviceName) : "";

        if (isConnected != lastBluetoothConnected || !deviceName.equals(lastDeviceName)) {
            lastBluetoothConnected = isConnected;
            lastDeviceName = deviceName;

            JSObject data = new JSObject();
            data.put("isConnected", isConnected);
            data.put("deviceName", deviceName);
            notifyListeners("bluetoothStateChanged", data, true);
        }
    }

    private boolean isBluetoothAudioConnected() {
        if (audioManager == null) {
            try {
                audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            } catch (Throwable t) {
                return false;
            }
        }
        if (audioManager == null) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
                for (AudioDeviceInfo device : devices) {
                    int type = device.getType();
                    if (type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
                            || type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
                            || type == 26 /* TYPE_BLUETOOTH_LE */
                            || type == AudioDeviceInfo.TYPE_DOCK
                            || type == AudioDeviceInfo.TYPE_USB_HEADSET) {
                        CharSequence name = device.getProductName();
                        if (name != null && name.length() > 0) {
                            lastDeviceName = name.toString();
                        }
                        return true;
                    }
                }
            } catch (Throwable t) {
                // fallback
            }
        }

        try {
            return audioManager.isBluetoothA2dpOn() || audioManager.isBluetoothScoOn();
        } catch (Throwable t) {
            return false;
        }
    }

    @PluginMethod
    public void isBluetoothConnected(PluginCall call) {
        boolean connected = isBluetoothAudioConnected();
        JSObject result = new JSObject();
        result.put("isConnected", connected);
        result.put("deviceName", connected ? (lastDeviceName.isEmpty() ? "Bluetooth" : lastDeviceName) : "");
        call.resolve(result);
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        String album = call.getString("album", "");
        String artworkUrl = call.getString("artworkUrl", "");
        Double durationDouble = call.getDouble("durationMs");
        long durationMs = durationDouble != null ? durationDouble.longValue() : 0;

        Log.i(TAG, "updateMetadata called: title='" + title + "' artist='" + artist
            + "' album='" + album + "' durationMs=" + durationMs);

        Intent intent = new Intent(getContext(), AudioForegroundService.class);
        intent.setAction(AudioForegroundService.ACTION_UPDATE_METADATA);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("album", album);
        intent.putExtra("artworkUrl", artworkUrl);
        intent.putExtra("durationMs", durationMs);
        intent.putExtra("isFavorite", call.getBoolean("isFavorite", false));
        intent.putExtra("isPodcast", call.getBoolean("isPodcast", false));

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
        } catch (Throwable t) {
            Log.e(TAG, "Failed to start AudioForegroundService for metadata update", t);
        }

        call.resolve();
    }

    @PluginMethod
    public void updatePlaybackState(PluginCall call) {
        boolean isPlaying = call.getBoolean("isPlaying", false);
        long positionMs = 0;
        Double positionDouble = call.getDouble("positionMs");
        if (positionDouble != null) {
            positionMs = positionDouble.longValue();
        }

        Intent intent = new Intent(getContext(), AudioForegroundService.class);
        intent.setAction(AudioForegroundService.ACTION_UPDATE_PLAYBACK_STATE);
        intent.putExtra("isPlaying", isPlaying);
        intent.putExtra("positionMs", positionMs);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
        } catch (Throwable t) {
            // ignore
        }

        call.resolve();
    }

    @PluginMethod
    public void updatePosition(PluginCall call) {
        long positionMs = 0;
        Double positionDouble = call.getDouble("positionMs");
        if (positionDouble != null) {
            positionMs = positionDouble.longValue();
        }

        Intent intent = new Intent(getContext(), AudioForegroundService.class);
        intent.setAction(AudioForegroundService.ACTION_UPDATE_POSITION);
        intent.putExtra("positionMs", positionMs);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
        } catch (Throwable t) {
            // ignore
        }

        call.resolve();
    }

    @PluginMethod
    public void playStream(PluginCall call) {
        String url = call.getString("url", "");
        Double posDouble = call.getDouble("positionMs");
        long pos = posDouble != null ? posDouble.longValue() : 0;
        AudioForegroundService service = AudioForegroundService.getInstance();
        if (service != null) {
            service.playStream(url, pos);
        }
        call.resolve();
    }

    @PluginMethod
    public void pauseStream(PluginCall call) {
        AudioForegroundService service = AudioForegroundService.getInstance();
        if (service != null) {
            service.pauseStream();
        }
        call.resolve();
    }

    @PluginMethod
    public void resumeStream(PluginCall call) {
        AudioForegroundService service = AudioForegroundService.getInstance();
        if (service != null) {
            service.resumeStream();
        }
        call.resolve();
    }

    @PluginMethod
    public void seekStream(PluginCall call) {
        Double posDouble = call.getDouble("positionMs");
        long pos = posDouble != null ? posDouble.longValue() : 0;
        AudioForegroundService service = AudioForegroundService.getInstance();
        if (service != null) {
            service.seekStream(pos);
        }
        call.resolve();
    }

    @PluginMethod
    public void getPlaybackStatus(PluginCall call) {
        AudioForegroundService service = AudioForegroundService.getInstance();
        JSObject ret = new JSObject();
        if (service != null && service.getMediaPlayer() != null) {
            try {
                android.media.MediaPlayer mp = service.getMediaPlayer();
                ret.put("isPlaying", mp.isPlaying());
                ret.put("positionMs", mp.getCurrentPosition());
                ret.put("durationMs", mp.getDuration());
            } catch (Throwable t) {
                ret.put("isPlaying", false);
                ret.put("positionMs", 0);
                ret.put("durationMs", 0);
            }
        } else {
            ret.put("isPlaying", false);
            ret.put("positionMs", 0);
            ret.put("durationMs", 0);
        }
        call.resolve(ret);
    }

    public void notifyMediaAction(String action, long seekPositionMs) {
        JSObject data = new JSObject();
        data.put("action", action);
        if (seekPositionMs >= 0) {
            data.put("seekPositionMs", seekPositionMs);
        }
        notifyListeners("mediaAction", data, true);
    }

    public static synchronized void queueOrDispatchMediaAction(Context context, String action, long position) {
        if (instance != null) {
            instance.notifyMediaAction(action, position);
        } else {
            pendingAction = action;
            pendingPosition = position;
            if (context != null) {
                try {
                    Intent launchIntent = new Intent(context, MainActivity.class);
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    context.startActivity(launchIntent);
                } catch (Throwable error) {
                    Log.w(TAG, "Failed launching MainActivity for queued action", error);
                }
            }
        }
    }

    public static synchronized void flushPendingMediaAction() {
        if (instance != null && pendingAction != null) {
            String action = pendingAction;
            long position = pendingPosition;
            pendingAction = null;
            pendingPosition = -1;
            instance.notifyMediaAction(action, position);
        }
    }

    @PluginMethod
    public void updateAutoCatalog(PluginCall call) {
        String json = call.getString("json", "[]");
        getContext().getSharedPreferences("aurora_auto", Context.MODE_PRIVATE)
                .edit().putString("catalog", json).apply();
        AuroraAutoMediaBrowserService.onCatalogUpdated();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try {
            if (audioDeviceCallback != null && audioManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                audioManager.unregisterAudioDeviceCallback(audioDeviceCallback);
            }
            if (bluetoothReceiver != null) {
                getContext().unregisterReceiver(bluetoothReceiver);
            }
        } catch (Throwable t) {
            // ignore
        }
    }
}
