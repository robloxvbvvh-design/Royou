package com.royou.keyboard

import android.content.Context
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView

class KeyboardView(context: Context, private val listener: Listener) : LinearLayout(context) {

    interface Listener {
        fun onText(text: String)
        fun onDelete()
        fun onEnter()
        fun onCycleLang()
        fun onLangPanel()
    }

    private enum class Mode { LETTERS, SYM }

    private val prefs = Prefs(context)
    private val handler = Handler(Looper.getMainLooper())
    private var mode = Mode.LETTERS
    var lang: Lang = Languages.byCode("en")
        set(v) { field = v; mode = Mode.LETTERS; rebuild() }
    var shift = false
        private set
    private var caps = false
    private var lastShiftTap = 0L

    init { orientation = VERTICAL; rebuild() }

    fun setShift(on: Boolean) {
        if (caps) return
        if (shift != on) { shift = on; rebuild() }
    }

    fun rebuild() {
        removeAllViews()
        val dark = prefs.dark
        setBackgroundColor(Ui.bg(dark))
        val pad = dp(4)
        setPadding(pad, pad, pad, pad)
        val h = dp(prefs.keyHeight)

        // цифры
        addView(newRow((h * 0.8f).toInt()).also { r ->
            "1234567890".forEach { d -> r.addView(key(d.toString(), 1f, small = true) { listener.onText(d.toString()) }) }
        })

        if (mode == Mode.LETTERS) {
            val rows = lang.rows
            rows.forEachIndexed { i, row ->
                val r = newRow(h)
                val last = i == rows.size - 1
                if (last) r.addView(key(if (caps) "⇪" else "⇧", 1.4f, special = true, active = shift || caps) { onShift() })
                for (ch in row) {
                    val s = if (shift || caps) ch.toString().uppercase() else ch.toString()
                    r.addView(key(s, 1f) { listener.onText(s); if (shift && !caps) { shift = false; rebuild() } })
                }
                if (last) r.addView(key("⌫", 1.4f, special = true, repeat = true) { listener.onDelete() })
                addView(r)
            }
            if (lang.extra.isNotEmpty()) addView(extraStrip(h))
        } else {
            val rows = listOf("@#₽_&-+()/", "*\"':;!?=%~", "<>[]{}\\|^`")
            rows.forEachIndexed { i, row ->
                val r = newRow(h)
                for (ch in row) r.addView(key(ch.toString(), 1f) { listener.onText(ch.toString()) })
                if (i == rows.size - 1) r.addView(key("⌫", 1.4f, special = true, repeat = true) { listener.onDelete() })
                addView(r)
            }
        }

        val bottom = newRow(h)
        bottom.addView(key(if (mode == Mode.SYM) "ABC" else "?123", 1.4f, special = true) {
            mode = if (mode == Mode.SYM) Mode.LETTERS else Mode.SYM; rebuild()
        })
        bottom.addView(globe())
        bottom.addView(key(",", 0.8f) { listener.onText(",") })
        bottom.addView(key(lang.name, 4f, small = lang.name.length > 8) { listener.onText(" ") })
        bottom.addView(key(".", 0.8f) { listener.onText(".") })
        bottom.addView(key("⏎", 1.4f, special = true, accent = true) { listener.onEnter() })
        addView(bottom)
    }

    private fun extraStrip(h: Int): View {
        val inner = LinearLayout(context).apply { orientation = HORIZONTAL }
        for (ch in lang.extra) {
            val s = if (shift || caps) ch.toString().uppercase() else ch.toString()
            inner.addView(key(s, 0f) { listener.onText(s) }.also {
                it.layoutParams = LayoutParams(dp(40), LayoutParams.MATCH_PARENT).apply { setMargins(dp(2), dp(3), dp(2), dp(3)) }
            })
        }
        return HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, (h * 0.85f).toInt())
            addView(inner, FrameLayoutParams())
        }
    }

    private fun FrameLayoutParams() = android.widget.FrameLayout.LayoutParams(
        android.widget.FrameLayout.LayoutParams.WRAP_CONTENT, android.widget.FrameLayout.LayoutParams.MATCH_PARENT)

    private fun onShift() {
        val now = System.currentTimeMillis()
        if (now - lastShiftTap < 400) { caps = !caps; shift = caps }
        else if (caps) { caps = false; shift = false }
        else shift = !shift
        lastShiftTap = now
        rebuild()
    }

    private fun newRow(height: Int) = LinearLayout(context).apply {
        orientation = HORIZONTAL
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, height)
    }

    private fun globe(): View = base("🌐", 1f, special = true).apply {
        setOnClickListener { haptic(); listener.onCycleLang() }
        setOnLongClickListener { listener.onLangPanel(); true }
    }

    private fun base(label: String, weight: Float, special: Boolean = false, accent: Boolean = false,
                     active: Boolean = false, small: Boolean = false): TextView {
        val dark = prefs.dark
        val normal = when {
            accent -> Ui.ACCENT
            active -> if (dark) 0xFF6B6F78.toInt() else 0xFFB9BEC8.toInt()
            special -> Ui.specialColor(dark)
            else -> Ui.keyColor(dark)
        }
        return TextView(context).apply {
            text = label
            gravity = Gravity.CENTER
            textSize = if (small) 13f else if (label.length > 2) 14f else 20f
            maxLines = 1
            setTextColor(if (accent) Color.WHITE else Ui.fg(dark))
            background = Ui.keyBg(context, normal, Ui.pressedColor(dark))
            layoutParams = LayoutParams(0, LayoutParams.MATCH_PARENT, weight).apply { setMargins(dp(2), dp(3), dp(2), dp(3)) }
        }
    }

    private fun key(label: String, weight: Float, special: Boolean = false, accent: Boolean = false,
                    active: Boolean = false, repeat: Boolean = false, small: Boolean = false,
                    action: () -> Unit): TextView {
        val v = base(label, weight, special, accent, active, small)
        var rep: Runnable? = null
        v.setOnTouchListener { view, e ->
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    view.isPressed = true; haptic(); action()
                    if (repeat) {
                        val r = object : Runnable { override fun run() { action(); handler.postDelayed(this, 50) } }
                        rep = r; handler.postDelayed(r, 400)
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
        if (prefs.haptic) performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP, HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING)
    }

    private fun dp(v: Int) = Ui.dp(context, v)
}
