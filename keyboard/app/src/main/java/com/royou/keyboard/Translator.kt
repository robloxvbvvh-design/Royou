package com.royou.keyboard

import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Перевод через публичную точку Google Translate (неофициальную, без ключа). */
object Translator {
    /** Возвращает (перевод, определённый язык исходника). */
    fun translate(text: String, to: String): Pair<String, String> {
        val c = URL("https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=$to&dt=t")
            .openConnection() as HttpURLConnection
        try {
            c.requestMethod = "POST"; c.doOutput = true
            c.connectTimeout = 8000; c.readTimeout = 15000
            c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
            c.outputStream.use { it.write(("q=" + URLEncoder.encode(text, "UTF-8")).toByteArray()) }
            val body = c.inputStream.bufferedReader().use { it.readText() }
            val arr = JSONArray(body)
            val parts = arr.getJSONArray(0)
            val sb = StringBuilder()
            for (i in 0 until parts.length()) {
                val p = parts.optJSONArray(i) ?: continue
                if (!p.isNull(0)) sb.append(p.getString(0))
            }
            return sb.toString() to (if (arr.length() > 2 && !arr.isNull(2)) arr.getString(2) else "?")
        } finally {
            c.disconnect()
        }
    }
}
