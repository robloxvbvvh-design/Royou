package com.royou.keyboard

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast

/** Прозрачное окно: сразу показывает системный запрос микрофона и закрывается. */
class MicPermissionActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            finish(); return
        }
        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 1)
    }

    override fun onRequestPermissionsResult(code: Int, perms: Array<out String>, res: IntArray) {
        super.onRequestPermissionsResult(code, perms, res)
        val ok = res.isNotEmpty() && res[0] == PackageManager.PERMISSION_GRANTED
        if (ok) {
            Toast.makeText(this, "Микрофон разрешён. Нажмите 🎤 на клавиатуре.", Toast.LENGTH_LONG).show()
        } else {
            // Запрос заблокирован системой — открываем настройки приложения, где можно включить вручную.
            Toast.makeText(this, "Откройте «Разрешения» → «Микрофон» → «Разрешить»", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        }
        finish()
    }
}
