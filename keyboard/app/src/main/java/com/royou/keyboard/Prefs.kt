package com.royou.keyboard

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray

/** Упорядоченный список строк (новые в начале) в SharedPreferences. */
class ListStore(private val sp: SharedPreferences, private val key: String, private val max: Int) {
    fun get(): List<String> {
        val s = sp.getString(key, null) ?: return emptyList()
        return try { JSONArray(s).let { a -> List(a.length()) { a.getString(it) } } } catch (e: Exception) { emptyList() }
    }
    fun add(v: String) {
        if (v.isBlank()) return
        val l = get().toMutableList(); l.remove(v); l.add(0, v)
        while (l.size > max) l.removeAt(l.size - 1)
        save(l)
    }
    fun remove(v: String) = save(get().filter { it != v })
    fun clear() = save(emptyList())
    private fun save(l: List<String>) = sp.edit().putString(key, JSONArray(l).toString()).apply()
}

class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    val clips = ListStore(sp, "clips", 40)
    val emojiRecents = ListStore(sp, "emojiRecents", 32)

    var dark: Boolean
        get() = sp.getBoolean("dark", false)
        set(v) = sp.edit().putBoolean("dark", v).apply()

    var haptic: Boolean
        get() = sp.getBoolean("haptic", true)
        set(v) = sp.edit().putBoolean("haptic", v).apply()

    var autoCap: Boolean
        get() = sp.getBoolean("autoCap", true)
        set(v) = sp.edit().putBoolean("autoCap", v).apply()

    var clipEnabled: Boolean
        get() = sp.getBoolean("clipEnabled", true)
        set(v) = sp.edit().putBoolean("clipEnabled", v).apply()

    /** Высота клавиши в dp (40..70). */
    var keyHeight: Int
        get() = sp.getInt("keyHeight", 50)
        set(v) = sp.edit().putInt("keyHeight", v.coerceIn(40, 70)).apply()

    var giphyKey: String
        get() = sp.getString("giphyKey", "") ?: ""
        set(v) = sp.edit().putString("giphyKey", v.trim()).apply()

    var translateTo: String
        get() = sp.getString("translateTo", "en") ?: "en"
        set(v) = sp.edit().putString("translateTo", v).apply()

    var currentLang: String
        get() = sp.getString("currentLang", "") ?: ""
        set(v) = sp.edit().putString("currentLang", v).apply()

    /** Включённые языки клавиатуры (коды). */
    var langs: List<String>
        get() = (sp.getString("langs", "ru,en") ?: "ru,en").split(",")
            .filter { Languages.exists(it) }.ifEmpty { listOf("en") }
        set(v) = sp.edit().putString("langs", v.joinToString(",")).apply()
}
