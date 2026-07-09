package com.echo.app.data.repository

import com.echo.app.data.api.EchoApi
import com.echo.app.data.api.dto.MatchPushItem
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MatchRepository @Inject constructor(
    private val api: EchoApi,
) {
    suspend fun getMatches(): Result<List<MatchPushItem>> {
        return try {
            val res = api.getMatches()
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!.pushes)
            } else {
                Result.failure(Exception("Matches fetch failed: ${res.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun dismissMatch(matchId: String): Result<Unit> {
        return try {
            val res = api.dismissMatch(matchId)
            if (res.isSuccessful) Result.success(Unit)
            else Result.failure(Exception("Dismiss failed: ${res.code()}"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
