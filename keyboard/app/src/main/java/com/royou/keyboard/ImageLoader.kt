package com.royou.keyboard

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.util.LruCache
import android.widget.ImageView
import java.net.URL
import java.util.concurrent.Executors

object ImageLoader {
    private val cache = LruCache<String, Bitmap>(80)
    private val pool = Executors.newFixedThreadPool(4)
    private val main = Handler(Looper.getMainLooper())

    fun load(url: String, view: ImageView) {
        view.tag = url
        view.setImageDrawable(null)
        cache.get(url)?.let { view.setImageBitmap(it); return }
        pool.execute {
            try {
                val bmp = URL(url).openStream().use { BitmapFactory.decodeStream(it) }
                if (bmp != null) {
                    cache.put(url, bmp)
                    main.post { if (view.tag == url) view.setImageBitmap(bmp) }
                }
            } catch (_: Exception) {
            }
        }
    }
}
