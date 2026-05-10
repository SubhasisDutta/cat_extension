package com.fatorangecat.data

import android.content.Context
import com.fatorangecat.CatApplication

// Tiny manual DI container — held by CatApplication, accessed by Activity /
// Service. Keeps things obvious without pulling in Hilt for one app.
class AppContainer(context: Context) {
    val settings: SettingsRepository = SettingsRepository(context)
    val state: StateRepository = StateRepository(context)
}

val Context.appContainer: AppContainer
    get() = (applicationContext as CatApplication).container
