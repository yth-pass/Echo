package com.echo.app.data.api.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class FeedResponse(
    @Json(name = "posts") val posts: List<FeedPost>,
    @Json(name = "next_cursor") val nextCursor: String?,
)

@JsonClass(generateAdapter = true)
data class FeedPost(
    @Json(name = "id") val id: String,
    @Json(name = "content") val content: String,
    @Json(name = "clone_id") val cloneId: String,
    @Json(name = "display_name") val displayName: String?,
    @Json(name = "published_at") val publishedAt: String?,
)
