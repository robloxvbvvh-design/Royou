package com.royou.keyboard

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView

object Ui {
    fun dp(c: Context, v: Int) = (v * c.resources.displayMetrics.density).toInt()

    fun bg(dark: Boolean) = if (dark) 0xFF1E1F22.toInt() else 0xFFD9DCE1.toInt()
    fun fg(dark: Boolean) = if (dark) Color.WHITE else Color.BLACK
    fun keyColor(dark: Boolean) = if (dark) 0xFF4A4C52.toInt() else Color.WHITE
    fun specialColor(dark: Boolean) = if (dark) 0xFF3A3C41.toInt() else 0xFFB4B9C2.toInt()
    fun pressedColor(dark: Boolean) = if (dark) 0xFF70737B.toInt() else 0xFF9AA0AC.toInt()
    const val ACCENT = 0xFF3D7BFF.toInt()

    fun shape(c: Context, color: Int) = GradientDrawable().apply { setColor(color); cornerRadius = dp(c, 6).toFloat() }

    fun keyBg(c: Context, normal: Int, pressed: Int) = StateListDrawable().apply {
        addState(intArrayOf(android.R.attr.state_pressed), shape(c, pressed))
        addState(intArrayOf(), shape(c, normal))
    }

    /** Кнопка-«клавиша» с весом внутри горизонтального LinearLayout. */
    fun btn(c: Context, text: String, dark: Boolean, weight: Float = 1f, color: Int = specialColor(dark),
            size: Float = 14f, onClick: () -> Unit): TextView = TextView(c).apply {
        this.text = text
        gravity = Gravity.CENTER
        textSize = size
        setTextColor(if (color == ACCENT) Color.WHITE else fg(dark))
        background = keyBg(c, color, pressedColor(dark))
        setPadding(dp(c, 4), 0, dp(c, 4), 0)
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, weight).apply {
            setMargins(dp(c, 2), dp(c, 3), dp(c, 2), dp(c, 3))
        }
        setOnClickListener { onClick() }
    }

    fun row(c: Context, height: Int, vararg views: android.view.View) = LinearLayout(c).apply {
        orientation = LinearLayout.HORIZONTAL
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, height)
        views.forEach { addView(it) }
    }
}
