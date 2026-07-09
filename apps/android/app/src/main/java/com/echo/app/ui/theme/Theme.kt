package com.echo.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Echo brand palette
private val EchoPink = Color(0xFFE91E63)
private val EchoPinkDark = Color(0xFFC2185B)
private val EchoLightPink = Color(0xFFFCE4EC)

private val LightColorScheme = lightColorScheme(
    primary = EchoPink,
    onPrimary = Color.White,
    primaryContainer = EchoLightPink,
    secondary = Color(0xFF7C4DFF),
    background = Color(0xFFFFFBFE),
    surface = Color(0xFFFFFBFE),
    error = Color(0xFFB00020),
)

private val DarkColorScheme = darkColorScheme(
    primary = EchoPinkDark,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF4A0028),
    secondary = Color(0xFFB388FF),
    background = Color(0xFF121212),
    surface = Color(0xFF1E1E1E),
    error = Color(0xFFCF6679),
)

@Composable
fun EchoTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }
    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
