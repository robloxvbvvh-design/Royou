package com.royou.keyboard

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.ExtractedTextRequest
import android.widget.*
import java.io.File
import kotlin.math.abs

private fun Context.dp(v: Int) = Ui.dp(this, v)

private fun cell(s: KeyboardService, text: String, sizeSp: Float, highlight: Boolean = false, heightDp: Int = 40): TextView =
    TextView(s).apply {
        this.text = text
        textSize = sizeSp
        gravity = Gravity.CENTER
        setTextColor(Ui.fg(s.prefs.dark))
        if (highlight) background = Ui.shape(s, Ui.specialColor(s.prefs.dark))
        layoutParams = AbsListView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, s.dp(heightDp))
    }

/* ------------------------------ Эмодзи ------------------------------ */

class EmojiPanel(private val s: KeyboardService) : LinearLayout(s) {
    private val dark = s.prefs.dark
    private val grid = GridView(s)
    private val tabs = LinearLayout(s)
    private var items: List<String> = emptyList()
    private var kaomoji = false

    init {
        orientation = VERTICAL
        setBackgroundColor(Ui.bg(dark))
        val icons = listOf("🕘") + Emoji.categories.map { it.first }
        icons.forEachIndexed { i, ic ->
            tabs.addView(TextView(s).apply {
                text = ic; textSize = 22f; gravity = Gravity.CENTER
                setPadding(s.dp(12), 0, s.dp(12), 0)
                setOnClickListener { select(i) }
            }, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.MATCH_PARENT))
        }
        addView(HorizontalScrollView(s).apply {
            isHorizontalScrollBarEnabled = false; addView(tabs)
        }, LayoutParams(LayoutParams.MATCH_PARENT, s.dp(42)))
        grid.setOnItemClickListener { _, _, pos, _ ->
            val e = items[pos]
            s.commit(e)
            s.prefs.emojiRecents.add(e)
        }
        addView(grid, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
        select(if (s.prefs.emojiRecents.get().isEmpty()) 1 else 0)
    }

    private fun select(i: Int) {
        kaomoji = i == Emoji.categories.size
        items = if (i == 0) s.prefs.emojiRecents.get() else Emoji.categories[i - 1].second
        grid.numColumns = if (kaomoji) 2 else 8
        grid.adapter = object : BaseAdapter() {
            override fun getCount() = items.size
            override fun getItem(p: Int) = items[p]
            override fun getItemId(p: Int) = p.toLong()
            override fun getView(p: Int, v: View?, parent: ViewGroup?): View =
                (v as? TextView ?: cell(s, "", if (kaomoji) 15f else 24f)).also { it.text = items[p] }
        }
    }
}

/* --------------------------- Буфер обмена --------------------------- */

class ClipboardPanel(private val s: KeyboardService) : LinearLayout(s) {
    private val dark = s.prefs.dark
    private val list = LinearLayout(s).apply { orientation = VERTICAL }

    init {
        orientation = VERTICAL
        setBackgroundColor(Ui.bg(dark))
        addView(Ui.row(s, s.dp(42),
            Ui.btn(s, "📥 Вставить из буфера", dark, 2f) { s.ic()?.performContextMenuAction(android.R.id.paste) },
            Ui.btn(s, "🗑 Очистить", dark, 1f) { s.prefs.clips.clear(); refresh() }))
        addView(ScrollView(s).apply { addView(list) }, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
        refresh()
    }

    private fun refresh() {
        list.removeAllViews()
        val clips = s.prefs.clips.get()
        if (clips.isEmpty()) {
            list.addView(TextView(s).apply {
                text = if (s.prefs.clipEnabled) "История пуста. Скопируйте текст — он появится здесь.\nНажатие — вставить, долгое — удалить."
                else "История буфера выключена в настройках."
                setTextColor(Ui.fg(dark)); setPadding(s.dp(12), s.dp(16), s.dp(12), 0)
            })
        }
        for (c in clips) {
            list.addView(TextView(s).apply {
                text = c; maxLines = 3; ellipsize = android.text.TextUtils.TruncateAt.END
                setTextColor(Ui.fg(dark)); textSize = 14f
                background = Ui.shape(s, Ui.keyColor(dark))
                setPadding(s.dp(10), s.dp(8), s.dp(10), s.dp(8))
                layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
                    setMargins(s.dp(6), s.dp(3), s.dp(6), s.dp(3))
                }
                setOnClickListener { s.commit(c) }
                setOnLongClickListener { s.prefs.clips.remove(c); refresh(); true }
            })
        }
    }
}

