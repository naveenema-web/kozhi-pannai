#!/bin/bash
# Sets up the Android project: file saver, HEIC converter, app icon and opening screen.
# Run from the repository root after "npx cap add android".
set -e

# ---- Add automatic Downloads saver ----
D=app/android/app/src/main/java/com/kozhi/pannai
mkdir -p "$D"
cat > "$D/DownloadsWriter.java" <<'JAVA'
package com.kozhi.pannai;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "DownloadsWriter")
public class DownloadsWriter extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name", "kozhi_pannai_backup.json");
        String data = call.getString("data", "");
        ContentResolver resolver = getContext().getContentResolver();
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                throw new Exception("Android 10 தேவை");
            }
            // remove every older copy with this name (including copies this app can see)
            Cursor c = resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                new String[]{MediaStore.Downloads._ID}, MediaStore.Downloads.DISPLAY_NAME + "=?", new String[]{name}, null);
            if (c != null) {
                while (c.moveToNext()) {
                    resolver.delete(ContentUris.withAppendedId(MediaStore.Downloads.EXTERNAL_CONTENT_URI, c.getLong(0)), null, null);
                }
                c.close();
            }
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, name);
            v.put(MediaStore.Downloads.MIME_TYPE, "application/json");
            v.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new Exception("Downloads-இல் கோப்பு உருவாக்க முடியவில்லை");
            try (OutputStream os = resolver.openOutputStream(uri)) {
                if (os == null) throw new Exception("கோப்பு திறக்க முடியவில்லை");
                os.write(data.getBytes(StandardCharsets.UTF_8));
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, done, null, null);
            call.resolve(new JSObject());
        } catch (Exception e) {
            // Downloads is blocked (an old copy from an earlier install): keep the backup inside the app so it is never lost
            try {
                File f = new File(getContext().getFilesDir(), name);
                try (FileOutputStream fo = new FileOutputStream(f)) {
                    fo.write(data.getBytes(StandardCharsets.UTF_8));
                }
                JSObject ret = new JSObject();
                ret.put("note", "Downloads-இல் சேமிக்க முடியவில்லை; App-க்குள் சேமிக்கப்பட்டது. Files-இல் பழைய kozhi_pannai_backup.json இருந்தால் அதை நீக்கவும்.");
                call.resolve(ret);
            } catch (Exception e2) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }
    }
}
JAVA
cat > app/android/app/src/main/java/com/kozhi/pannai/MainActivity.java <<'JAVA'
package com.kozhi.pannai;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DownloadsWriter.class);
        super.onCreate(savedInstanceState);
    }
}
JAVA

# ---- Install image tools ----

# ---- Set app icon from the picture ----
RES=app/android/app/src/main/res
SRC=$GITHUB_WORKSPACE/app-icon.png
if [ ! -f "$SRC" ]; then echo "app-icon.png not found; keeping default icon"; true; fi
# use the full square icon everywhere: remove the masked adaptive icon definition
rm -rf "$RES/mipmap-anydpi-v26"
# legacy launcher icons (sharp Lanczos resize + light sharpening)
for pair in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  d=${pair%%:*}; s=${pair##*:}
  mkdir -p "$RES/mipmap-$d"
  convert "$SRC" -filter Lanczos -resize ${s}x${s} -unsharp 0x0.75+0.75+0.008 "$RES/mipmap-$d/ic_launcher.png"
  cp "$RES/mipmap-$d/ic_launcher.png" "$RES/mipmap-$d/ic_launcher_round.png"
done
# adaptive foreground: 108dp canvas per density, picture fills the centre
for pair in mdpi:108 hdpi:162 xhdpi:216 xxhdpi:324 xxxhdpi:432; do
  d=${pair%%:*}; s=${pair##*:}
  mkdir -p "$RES/mipmap-$d"
  convert "$SRC" -filter Lanczos -resize $((s*72/108))x$((s*72/108)) -unsharp 0x0.75+0.75+0.008 -gravity center -background none -extent ${s}x${s} "$RES/mipmap-$d/ic_launcher_foreground.png"
done
echo "App icon set"

# ---- Set opening screen (app icon only) ----
RES=app/android/app/src/main/res
SRC=$GITHUB_WORKSPACE/app-icon.png
# plain frame-colour background behind the app icon while the app starts (no photo)
for d in drawable drawable-port drawable-land; do
  mkdir -p "$RES/$d"
  convert -size 1080x1920 xc:'#AEAA48' "$RES/$d/splash.png"
done
convert -size 1024x1024 xc:none \( "$SRC" -filter Lanczos -resize 680x680 -unsharp 0x0.6+0.6+0.006 \) -gravity center -composite "$RES/drawable/splash_icon.png"
mkdir -p "$RES/values-v31"
cat > "$RES/values-v31/styles.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:windowSplashScreenBackground">#AEAA48</item>
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="android:windowSplashScreenIconBackgroundColor">#AEAA48</item>
        <item name="android:windowBackground">@drawable/splash</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
XML
echo "Opening screen set"

# ---- Add offline HEIC converter ----
D=app/android/app/src/main/java/com/kozhi/pannai
mkdir -p "$D"
cat > "$D/HeicConverter.java" <<'JAVA'
package com.kozhi.pannai;

import android.graphics.Bitmap;
import android.graphics.ImageDecoder;
import android.os.Build;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

@CapacitorPlugin(name = "HeicConverter")
public class HeicConverter extends Plugin {
    @PluginMethod
    public void toJpeg(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            call.reject("Android 9 அல்லது அதற்கு மேல் தேவை");
            return;
        }
        try {
            byte[] bytes = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
            ImageDecoder.Source src = ImageDecoder.createSource(ByteBuffer.wrap(bytes));
            Bitmap bmp = ImageDecoder.decodeBitmap(src);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, 95, out);
            JSObject ret = new JSObject();
            ret.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
JAVA
cat > "$D/MainActivity.java" <<'JAVA'
package com.kozhi.pannai;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DownloadsWriter.class);
        registerPlugin(HeicConverter.class);
        super.onCreate(savedInstanceState);
    }
}
JAVA
