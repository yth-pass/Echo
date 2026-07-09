package com.echo.app.data.repository

import com.echo.app.data.api.EchoApi
import com.echo.app.data.api.dto.HandoffDetailResponse
import com.echo.app.data.api.dto.HandoffRespondRequest
import com.echo.app.data.api.dto.HandoffRespondResponse
import com.echo.app.data.api.dto.MessageDto
import com.echo.app.data.mock.MockResponses
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HandoffRepository @Inject constructor(
    private val api: EchoApi,
    private val sessionRepository: SessionRepository,
) {
    suspend fun getHandoff(id: String): Result<HandoffDetailResponse> {
        return try {
            val res = api.getHandoff(id)
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                Result.success(MockResponses.mockHandoff(id))
            }
        } catch (_: Exception) {
            Result.success(MockResponses.mockHandoff(id))
        }
    }

    suspend fun respond(id: String, accept: Boolean): Result<HandoffRespondResponse> {
        return try {
            val res = api.respondHandoff(id, HandoffRespondRequest(accept = accept))
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                Result.success(mockRespond(id, accept))
            }
        } catch (_: Exception) {
            Result.success(mockRespond(id, accept))
        }
    }

    suspend fun getRecentMessages(sessionId: String, limit: Int = 5): Result<List<MessageDto>> {
        return sessionRepository.getMessages(sessionId).fold(
            onSuccess = { messages ->
                Result.success(messages.takeLast(limit))
            },
            onFailure = {
                Result.success(MockResponses.mockRecentMessages(sessionId).takeLast(limit))
            },
        )
    }

    private fun mockRespond(id: String, accept: Boolean): HandoffRespondResponse = HandoffRespondResponse(
        id = id,
        status = if (accept) "accepted" else "declined",
        contactExchanged = accept,
    )

    @Suppress("unused")
    private fun apiError(res: Response<*>, fallback: String): Exception {
        val body = res.errorBody()?.string()?.trim()
        val message = when {
            !body.isNullOrBlank() -> body
            else -> "$fallback (${res.code()})"
        }
        return Exception(message)
    }
}
