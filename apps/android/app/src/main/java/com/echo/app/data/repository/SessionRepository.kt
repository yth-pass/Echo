package com.echo.app.data.repository

import com.echo.app.data.api.EchoApi
import com.echo.app.data.api.dto.MessageDto
import com.echo.app.data.api.dto.SessionDto
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SessionRepository @Inject constructor(
    private val api: EchoApi,
) {
    suspend fun getSessions(): Result<List<SessionDto>> {
        return try {
            val res = api.getSessions()
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!.items)
            } else {
                Result.failure(apiError(res, "Sessions fetch failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getMessages(sessionId: String): Result<List<MessageDto>> {
        return try {
            val res = api.getMessages(sessionId)
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!.items)
            } else {
                Result.failure(apiError(res, "Messages fetch failed"))
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
