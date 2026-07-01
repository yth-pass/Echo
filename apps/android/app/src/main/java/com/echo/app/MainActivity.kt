package com.echo.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.echo.app.ui.navigation.EchoNavHost
import com.echo.app.ui.theme.EchoTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Main entry point for the Echo Android app (REQ-04).
 *
 * Hosts the 5-tab navigation scaffold inside an Echo-themed Material 3 surface.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            EchoTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    EchoNavHost()
                }
            }
        }
    }
}
