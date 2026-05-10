package com.fatorangecat.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val CatOrange = Color(0xFFEF8B2A)
private val CatOrangeDark = Color(0xFFC46410)
private val CatBrown = Color(0xFF7A3A08)
private val CatBelly = Color(0xFFFFE6C4)
private val Paper = Color(0xFFFFF8EF)
private val Ink = Color(0xFF1F1F1F)

private val FatOrangeCatColors = lightColorScheme(
    primary = CatOrange,
    onPrimary = Color.White,
    primaryContainer = CatOrangeDark,
    onPrimaryContainer = Color.White,
    secondary = CatBrown,
    onSecondary = Color.White,
    background = Paper,
    onBackground = Ink,
    surface = Paper,
    onSurface = Ink,
    surfaceVariant = CatBelly,
    onSurfaceVariant = CatBrown,
)

@Composable
fun FatOrangeCatTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = FatOrangeCatColors,
        content = content,
    )
}
