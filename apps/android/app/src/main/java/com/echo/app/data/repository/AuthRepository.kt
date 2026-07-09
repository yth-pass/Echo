package com.echo.app.data.repository

import com.echo.app.data.api.EchoApi
import com.echo.app.data.api.auth.AuthInterceptor
import com.echo.app.data.api.dto.AuthResponse
import com.echo.app.data.api.dto.LoginRequest
import com.echo.app.data.api.dto.RegisterRequest
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: EchoApi,
    private val authInterceptor: AuthInterceptor,
) {
    fun saveToken(token: String) {
        authInterceptor.saveToken(token)
    }

    fun getToken(): String? = authInterceptor.getToken()

    fun logout() {
        authInterceptor.clearToken()
    }

    fun isLoggedIn(): Boolean = !authInterceptor.getToken().isNullOrBlank()

    suspend fun register(
        displayName: String,
        email: String,
        phone: String,
        password: String,
    ): Result<AuthResponse> {
        return try {
            val res = api.register(
                RegisterRequest(
                    phone = phone,
                    email = email.ifBlank { null },
                    password = password,
                    displayName = displayName.ifBlank { null },
                ),
            )
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                Result.failure(apiError(res, "Register failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun login(identifier: String, password: String): Result<AuthResponse> {
        return try {
            val res = api.login(LoginRequest(identifier = identifier.trim(), password = password))
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                Result.failure(apiError(res, "Login failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun apiError(res: Response<*>, fallback: String): Exception {
        val body = res.errorBody()?.string()?.trim()
        val message = when {
            !body.isNullOrBlank() -> body
            else -> "$fallback (${res.code()})"
        }
        return Exception(message)
    }
}
