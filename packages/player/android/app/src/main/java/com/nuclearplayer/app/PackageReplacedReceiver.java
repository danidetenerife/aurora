package com.nuclearplayer.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class PackageReplacedReceiver extends BroadcastReceiver {
    private static final String TAG = "PackageReplacedReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            Log.i(TAG, "Application was updated (MY_PACKAGE_REPLACED). Restarting Aurora...");
            try {
                Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    context.startActivity(launchIntent);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to restart Aurora after package replaced", e);
            }
        }
    }
}
