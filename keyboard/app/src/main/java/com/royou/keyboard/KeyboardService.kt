package com.royou.keyboard

import android.inputmethodservice.InputMethodService
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager

class KeyboardService : InputMethodService(), KeyboardView.Listener {

    private var view: KeyboardView? = null
    private lateinit var prefs: Prefs

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
    }

    override fun onCreateInputView(): View = KeyboardView(this, this).also { view = it }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        view?.rebuild() // подхватить настройки
        updateAutoCap(info)
    }

    private fun updateAutoCap(info: EditorInfo? = currentInputEditorInfo) {
        val v = view ?: return
        if (!prefs.autoCap || info == null || info.inputType and InputType.TYPE_MASK_CLASS == InputType.TYPE_NULL) return
        val caps = currentInputConnection?.getCursorCapsMode(info.inputType) ?: 0
        v.setShift(caps != 0)
    }

    override fun onText(text: String) {
        currentInputConnection?.commitText(text, 1)
        updateAutoCap()
    }

    override fun onDelete() {
        val ic = currentInputConnection ?: return
        if (!ic.getSelectedText(0).isNullOrEmpty()) ic.commitText("", 1)
        else ic.deleteSurroundingText(1, 0)
        updateAutoCap()
    }

    override fun onEnter() {
        val info = currentInputEditorInfo
        val ic = currentInputConnection ?: return
        val action = (info?.imeOptions ?: 0) and EditorInfo.IME_MASK_ACTION
        val noEnterAction = (info?.imeOptions ?: 0) and EditorInfo.IME_FLAG_NO_ENTER_ACTION != 0
        if (!noEnterAction && action != EditorInfo.IME_ACTION_NONE && action != EditorInfo.IME_ACTION_UNSPECIFIED) {
            ic.performEditorAction(action)
        } else {
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER))
        }
        updateAutoCap()
    }

    override fun onPickIme() {
        (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).showInputMethodPicker()
    }
}
