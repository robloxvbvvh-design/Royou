package com.royou.keyboard

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import android.widget.*

class SettingsActivity : Activity() {

    private lateinit var prefs: Prefs

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        val p = dp(20)

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(p, p, p, p) }

        root.addView(TextView(this).apply {
            text = "Royou Клавиатура"; textSize = 26f; typeface = Typeface.DEFAULT_BOLD
        })
        root.addView(TextView(this).apply {
            text = "1. Включите клавиатуру, 2. выберите её как основную."
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

        root.addView(section("Настройки"))
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

        root.addView(section("Проверка"))
        root.addView(EditText(this).apply { hint = "Нажмите сюда и пишите…" })

        setContentView(ScrollView(this).apply { addView(root) })
    }

    private fun section(t: String) = TextView(this).apply {
        text = t; textSize = 18f; typeface = Typeface.DEFAULT_BOLD; setPadding(0, dp(20), 0, dp(8))
    }

    private fun switch(t: String, v: Boolean, onChange: (Boolean) -> Unit) = Switch(this).apply {
        text = t; isChecked = v; setPadding(0, dp(6), 0, dp(6))
        setOnCheckedChangeListener { _, c -> onChange(c) }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
