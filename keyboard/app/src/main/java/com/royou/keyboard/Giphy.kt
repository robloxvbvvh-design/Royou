package com.royou.keyboard

import org.json.JSONObject
import java.net.URL
import java.net.URLEncoder

data class Gif(val thumb: String, val url: String, val page: String)

object Giphy {
    fun fetch(key: String, query: String?, lang: String): List<Gif> {
        val base = "https://api.giphy.com/v1/gifs/"
        val url = if (query.isNullOrBlank())
            "${base}trending?api_key=$key&limit=30&rating=g"
        else
            "${base}search?api_key=$key&limit=30&rating=g&lang=$lang&q=" + URLEncoder.encode(query, "UTF-8")
        val body = URL(url).openStream().bufferedReader().use { it.readText() }
        val data = JSONObject(body).getJSONArray("data")
        val out = ArrayList<Gif>()
        for (i in 0 until data.length()) {
            val o = data.getJSONObject(i)
            val img = o.optJSONObject("images") ?: continue
            val thumb = img.optJSONObject("fixed_width_small_still")?.optString("url").orEmpty()
            val full = (img.optJSONObject("downsized") ?: img.optJSONObject("fixed_height"))?.optString("url").orEmpty()
            if (thumb.isNotEmpty() && full.isNotEmpty()) out.add(Gif(thumb, full, o.optString("url", full)))
        }
        return out
    }
}
