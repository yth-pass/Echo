package com.echo.app.data.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.echo.app.MainActivity
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Firebase Cloud Messaging service for Echo (REQ-10).
 *
 * Handles token refresh (sends to API on new token) and incoming
 * notification display.
 */
class EchoFirebaseService : FirebaseMessagingService() {

    companion object {
        private const val CHANNEL_ID = "echo_default"
        private const val CHANNEL_NAME = "Echo 通知"
        private const val CHANNEL_DESC = "匹配推荐、接力请求等通知"
    }

    // -------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    /**
     * Called when a new FCM token is generated.
     * Posts the token to the Echo API for server-side push delivery.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        CoroutineScope(Dispatchers.IO).launch {
            registerTokenWithApi(token)
        }
    }

    /**
     * Called when a push message arrives while the app is in the foreground.
     * Displays a system notification with title/body and tap action.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val title = message.notification?.title
            ?: getLocalizedTitle(message.data["type"])
        val body = message.notification?.body
            ?: getLocalizedBody(message.data["type"])

        val dataPayload = message.data["payload"] ?: "{}"
        showNotification(title, body, dataPayload)
    }

    // -------------------------------------------------------------------
    // Notification display
    // -------------------------------------------------------------------

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESC
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun showNotification(title: String, body: String, dataPayload: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("push_payload", dataPayload)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notificationId = System.currentTimeMillis().toInt()
        manager.notify(notificationId, notification)
    }

    // -------------------------------------------------------------------
    // Token registration
    // -------------------------------------------------------------------

    private fun getLocalizedTitle(type: String?): String = when (type) {
        "handoff" -> "🔔 真人接力请求"
        "handoff_accepted" -> "🤝 双方同意接力"
        "match_push" -> "👋 新匹配推荐"
        else -> "Echo"
    }

    private fun getLocalizedBody(type: String?): String = when (type) {
        "handoff" -> "对方想和你开启真人交流，来回应吧"
        "handoff_accepted" -> "你们已成功互选，可以交换联系方式了"
        "match_push" -> "有新的分身匹配，去看看是否合拍吧"
        else -> "你有一条新消息"
    }

    /**
     * POST the FCM token to the Echo API.
     * Requires a valid auth token — if not available the call is skipped.
     */
    private suspend fun registerTokenWithApi(token: String) {
        try {
            val prefs = getSharedPreferences("echo_prefs", Context.MODE_PRIVATE)
            val accessToken = prefs.getString("access_token", null) ?: return
            val baseUrl = prefs.getString("api_base_url", "https://api.echo.local") ?: return

            val url = URL("$baseUrl/v1/push/register")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Authorization", "Bearer $accessToken")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true

            val json = JSONObject().apply {
                put("token", token)
                put("platform", "android")
            }
            conn.outputStream.use { os ->
                os.write(json.toString().toByteArray())
            }

            val code = conn.responseCode
            conn.disconnect()

            android.util.Log.i("EchoFCM", "Token registration result: $code")
        } catch (e: Exception) {
            android.util.Log.w("EchoFCM", "Token registration failed", e)
        }
    }
}