/* --------------------------- Редактирование --------------------------- */

class EditPanel(private val s: KeyboardService) : LinearLayout(s) {
    private val dark = s.prefs.dark

    init {
        orientation = VERTICAL
        setBackgroundColor(Ui.bg(dark))
        val h = (s.panelHeight() - s.dp(8)) / 5
        fun b(t: String, w: Float = 1f, a: () -> Unit) = Ui.btn(s, t, dark, w, size = 13f, onClick = a)
        fun menu(id: Int): () -> Unit = { s.ic()?.performContextMenuAction(id) }

        addView(Ui.row(s, h,
            b("◀") { s.sendKey(KeyEvent.KEYCODE_DPAD_LEFT) }, b("▲") { s.sendKey(KeyEvent.KEYCODE_DPAD_UP) },
            b("▼") { s.sendKey(KeyEvent.KEYCODE_DPAD_DOWN) }, b("▶") { s.sendKey(KeyEvent.KEYCODE_DPAD_RIGHT) },
            b("⇤ Начало", 1.4f) { s.sendKey(KeyEvent.KEYCODE_MOVE_HOME) }, b("Конец ⇥", 1.4f) { s.sendKey(KeyEvent.KEYCODE_MOVE_END) }))
        addView(Ui.row(s, h,
            b("Выделить всё", 1f, menu(android.R.id.selectAll)), b("Копировать", 1f, menu(android.R.id.copy)),
            b("Вырезать", 1f, menu(android.R.id.cut)), b("Вставить", 1f, menu(android.R.id.paste))))
        addView(Ui.row(s, h,
            b("◀ выдел.") { s.sendKey(KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.META_SHIFT_ON) },
            b("выдел. ▶") { s.sendKey(KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.META_SHIFT_ON) },
            b("⌫ слово") { deleteWord() }, b("Очистить поле") { clearAll() }))
        addView(Ui.row(s, h,
            b("ПРОПИСНЫЕ") { transform { it.uppercase() } }, b("строчные") { transform { it.lowercase() } },
            b("Каждое Слово") { transform(::titleCase) }, b("иНВЕРТ") { transform(::invertCase) }))
        addView(Ui.row(s, h,
            b("↶ Отменить") { s.sendKey(KeyEvent.KEYCODE_Z, KeyEvent.META_CTRL_ON) },
            b("↷ Повторить") { s.sendKey(KeyEvent.KEYCODE_Z, KeyEvent.META_CTRL_ON or KeyEvent.META_SHIFT_ON) },
            b("Как в предложении", 1.4f) { transform(::sentenceCase) }))
    }

    private fun deleteWord() {
        val ic = s.ic() ?: return
        val before = ic.getTextBeforeCursor(100, 0)?.toString() ?: return
        var n = before.length
        while (n > 0 && before[n - 1].isWhitespace()) n--
        while (n > 0 && !before[n - 1].isWhitespace()) n--
        ic.deleteSurroundingText(before.length - n, 0)
    }

    private fun clearAll() {
        val ic = s.ic() ?: return
        ic.performContextMenuAction(android.R.id.selectAll)
        ic.commitText("", 1)
    }

    /** Преобразует выделение (или весь текст, если ничего не выделено) и оставляет результат выделенным. */
    private fun transform(f: (String) -> String) {
        val ic = s.ic() ?: return
        var sel = ic.getSelectedText(0)
        if (sel.isNullOrEmpty()) { ic.performContextMenuAction(android.R.id.selectAll); sel = ic.getSelectedText(0) }
        if (sel.isNullOrEmpty()) return
        val r = f(sel.toString())
        ic.commitText(r, 1)
        val et = ic.getExtractedText(ExtractedTextRequest(), 0) ?: return
        val end = et.startOffset + et.selectionEnd
        ic.setSelection(maxOf(0, end - r.length), end)
    }

    private fun titleCase(t: String): String {
        val sb = StringBuilder(); var start = true
        for (ch in t) { sb.append(if (start) ch.titlecaseChar() else ch.lowercaseChar()); start = ch.isWhitespace() }
        return sb.toString()
    }

    private fun invertCase(t: String) = t.map { if (it.isUpperCase()) it.lowercaseChar() else it.uppercaseChar() }.joinToString("")

    private fun sentenceCase(t: String): String {
        val sb = StringBuilder(); var cap = true
        for (ch in t.lowercase()) {
            if (cap && ch.isLetter()) { sb.append(ch.titlecaseChar()); cap = false } else sb.append(ch)
            if (ch == '.' || ch == '!' || ch == '?' || ch == '\n') cap = true
        }
        return sb.toString()
    }
}

