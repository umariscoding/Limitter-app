package com.appguard2

import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class WebsiteBlockerOverlayActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Make it full screen
        window.setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0f0c29"))
            gravity = Gravity.CENTER
            setPadding(80, 80, 80, 80)
        }

        root.addView(TextView(this).apply {
            text = "🚫"
            textSize = 100f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 40)
        })

        root.addView(TextView(this).apply {
            text = "Website Blocked"
            setTextColor(Color.parseColor("#ef4444"))
            textSize = 36f
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 20)
        })

        root.addView(TextView(this).apply {
            text = "You have reached your limit"
            setTextColor(Color.parseColor("#c4b5fd"))
            textSize = 20f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 80)
        })

        root.addView(Button(this).apply {
            text = "🏠 Go Home"
            setBackgroundColor(Color.parseColor("#7c3aed"))
            setTextColor(Color.WHITE)
            textSize = 18f
            setPadding(80, 40, 80, 40)
            setOnClickListener {
                val homeIntent = android.content.Intent(android.content.Intent.ACTION_MAIN).apply {
                    addCategory(android.content.Intent.CATEGORY_HOME)
                    flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(homeIntent)
                finish()
            }
        })

        setContentView(root)
    }

    override fun onBackPressed() {
        // Disable back button
        // Don't call super.onBackPressed()
    }
}
