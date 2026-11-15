package com.royou.keyboard

import android.content.Context

class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    var dark: Boolean
        get() = sp.getBoolean("dark", false)
        set(v) = sp.edit().putBoolean("dark", v).apply()

    var haptic: Boolean
        get() = sp.getBoolean("haptic", true)
        set(v) = sp.edit().putBoolean("haptic", v).apply()

    var autoCap: Boolean
        get() = sp.getBoolean("autoCap", true)
        set(v) = sp.edit().putBoolean("autoCap", v).apply()

    /** Высота клавиши в dp (40..70). */
    var keyHeight: Int
        get() = sp.getInt("keyHeight", 52)
        set(v) = sp.edit().putInt("keyHeight", v.coerceIn(40, 70)).apply()
}
