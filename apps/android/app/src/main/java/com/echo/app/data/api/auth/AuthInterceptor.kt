package com.echo.app.data.api.auth

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Adds the Bearer token to every API request.
 *
 * Reads the access token from SharedPreferences; skips the header
 * for unauthenticated endpoints (register / login).
 */
@Singleton
class AuthInterceptor @Inject constructor(
    @ApplicationContext private val context: Context,
) : Interceptor {

    companion object {
        private const val PREFS_NAME = "echo_prefs"
        private const val KEY_ACCESS_TOKEN = "access_token"

        /** Public paths that do not require an auth header. */
        private val SKIP_PATHS = setOf("/v1/auth/register", "/v1/auth/login")
    }

    private val prefs: SharedPreferences
        get() = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val path = original.url.encodedPath

        val token = prefs.getString(KEY_ACCESS_TOKEN, null)
        if (token.isNullOrBlank() || SKIP_PATHS.any { path.endsWith(it) }) {
            return chain.proceed(original)
        }

        val request = original.newBuilder()
            .header("Authorization", "Bearer $token")
            .build()
        return chain.proceed(request)
    }

    /**
     * Persist a new access token (called after login / register / token refresh).
     */
    fun saveToken(token: String) {
        prefs.edit().putString(KEY_ACCESS_TOKEN, token).apply()
    }

    fun clearToken() {
        prefs.edit().remove(KEY_ACCESS_TOKEN).apply()
    }

    fun getToken(): String? = prefs.getString(KEY_ACCESS_TOKEN, null)
}
