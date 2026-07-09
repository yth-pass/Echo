package com.echo.app.data.api.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class MatchListResponse(
    @Json(name = "pushes") val pushes: List<MatchPushItem>,
)

@JsonClass(generateAdapter = true)
data class MatchPushItem(
    @Json(name = "id") val id: String,
    @Json(name = "candidate_user_id") val candidateUserId: String,
    @Json(name = "affinity") val affinity: Double?,
    @Json(name = "status") val status: String,
    @Json(name = "display_name") val displayName: String?,
)
