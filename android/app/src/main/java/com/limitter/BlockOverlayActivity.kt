package com.limitter

import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class BlockOverlayActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Make it appear over lock screen
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )

        val appName = intent.getStringExtra("app_name") ?: "This app"
        val packageName = intent.getStringExtra("package_name") ?: ""

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0F172A"))
            setPadding(dp(32), dp(64), dp(32), dp(64))
        }

        // Block icon
        val iconText = TextView(this).apply {
            text = "\u26D4" // no entry emoji
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 64f)
            gravity = Gravity.CENTER
        }
        layout.addView(iconText)

        // Title
        val title = TextView(this).apply {
            text = "Time's Up!"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, dp(12))
        }
        layout.addView(title)

        // Message
        val message = TextView(this).apply {
            text = "You've reached your daily limit for $appName.\nTake a break and come back tomorrow!"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(Color.parseColor("#94A3B8"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(48))
            setLineSpacing(dp(4).toFloat(), 1f)
        }
        layout.addView(message)

        // Use Override button
        val overrideBtn = Button(this).apply {
            text = "Use Override"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#4F46E5"))
            setPadding(dp(32), dp(16), dp(32), dp(16))
            setOnClickListener {
                useOverride()
            }
        }
        layout.addView(overrideBtn, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.CENTER
        })

        setContentView(layout)
    }

    override fun onBackPressed() {
        // Don't allow back — go home instead
        goHome()
    }

    private fun goHome() {
        val homeIntent = android.content.Intent(android.content.Intent.ACTION_MAIN).apply {
            addCategory(android.content.Intent.CATEGORY_HOME)
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
        finish()
    }

    private fun useOverride() {
        val rawPkg = intent.getStringExtra("package_name") ?: ""
        val pkg = rawPkg.removePrefix("website:")
        val name = intent.getStringExtra("app_name") ?: ""
        val deepLink = Uri.parse(
            "limitter://override?package=${Uri.encode(pkg)}&appName=${Uri.encode(name)}"
        )
        val overrideIntent = android.content.Intent(
            android.content.Intent.ACTION_VIEW, deepLink
        ).apply {
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivity(overrideIntent)
        finish()
    }

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).toInt()
    }
}
