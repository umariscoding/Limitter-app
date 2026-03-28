package com.limitter

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Base64
import java.io.ByteArrayOutputStream

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap

class AppListModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppListModule"

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val resolveInfos = pm.queryIntentActivities(mainIntent, 0)

            val seen = mutableSetOf<String>()
            val result = WritableNativeArray()

            for (info in resolveInfos) {
                val packageName = info.activityInfo.packageName

                // Skip duplicates and our own app
                if (seen.contains(packageName)) continue
                if (packageName == reactContext.packageName) continue
                seen.add(packageName)

                val appName = info.loadLabel(pm)?.toString() ?: packageName

                val map = WritableNativeMap()
                map.putString("packageName", packageName)
                map.putString("appName", appName)

                // Encode icon as base64 PNG
                try {
                    val drawable = info.loadIcon(pm)
                    val base64Icon = drawableToBase64(drawable)
                    if (base64Icon != null) {
                        map.putString("icon", base64Icon)
                    }
                } catch (_: Exception) {}

                result.pushMap(map)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("APP_LIST_ERROR", e.message, e)
        }
    }

    private fun drawableToBase64(drawable: Drawable): String? {
        return try {
            val bitmap = drawableToBitmap(drawable, 48)
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 80, stream)
            val bytes = stream.toByteArray()
            "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
        } catch (_: Exception) {
            null
        }
    }

    private fun drawableToBitmap(drawable: Drawable, sizeDp: Int): Bitmap {
        val density = reactContext.resources.displayMetrics.density
        val sizePx = (sizeDp * density).toInt()

        if (drawable is BitmapDrawable && drawable.bitmap != null) {
            return Bitmap.createScaledBitmap(drawable.bitmap, sizePx, sizePx, true)
        }

        val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, canvas.width, canvas.height)
        drawable.draw(canvas)
        return bitmap
    }
}
