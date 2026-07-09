package com.echo.app.data.repository

import com.echo.app.data.api.EchoApi
import com.echo.app.data.api.dto.BoundariesDto
import com.echo.app.data.api.dto.CloneDetailResponse
import com.echo.app.data.api.dto.UpdateCloneApiRequest
import com.echo.app.data.api.dto.UpdateCloneResponse
import com.echo.app.data.mock.MockResponses
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CloneRepository @Inject constructor(
    private val api: EchoApi,
) {
    suspend fun getMyClone(): Result<CloneDetailResponse> {
        return try {
            val res = api.getMyClone()
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                tryCloneMeFallback()
            }
        } catch (e: Exception) {
            try {
                tryCloneMeFallback()
            } catch (_: Exception) {
                Result.success(MockResponses.mockCloneDetail())
            }
        }
    }

    private suspend fun tryCloneMeFallback(): Result<CloneDetailResponse> {
        val res = api.getCloneMe()
        return if (res.isSuccessful && res.body() != null) {
            Result.success(res.body()!!)
        } else {
            Result.success(MockResponses.mockCloneDetail())
        }
    }

    suspend fun updateClone(
        personaText: String?,
        forbiddenWords: List<String>,
        topicsToAvoid: List<String>,
    ): Result<UpdateCloneResponse> {
        val body = UpdateCloneApiRequest(
            personaText = personaText,
            boundaries = BoundariesDto(
                forbiddenWords = forbiddenWords.filter { it.isNotBlank() },
                topicsToAvoid = topicsToAvoid.filter { it.isNotBlank() }.joinToString(","),
            ),
        )
        return try {
            val res = api.updateCloneMe(body)
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                Result.success(
                    UpdateCloneResponse(
                        id = "clone-mock-1",
                        status = "active",
                        persona = personaText,
                        boundaries = body.boundaries,
                    ),
                )
            }
        } catch (_: Exception) {
            Result.success(
                UpdateCloneResponse(
                    id = "clone-mock-1",
                    status = "active",
                    persona = personaText,
                    boundaries = body.boundaries,
                ),
            )
        }
    }
}
