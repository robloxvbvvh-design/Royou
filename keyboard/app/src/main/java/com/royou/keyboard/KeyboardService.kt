package com.royou.keyboard

import android.Manifest
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.inputmethodservice.InputMethodService
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.text.InputType
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputContentInfo
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.io.File

class KeyboardService : InputMethodService(), KeyboardView.Listener {

    lateinit var prefs: Prefs
    val main = Handler(Looper.getMainLooper())
    var lang: Lang = Languages.byCode("en")
        private set

    private var keys: KeyboardView? = null
    private var content: FrameLayout? = null
    private var toolbar: LinearLayout? = null
    private val toolButtons = HashMap<String, TextView>()
    private var panel: String? = null

    private var recognizer: SpeechRecognizer? = null
    private var listening = false
    private var clipboard: ClipboardManager? = null
    private val clipListener = ClipboardManager.OnPrimaryClipChangedListener {
        if (!prefs.clipEnabled) return@OnPrimaryClipChangedListener
        val clip = clipboard?.primaryClip ?: return@OnPrimaryClipChangedListener
        if (clip.itemCount == 0 || clip.description.hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN).not()) return@OnPrimaryClipChangedListener
        clip.getItemAt(0).text?.toString()?.let { prefs.clips.add(it) }
    }

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
        pickInitialLang()
        clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard?.addPrimaryClipChangedListener(clipListener)
    }

    override fun onDestroy() {
        clipboard?.removePrimaryClipChangedListener(clipListener)
        stopVoice()
        super.onDestroy()
    }

    private fun pickInitialLang() {
        val enabled = prefs.langs
        val saved = prefs.currentLang
        lang = Languages.byCode(if (saved in enabled) saved else enabled.first())
    }

    /* ---------------------------- Интерфейс ---------------------------- */

    fun panelHeight() = Ui.dp(this, prefs.keyHeight) * 5 + Ui.dp(this, 16)

    override fun onCreateInputView(): View {
        val dark = prefs.dark
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Ui.bg(dark))
        }
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        toolbar = bar
        toolButtons.clear()
        val items = listOf("emoji" to "🙂", "gif" to "GIF", "clip" to "📋", "edit" to "✏️",
            "translate" to "🌍", "voice" to "🎤", "settings" to "⚙️")
        for ((id, label) in items) {
            val b = Ui.btn(this, label, dark, 1f, color = Ui.bg(dark), size = if (id == "gif") 13f else 18f) {
                when (id) {
                    "voice" -> toggleVoice()
                    "settings" -> openSettings()
                    else -> showPanel(id)
                }
            }
            toolButtons[id] = b
            bar.addView(b)
        }
        root.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 42)))

        val frame = FrameLayout(this)
        content = frame
        root.addView(frame, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        keys = KeyboardView(this, this).also { it.lang = lang }
        showPanel(null)
        return root
    }

    fun showPanel(name: String?) {
        val frame = content ?: return
        panel = if (name == panel) null else name
        frame.removeAllViews()
        val lp = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, panelHeight())
        when (panel) {
            null -> keys?.let { (it.parent as? ViewGroup)?.removeView(it); frame.addView(it) }
            "emoji" -> frame.addView(EmojiPanel(this), lp)
            "clip" -> frame.addView(ClipboardPanel(this), lp)
            "edit" -> frame.addView(EditPanel(this), lp)
            "translate" -> frame.addView(TranslatePanel(this), lp)
            "gif" -> frame.addView(GifPanel(this), lp)
            "lang" -> frame.addView(LangPicker(this, "Язык клавиатуры", lang.code) { setLang(it); showPanel(null) }, lp)
        }
        refreshToolbar()
    }

    private fun refreshToolbar() {
        val dark = prefs.dark
        for ((id, b) in toolButtons) {
            val on = id == panel || (id == "voice" && listening)
            val color = when {
                id == "voice" && listening -> 0xFFE53935.toInt()
                on -> Ui.ACCENT
                else -> Ui.bg(dark)
            }
            b.background = Ui.keyBg(this, color, Ui.pressedColor(dark))
            b.setTextColor(if (on) Color.WHITE else Ui.fg(dark))
        }
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        if (!restarting) {
            panel = "x"; showPanel(null) // вернуться к клавишам
        }
        keys?.rebuild()
        updateAutoCap(info)
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        stopVoice()
        super.onFinishInputView(finishingInput)
    }

    /* ---------------------------- Ввод текста ---------------------------- */

    fun ic(): InputConnection? = currentInputConnection

    fun commit(text: String) {
        currentInputConnection?.commitText(text, 1)
        updateAutoCap()
    }

    fun sendKey(code: Int, meta: Int = 0) {
        val c = currentInputConnection ?: return
        val t = SystemClock.uptimeMillis()
        c.sendKeyEvent(KeyEvent(t, t, KeyEvent.ACTION_DOWN, code, 0, meta))
        c.sendKeyEvent(KeyEvent(t, t, KeyEvent.ACTION_UP, code, 0, meta))
    }

    private fun updateAutoCap(info: EditorInfo? = currentInputEditorInfo) {
        val v = keys ?: return
        if (!prefs.autoCap || info == null || info.inputType and InputType.TYPE_MASK_CLASS == InputType.TYPE_NULL) return
        val caps = currentInputConnection?.getCursorCapsMode(info.inputType) ?: 0
        v.setShift(caps != 0)
    }

    override fun onText(text: String) = commit(text)

    override fun onDelete() {
        val c = currentInputConnection ?: return
        if (!c.getSelectedText(0).isNullOrEmpty()) c.commitText("", 1) else c.deleteSurroundingText(1, 0)
        updateAutoCap()
    }

    override fun onEnter() {
        val info = currentInputEditorInfo
        val c = currentInputConnection ?: return
        val opts = info?.imeOptions ?: 0
        val action = opts and EditorInfo.IME_MASK_ACTION
        if (opts and EditorInfo.IME_FLAG_NO_ENTER_ACTION == 0 &&
            action != EditorInfo.IME_ACTION_NONE && action != EditorInfo.IME_ACTION_UNSPECIFIED) {
            c.performEditorAction(action)
        } else sendKey(KeyEvent.KEYCODE_ENTER)
        updateAutoCap()
    }

    /* ------------------------------ Языки ------------------------------ */

    fun setLang(l: Lang) {
        lang = l
        prefs.currentLang = l.code
        if (l.code !in prefs.langs) prefs.langs = prefs.langs + l.code
        keys?.lang = l
    }

    override fun onCycleLang() {
        val enabled = prefs.langs
        val i = enabled.indexOf(lang.code)
        setLang(Languages.byCode(enabled[(i + 1) % enabled.size]))
        if (listening) restartVoice()
    }

    override fun onLangPanel() = showPanel("lang")

    /* ----------------------------- GIF/картинки ----------------------------- */

    fun sendGif(file: File, pageUrl: String): Boolean {
        val c = currentInputConnection ?: return false
        return try {
            val uri = Uri.parse("content://com.royou.keyboard.gifs/${file.name}")
            val info = InputContentInfo(uri, ClipDescription("GIF", arrayOf("image/gif")), Uri.parse(pageUrl))
            c.commitContent(info, InputConnection.INPUT_CONTENT_GRANT_READ_URI_PERMISSION, null)
        } catch (e: Exception) { false }
    }

    /* ----------------------------- Голосовой ввод ----------------------------- */

    private fun toggleVoice() {
        if (listening) { stopVoice(); return }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            toast("Разрешите доступ к микрофону в появившемся окне")
            startActivity(Intent(this, MicPermissionActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            toast("На устройстве нет службы распознавания речи (нужно приложение Google)")
            return
        }
        listening = true
        refreshToolbar()
        startRecognizer()
    }

    private fun startRecognizer() {
        recognizer?.destroy()
        val r = SpeechRecognizer.createSpeechRecognizer(this)
        recognizer = r
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(p: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v: Float) {}
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(t: Int, p: Bundle?) {}
            override fun onPartialResults(b: Bundle?) {
                val t = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
                currentInputConnection?.setComposingText(t, 1)
            }
            override fun onResults(b: Bundle?) {
                val t = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                if (!t.isNullOrEmpty()) currentInputConnection?.commitText("$t ", 1)
                else currentInputConnection?.finishComposingText()
                if (listening) main.postDelayed({ if (listening) startRecognizer() }, 150)
            }
            override fun onError(e: Int) {
                currentInputConnection?.finishComposingText()
                if (!listening) return
                if (e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                    main.postDelayed({ if (listening) startRecognizer() }, 150)
                } else {
                    toast(when (e) {
                        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Нет сети для распознавания речи"
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Нет разрешения на микрофон"
                        else -> "Ошибка распознавания речи ($e). Язык «${lang.name}» может не поддерживаться."
                    })
                    stopVoice()
                }
            }
        })
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Languages.voiceTag(lang))
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
        }
        r.startListening(i)
    }

    private fun restartVoice() { if (listening) startRecognizer() }

    private fun stopVoice() {
        listening = false
        recognizer?.destroy(); recognizer = null
        currentInputConnection?.finishComposingText()
        if (toolbar != null) refreshToolbar()
    }

    /* -------------------------------- Прочее -------------------------------- */

    fun openSettings() {
        startActivity(Intent(this, SettingsActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun toast(m: String) = Toast.makeText(this, m, Toast.LENGTH_LONG).show()
}