/* --------------------------- Выбор языка --------------------------- */

class LangPicker(private val s: KeyboardService, title: String, private val selected: String,
                 private val onPick: (Lang) -> Unit) : LinearLayout(s) {
    init {
        orientation = VERTICAL
        val dark = s.prefs.dark
        setBackgroundColor(Ui.bg(dark))
        addView(TextView(s).apply {
            text = "$title (${Languages.all.size})"; typeface = Typeface.DEFAULT_BOLD
            setTextColor(Ui.fg(dark)); setPadding(s.dp(12), s.dp(8), 0, s.dp(4))
        })
        val enabled = s.prefs.langs
        val grid = GridView(s).apply {
            numColumns = 3
            adapter = object : BaseAdapter() {
                override fun getCount() = Languages.all.size
                override fun getItem(p: Int) = Languages.all[p]
                override fun getItemId(p: Int) = p.toLong()
                override fun getView(p: Int, v: View?, parent: ViewGroup?): View {
                    val l = Languages.all[p]
                    return cell(s, l.name, 14f, highlight = l.code == selected || l.code in enabled, heightDp = 38).also {
                        it.maxLines = 1
                        if (l.code == selected) it.setTypeface(null, Typeface.BOLD)
                    }
                }
            }
            setOnItemClickListener { _, _, p, _ -> onPick(Languages.all[p]) }
        }
        addView(grid, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
    }
}

/* ------------------------------ Перевод ------------------------------ */

class TranslatePanel(private val s: KeyboardService) : LinearLayout(s) {
    private val dark = s.prefs.dark
    private var target = Languages.byCode(s.prefs.translateTo)
    private var result: String? = null
    private var wasSelection = false
    private val status = TextView(s)
    private val resultView = TextView(s)

    init { orientation = VERTICAL; build() }

    private fun build() {
        removeAllViews()
        setBackgroundColor(Ui.bg(dark))
        addView(Ui.row(s, s.dp(46),
            Ui.btn(s, "→ ${target.name}  ▾", dark, 1.3f, size = 14f) {
                removeAllViews()
                addView(LangPicker(s, "Язык перевода", target.code) {
                    target = it; s.prefs.translateTo = it.code; build()
                }, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
            },
            Ui.btn(s, "Перевести", dark, 1f, color = Ui.ACCENT, size = 14f) { translate() }))
        status.apply {
            text = "Выделите текст или переводится всё поле."
            setTextColor(Ui.fg(dark)); textSize = 12f; setPadding(s.dp(10), s.dp(2), s.dp(10), s.dp(2))
        }
        addView(status)
        resultView.apply {
            text = result ?: ""
            setTextColor(Ui.fg(dark)); textSize = 16f; setPadding(s.dp(10), s.dp(4), s.dp(10), s.dp(4))
        }
        addView(ScrollView(s).apply {
            background = Ui.shape(s, Ui.keyColor(dark))
            addView(resultView)
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f).apply { setMargins(s.dp(6), s.dp(2), s.dp(6), s.dp(2)) }
        })
        addView(Ui.row(s, s.dp(46),
            Ui.btn(s, "Заменить", dark) { replace() },
            Ui.btn(s, "Вставить", dark) { result?.let { s.commit(it) } },
            Ui.btn(s, "Копировать", dark) {
                result?.let {
                    (s.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("tr", it))
                }
            }))
    }

    private fun translate() {
        val ic = s.ic() ?: return
        val sel = ic.getSelectedText(0)?.toString()
        wasSelection = !sel.isNullOrEmpty()
        val text = if (wasSelection) sel!! else
            (ic.getTextBeforeCursor(3000, 0)?.toString() ?: "") + (ic.getTextAfterCursor(3000, 0)?.toString() ?: "")
        if (text.isBlank()) { status.text = "Нет текста: напишите его в поле или выделите."; return }
        status.text = "Перевожу…"
        val to = Languages.translateCode(target)
        Thread {
            try {
                val (tr, src) = Translator.translate(text, to)
                s.main.post { result = tr; resultView.text = tr; status.text = "Исходный язык: $src → ${target.name}" }
            } catch (e: Exception) {
                s.main.post { status.text = "Ошибка перевода: проверьте интернет или выберите другой язык." }
            }
        }.start()
    }

    private fun replace() {
        val r = result ?: return
        val ic = s.ic() ?: return
        if (!wasSelection) ic.performContextMenuAction(android.R.id.selectAll)
        ic.commitText(r, 1)
    }
}

/* ------------------------------- GIF ------------------------------- */

class GifPanel(private val s: KeyboardService) : LinearLayout(s) {
    private val dark = s.prefs.dark
    private val status = TextView(s)
    private val grid = GridView(s)
    private var gifs: List<Gif> = emptyList()

    init {
        orientation = VERTICAL
        setBackgroundColor(Ui.bg(dark))
        val chips = LinearLayout(s)
        fun chip(label: String, q: String?) = chips.addView(Ui.btn(s, label, dark, 0f, size = 15f) { search(q) }.also {
            it.layoutParams = LayoutParams(s.dp(64), LayoutParams.MATCH_PARENT).apply { setMargins(s.dp(2), s.dp(3), s.dp(2), s.dp(3)) }
        })
        chip("🔥", null); chip("🔎 поле", "\u0000field")
        listOf("😂" to "funny", "❤️" to "love", "👍" to "thumbs up", "🎉" to "party", "😢" to "sad", "😮" to "wow",
            "👋" to "hello", "💃" to "dance", "🙏" to "thank you", "😡" to "angry", "😴" to "sleepy", "🤦" to "facepalm")
            .forEach { chip(it.first, it.second) }
        addView(HorizontalScrollView(s).apply { isHorizontalScrollBarEnabled = false; addView(chips) },
            LayoutParams(LayoutParams.MATCH_PARENT, s.dp(44)))
        status.apply { setTextColor(Ui.fg(dark)); textSize = 12f; setPadding(s.dp(10), 0, s.dp(10), 0) }
        addView(status)
        grid.numColumns = 3
        grid.horizontalSpacing = s.dp(3); grid.verticalSpacing = s.dp(3)
        grid.setOnItemClickListener { _, _, p, _ -> send(gifs[p]) }
        addView(grid, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
        if (s.prefs.giphyKey.isBlank()) {
            status.text = "Нужен бесплатный ключ GIPHY (developers.giphy.com) — вставьте его в настройках."
            addView(Ui.row(s, s.dp(44), Ui.btn(s, "Открыть настройки", dark, color = Ui.ACCENT) { s.openSettings() }))
        } else search(null)
    }

    private fun search(q: String?) {
        val key = s.prefs.giphyKey
        if (key.isBlank()) { status.text = "Укажите ключ GIPHY в настройках."; return }
        var query = q
        if (q == "\u0000field") {
            query = (s.ic()?.getTextBeforeCursor(60, 0)?.toString() ?: "").trim()
            if (query.isEmpty()) { status.text = "Сначала напишите в поле, что искать."; return }
        }
        status.text = "Загрузка…"
        val lang = s.lang.code.substringBefore('-')
        Thread {
            try {
                val res = Giphy.fetch(key, query, lang)
                s.main.post {
                    gifs = res
                    status.text = if (res.isEmpty()) "Ничего не найдено" else "GIPHY · нажмите, чтобы отправить"
                    grid.adapter = object : BaseAdapter() {
                        override fun getCount() = gifs.size
                        override fun getItem(p: Int) = gifs[p]
                        override fun getItemId(p: Int) = p.toLong()
                        override fun getView(p: Int, v: View?, parent: ViewGroup?): View {
                            val iv = (v as? ImageView) ?: ImageView(s).apply {
                                scaleType = ImageView.ScaleType.CENTER_CROP
                                setBackgroundColor(Ui.specialColor(dark))
                                layoutParams = AbsListView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, s.dp(90))
                            }
                            ImageLoader.load(gifs[p].thumb, iv)
                            return iv
                        }
                    }
                }
            } catch (e: Exception) {
                s.main.post { status.text = "Ошибка: проверьте интернет и ключ GIPHY." }
            }
        }.start()
    }

    private fun send(g: Gif) {
        status.text = "Скачиваю GIF…"
        Thread {
            try {
                val dir = File(s.cacheDir, "gifs").apply { mkdirs() }
                dir.listFiles()?.sortedBy { it.lastModified() }?.dropLast(30)?.forEach { it.delete() }
                val f = File(dir, "g${abs(g.url.hashCode())}.gif")
                if (!f.exists()) java.net.URL(g.url).openStream().use { i -> f.outputStream().use { o -> i.copyTo(o) } }
                s.main.post {
                    if (s.sendGif(f, g.page)) status.text = "Отправлено"
                    else { s.commit(g.page); status.text = "Приложение не принимает GIF — вставлена ссылка." }
                }
            } catch (e: Exception) {
                s.main.post { status.text = "Не удалось скачать GIF." }
            }
        }.start()
    }
}
