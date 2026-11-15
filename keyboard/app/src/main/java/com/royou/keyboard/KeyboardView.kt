package com.royou.keyboard

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView

class KeyboardView(context: Context, private val listener: Listener) : LinearLayout(context) {

    interface Listener {
        fun onText(text: String)
        fun onDelete()
        fun onEnter()
        fun onPickIme()
    }

    enum class Mode { RU, EN, SYM }

    private val prefs = Prefs(context)
    private val handler = Handler(Looper.getMainLooper())
    private var mode = Mode.RU
    private var lastLetterMode = Mode.RU
    var shift = false
        private set
    private var caps = false
    private var lastShiftTap = 0L

    init {
        orientation = VERTICAL
        rebuild()
    }

    fun setShift(on: Boolean) {
        if (caps) return
        if (shift != on) { shift = on; rebuild() }
    }

    fun rebuild() {
        removeAllViews()
        val dark = prefs.dark
        setBackgroundColor(if (dark) 0xFF1E1F22.toInt() else 0xFFD9DCE1.toInt())
        val pad = dp(4)
        setPadding(pad, pad, pad, pad)

        val rows = when (mode) { Mode.RU -> Layouts.ru; Mode.EN -> Layouts.en; Mode.SYM -> Layouts.sym }
        for (row in rows) {
            val r = newRow()
            for (ch in row) {
                when (ch) {
                    '⇧' -> r.addView(key(if (caps) "⇪" else "⇧", 1.5f, special = true, active = shift || caps) { onShift() })
                    '⌫' -> r.addView(key("⌫", 1.5f, special = true, repeat = true) { listener.onDelete() })
                    else -> {
                        val s = if (shift || caps) ch.uppercase() else ch.toString()
                        r.addView(key(s, 1f) { listener.onText(s); if (shift && !caps) { shift = false; rebuild() } })
                    }
                }
            }
            addView(r)
        }

        val bottom = newRow()
        bottom.addView(key(if (mode == Mode.SYM) "АБВ" else "?123", 1.5f, special = true) {
            if (mode == Mode.SYM) mode = lastLetterMode else { lastLetterMode = mode; mode = Mode.SYM }
            rebuild()
        })
        bottom.addView(globe())
        bottom.addView(key(",", 1f) { listener.onText(",") })
        bottom.addView(key(if (mode == Mode.EN) "English" else "Русский", 4f) { listener.onText(" ") })
        bottom.addView(key(".", 1f) { listener.onText(".") })
        bottom.addView(key("⏎", 1.5f, special = true, accent = true) { listener.onEnter() })
        addView(bottom)
    }

    private fun onShift() {
        val now = System.currentTimeMillis()
        if (now - lastShiftTap < 400) { caps = !caps; shift = caps }
        else if (caps) { caps = false; shift = false }
        else shift = !shift
        lastShiftTap = now
        rebuild()
    }

    private fun newRow() = LinearLayout(context).apply {
        orientation = HORIZONTAL
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, dp(prefs.keyHeight))
    }

    private fun globe(): View = base("🌐", 1f, special = true).apply {
        setOnClickListener { haptic(); mode = if (mode == Mode.RU) Mode.EN else Mode.RU; lastLetterMode = mode; rebuild() }
        setOnLongClickListener { listener.onPickIme(); true }
    }

    private fun base(label: String, weight: Float, special: Boolean = false, accent: Boolean = false, active: Boolean = false): TextView {
        val dark = prefs.dark
        val normal = when {
            accent -> 0xFF3D7BFF.toInt()
            active -> if (dark) 0xFF6B6F78.toInt() else 0xFFB9BEC8.toInt()
            special -> if (dark) 0xFF3A3C41.toInt() else 0xFFB4B9C2.toInt()
            else -> if (dark) 0xFF4A4C52.toInt() else Color.WHITE
        }
        val pressed = if (dark) 0xFF70737B.toInt() else 0xFF9AA0AC.toInt()
        fun shape(c: Int) = GradientDrawable().apply { setColor(c); cornerRadius = dp(6).toFloat() }
        val bg = android.graphics.drawable.StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_pressed), shape(pressed))
            addState(intArrayOf(), shape(normal))
        }
        return TextView(context).apply {
            text = label
            gravity = Gravity.CENTER
            textSize = if (label.length > 2) 14f else 20f
            setTextColor(if (accent) Color.WHITE else if (dark) Color.WHITE else Color.BLACK)
            background = bg
            layoutParams = LayoutParams(0, LayoutParams.MATCH_PARENT, weight).apply { setMargins(dp(2), dp(3), dp(2), dp(3)) }
        }
    }

    private fun key(label: String, weight: Float, special: Boolean = false, accent: Boolean = false,
                    active: Boolean = false, repeat: Boolean = false, action: () -> Unit): TextView {
        val v = base(label, weight, special, accent, active)
        var rep: Runnable? = null
        v.setOnTouchListener { view, e ->
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    view.isPressed = true; haptic(); action()
                    if (repeat) {
                        rep = object : Runnable { override fun run() { action(); handler.postDelayed(this, 50) } }
                        handler.postDelayed(rep!!, 400)
                    }
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    view.isPressed = false; rep?.let { handler.removeCallbacks(it) }
                }
            }
            true
        }
        return v
    }

    private fun haptic() {
        if (prefs.haptic) performHapticFeedback(
            HapticFeedbackConstants.KEYBOARD_TAP,
            HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING
        )
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
