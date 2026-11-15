package com.royou.keyboard

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.text.Editable
import android.text.TextWatcher
import android.view.inputmethod.InputMethodManager
import android.widget.*

class SettingsActivity : Activity() {

    private lateinit var prefs: Prefs
    private lateinit var langInfo: TextView
    private lateinit var micInfo: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        val p = dp(20)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(p, p, p, p) }

        root.addView(TextView(this).apply { text = "Royou Клавиатура"; textSize = 26f; typeface = Typeface.DEFAULT_BOLD })
        root.addView(TextView(this).apply {
            text = "Шаг 1 — включите клавиатуру, шаг 2 — выберите её для ввода."
            setPadding(0, dp(8), 0, dp(12))
        })
        root.addView(Button(this).apply {
            text = "1. Включить в настройках"
            setOnClickListener { startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)) }
        })
        root.addView(Button(this).apply {
            text = "2. Выбрать клавиатуру"
            setOnClickListener { (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).showInputMethodPicker() }
        })

        root.addView(section("Языки (${Languages.all.size} доступно)"))
        langInfo = TextView(this)
        root.addView(langInfo)
        root.addView(Button(this).apply { text = "Выбрать языки клавиатуры"; setOnClickListener { pickLanguages() } })
        updateLangInfo()

        root.addView(section("Голосовой ввод"))
        micInfo = TextView(this)
        root.addView(micInfo)
        root.addView(Button(this).apply { text = "Разрешить микрофон"; setOnClickListener { askMic() } })
        root.addView(TextView(this).apply {
            text = "Кнопка 🎤 на панели клавиатуры диктует на текущем языке. Работает через службу распознавания речи Android (Google); поддержка языков зависит от неё."
            textSize = 12f
        })

        root.addView(section("GIF"))
        root.addView(TextView(this).apply {
            text = "Нужен бесплатный ключ GIPHY API (developers.giphy.com → Create an App)."; textSize = 12f
        })
        root.addView(EditText(this).apply {
            hint = "GIPHY API key"; setText(prefs.giphyKey); setSingleLine()
            addTextChangedListener(object : TextWatcher {
                override fun afterTextChanged(s: Editable?) { prefs.giphyKey = s?.toString().orEmpty() }
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            })
        })
        root.addView(Button(this).apply {
            text = "Открыть developers.giphy.com"
            setOnClickListener { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://developers.giphy.com/"))) }
        })

        root.addView(section("Внешний вид и ввод"))
        root.addView(switch("Тёмная тема", prefs.dark) { prefs.dark = it })
        root.addView(switch("Вибрация при нажатии", prefs.haptic) { prefs.haptic = it })
        root.addView(switch("Заглавная буква в начале предложения", prefs.autoCap) { prefs.autoCap = it })
        val label = TextView(this).apply { text = "Высота клавиш: ${prefs.keyHeight} dp" }
        root.addView(label)
        root.addView(SeekBar(this).apply {
            max = 30; progress = prefs.keyHeight - 40
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(s: SeekBar, v: Int, user: Boolean) {
                    prefs.keyHeight = 40 + v; label.text = "Высота клавиш: ${40 + v} dp"
                }
                override fun onStartTrackingTouch(s: SeekBar) {}
                override fun onStopTrackingTouch(s: SeekBar) {}
            })
        })

        root.addView(section("Буфер обмена"))
        root.addView(switch("Запоминать историю копирования", prefs.clipEnabled) { prefs.clipEnabled = it })
        root.addView(Button(this).apply {
            text = "Очистить историю"
            setOnClickListener { prefs.clips.clear(); Toast.makeText(context, "Очищено", Toast.LENGTH_SHORT).show() }
        })

        root.addView(section("Перевод"))
        root.addView(TextView(this).apply {
            text = "Кнопка 🌍 переводит выделенный текст (или всё поле) на выбранный язык. Текст отправляется в сервис Google Translate только по нажатию «Перевести»."
            textSize = 12f
        })

        root.addView(section("Проверка"))
        root.addView(EditText(this).apply { hint = "Нажмите сюда и пишите…" })

        setContentView(ScrollView(this).apply { addView(root) })
        updateMicInfo()
        if (intent.getBooleanExtra("mic", false)) askMic()
    }

    private fun pickLanguages() {
        val all = Languages.all
        val enabled = prefs.langs.toMutableSet()
        val checked = BooleanArray(all.size) { all[it].code in enabled }
        AlertDialog.Builder(this)
            .setTitle("Языки клавиатуры")
            .setMultiChoiceItems(all.map { "${it.name} (${it.code})" }.toTypedArray(), checked) { _, i, on -> checked[i] = on }
            .setPositiveButton("Готово") { _, _ ->
                prefs.langs = all.filterIndexed { i, _ -> checked[i] }.map { it.code }.ifEmpty { listOf("en") }
                updateLangInfo()
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun updateLangInfo() {
        langInfo.text = "Включено: " + prefs.langs.joinToString(", ") { Languages.byCode(it).name } +
            "\nПереключение — кнопка 🌐 (долгое нажатие — все языки)."
    }

    private fun askMic() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            startActivity(Intent(this, MicPermissionActivity::class.java))
    }

    override fun onResume() {
        super.onResume()
        updateMicInfo()
    }

    private fun updateMicInfo() {
        val ok = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        micInfo.text = if (ok) "Микрофон: разрешён ✔" else "Микрофон: нет разрешения"
    }

    private fun section(t: String) = TextView(this).apply {
        text = t; textSize = 18f; typeface = Typeface.DEFAULT_BOLD; setPadding(0, dp(22), 0, dp(8))
    }

    private fun switch(t: String, v: Boolean, onChange: (Boolean) -> Unit) = Switch(this).apply {
        text = t; isChecked = v; setPadding(0, dp(6), 0, dp(6))
        setOnCheckedChangeListener { _, c -> onChange(c) }
    }

    private fun dp(v: Int) = Ui.dp(this, v)
}
