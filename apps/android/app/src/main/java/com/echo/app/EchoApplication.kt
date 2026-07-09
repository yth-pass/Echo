package com.echo.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * Hilt entry point for Echo (REQ-04).
 *
 * Enables dependency injection for the entire application graph.
 */
@HiltAndroidApp
class EchoApplication : Application()
