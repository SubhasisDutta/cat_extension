package com.fatorangecat.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.fatorangecat.core.TimerLogic
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore by preferencesDataStore(name = "settings")

data class CatSettings(
    val workMinutes: Int = TimerLogic.DEFAULT_WORK_MINUTES,
    val enabled: Boolean = true,
)

class SettingsRepository(private val context: Context) {

    val flow: Flow<CatSettings> = context.settingsDataStore.data.map { prefs ->
        CatSettings(
            workMinutes = TimerLogic.clampWorkMinutes(
                prefs[KEY_WORK_MINUTES] ?: TimerLogic.DEFAULT_WORK_MINUTES,
            ),
            enabled = prefs[KEY_ENABLED] ?: true,
        )
    }

    suspend fun current(): CatSettings = flow.first()

    suspend fun setWorkMinutes(value: Int) {
        val clamped = TimerLogic.clampWorkMinutes(value)
        context.settingsDataStore.edit { it[KEY_WORK_MINUTES] = clamped }
    }

    suspend fun setEnabled(value: Boolean) {
        context.settingsDataStore.edit { it[KEY_ENABLED] = value }
    }

    private companion object {
        val KEY_WORK_MINUTES = intPreferencesKey("work_minutes")
        val KEY_ENABLED = booleanPreferencesKey("enabled")
    }
}
