package com.echo.app.data.repository

import com.echo.app.data.api.EchoApi
import com.echo.app.data.api.dto.FeedPost
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FeedRepository @Inject constructor(
    private val api: EchoApi,
) {
    suspend fun getFeed(cursor: String? = null): Result<Pair<List<FeedPost>, String?>> {
        return try {
            val res = api.getFeed(cursor = cursor)
            if (res.isSuccessful && res.body() != null) {
                val body = res.body()!!
                Result.success(Pair(body.posts, body.nextCursor))
            } else {
                Result.failure(Exception("Feed fetch failed: ${res.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
