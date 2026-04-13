package com.limitter

import android.app.Activity
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.PaintDrawable
import android.graphics.drawable.ShapeDrawable
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

class BlockOverlayActivity : Activity() {

    companion object {
        val NUDGES = listOf(
            "You've already proven you can wait. Keep going.",
            "Every minute off-screen is a minute invested in yourself.",
            "Your future self will thank you for closing this right now.",
            "The urge passes. It always does. Give it 60 seconds.",
            "What were you about to do before you picked up your phone?",
            "You set this limit for a reason. Trust that version of you.",
            "This app will still be here tomorrow. Your time won't.",
            "One override today becomes a habit tomorrow.",
            "You're stronger than a notification.",
            "The best things in your day happen off-screen.",
            "Think about how good it felt the last time you resisted.",
            "You don't need more screen time. You need more free time.",
            "Your attention is the most valuable thing you own.",
            "This is the moment where discipline becomes freedom.",
            "Put the phone down. Go do something that makes you proud.",
            "Screen time doesn't recharge you. Rest does.",
            "Every limit you respect builds a stronger you.",
            "What would you tell a friend who asked to override right now?",
            "The app is designed to keep you hooked. You're designed to be free.",
            "You've gone this long. Don't reset the streak now.",
            "Boredom is where creativity begins. Sit with it.",
            "No one ever regretted spending less time on their phone.",
            "You're not missing out. You're opting in to real life.",
            "This feeling of wanting more will pass in under 2 minutes.",
            "Your eyes, your posture, your sleep \u2014 they all benefit when you stop.",
            "An override costs more than credits. It costs your momentum.",
            "You made a commitment to yourself. Honor it.",
            "Close this screen and take three deep breaths instead.",
            "The people around you deserve your full attention.",
            "Small wins compound. This is one of them.",
            "How did you feel the last time you overused this app?",
            "Replace the scroll with a walk. Even 5 minutes counts.",
            "You're building a habit right now. Make it the right one.",
            "If this app disappeared tomorrow, what would you do instead? Go do that.",
            "Progress isn't about being perfect. It's about not giving in every time.",
            "Your brain needs a break from stimulation. Give it one.",
            "You're not avoiding fun. You're choosing better fun.",
            "The discomfort you feel is growth happening in real time.",
            "Ask yourself: will this override make my day better or just longer?",
            "Every time you respect a limit, you level up.",
            "Reaching your limit means the system is working. Let it work.",
            "You don't owe this app your evening.",
            "Think of one thing you've been putting off. Go do that instead.",
            "Your screen time today is already enough. Trust the number.",
            "Overrides are for emergencies, not for boredom.",
            "The scroll never ends. But your day does.",
            "You chose to set limits because unlimited wasn't working.",
            "Right now, someone you love would rather have your attention.",
            "This is the hard part. And you're doing it.",
            "Tomorrow you'll be glad you stopped today.",
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )

        window.statusBarColor = Color.parseColor("#022c22")
        window.navigationBarColor = Color.parseColor("#022c22")

        val appName = intent.getStringExtra("app_name") ?: "This app"

        val root = FrameLayout(this).apply {
            val bg = PaintDrawable()
            bg.shaderFactory = object : ShapeDrawable.ShaderFactory() {
                override fun resize(w: Int, h: Int): Shader {
                    return LinearGradient(
                        0f, 0f, 0f, h.toFloat(),
                        intArrayOf(
                            Color.parseColor("#022c22"),
                            Color.parseColor("#064e3b"),
                            Color.parseColor("#022c22"),
                        ),
                        floatArrayOf(0f, 0.45f, 1f),
                        Shader.TileMode.CLAMP
                    )
                }
            }
            background = bg
        }

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(32), dp(80), dp(32), dp(48))
        }

        val pulseRing = View(this).apply {
            val ring = GradientDrawable()
            ring.shape = GradientDrawable.OVAL
            ring.setStroke(dp(2), Color.parseColor("#2210B981"))
            ring.setColor(Color.TRANSPARENT)
            background = ring
        }
        val ringSize = dp(140)

        val iconCircle = FrameLayout(this).apply {
            val circle = GradientDrawable()
            circle.shape = GradientDrawable.OVAL
            circle.colors = intArrayOf(
                Color.parseColor("#059669"),
                Color.parseColor("#047857"),
            )
            circle.orientation = GradientDrawable.Orientation.TOP_BOTTOM
            background = circle
            elevation = dp(12).toFloat()
        }
        val circleSize = dp(110)

        val lockIcon = TextView(this).apply {
            text = "\uD83D\uDD12"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 44f)
            gravity = Gravity.CENTER
        }
        iconCircle.addView(lockIcon, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        val iconContainer = FrameLayout(this)
        iconContainer.addView(pulseRing, LinearLayout.LayoutParams(ringSize, ringSize).apply {
            gravity = Gravity.CENTER
        })
        iconContainer.addView(iconCircle, FrameLayout.LayoutParams(circleSize, circleSize).apply {
            gravity = Gravity.CENTER
        })
        content.addView(iconContainer, LinearLayout.LayoutParams(ringSize, ringSize).apply {
            gravity = Gravity.CENTER
            bottomMargin = dp(32)
        })

        val title = TextView(this).apply {
            text = "Time's Up"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 32f)
            setTextColor(Color.WHITE)
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            gravity = Gravity.CENTER
            letterSpacing = 0.02f
        }
        content.addView(title, lp { bottomMargin = dp(16) })

        val divider = View(this).apply {
            val bg = GradientDrawable()
            bg.colors = intArrayOf(
                Color.TRANSPARENT,
                Color.parseColor("#10B981"),
                Color.TRANSPARENT,
            )
            bg.orientation = GradientDrawable.Orientation.LEFT_RIGHT
            background = bg
        }
        content.addView(divider, LinearLayout.LayoutParams(dp(120), dp(2)).apply {
            gravity = Gravity.CENTER
            bottomMargin = dp(20)
        })

        val subtitle = TextView(this).apply {
            text = "Your daily limit for"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(Color.parseColor("#A7F3D0"))
            gravity = Gravity.CENTER
        }
        content.addView(subtitle)

        val appBadge = TextView(this).apply {
            text = appName
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            setTextColor(Color.WHITE)
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(dp(20), dp(8), dp(20), dp(8))
            val bg = GradientDrawable()
            bg.cornerRadius = dp(10).toFloat()
            bg.setColor(Color.parseColor("#1A10B981"))
            bg.setStroke(dp(1), Color.parseColor("#34D399"))
            background = bg
        }
        content.addView(appBadge, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.CENTER
            topMargin = dp(8)
            bottomMargin = dp(6)
        })

        val reached = TextView(this).apply {
            text = "has been reached"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(Color.parseColor("#A7F3D0"))
            gravity = Gravity.CENTER
        }
        content.addView(reached, lp { bottomMargin = dp(36) })

        val nudge = NUDGES[(System.currentTimeMillis() % NUDGES.size).toInt()]

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val bg = GradientDrawable()
            bg.cornerRadius = dp(20).toFloat()
            bg.setColor(Color.parseColor("#0D3D2E"))
            bg.setStroke(dp(1), Color.parseColor("#1A5D42"))
            background = bg
            setPadding(dp(24), dp(20), dp(24), dp(20))
            elevation = dp(4).toFloat()
        }

        val nudgeIcon = TextView(this).apply {
            text = "\uD83D\uDCAC"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            gravity = Gravity.CENTER
        }
        card.addView(nudgeIcon, lp { bottomMargin = dp(10) })

        val nudgeText = TextView(this).apply {
            text = "\u201C$nudge\u201D"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            setTextColor(Color.parseColor("#D1FAE5"))
            typeface = Typeface.create("sans-serif", Typeface.ITALIC)
            gravity = Gravity.CENTER
            setLineSpacing(dp(4).toFloat(), 1f)
        }
        card.addView(nudgeText)

        content.addView(card, lp { bottomMargin = dp(32) })

        val overrideBtn = TextView(this).apply {
            text = "\u26A1  Use Override"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(Color.WHITE)
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(16), dp(24), dp(16))
            val bg = GradientDrawable()
            bg.cornerRadius = dp(14).toFloat()
            bg.colors = intArrayOf(
                Color.parseColor("#10B981"),
                Color.parseColor("#059669"),
            )
            bg.orientation = GradientDrawable.Orientation.LEFT_RIGHT
            background = bg
            elevation = dp(6).toFloat()
            setOnClickListener { useOverride() }
        }
        content.addView(overrideBtn, lp { bottomMargin = dp(14) })

        val goBackBtn = TextView(this).apply {
            text = "Go Home"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            setTextColor(Color.parseColor("#6EE7B7"))
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(14), dp(24), dp(14))
            val bg = GradientDrawable()
            bg.cornerRadius = dp(14).toFloat()
            bg.setColor(Color.TRANSPARENT)
            bg.setStroke(dp(1), Color.parseColor("#1A5D42"))
            background = bg
            setOnClickListener { goHome() }
        }
        content.addView(goBackBtn, lp {})

        root.addView(content, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        setContentView(root)
    }

    private fun lp(block: LinearLayout.LayoutParams.() -> Unit = {}): LinearLayout.LayoutParams {
        return LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply(block)
    }

    override fun onBackPressed() {
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
