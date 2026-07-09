package com.echo.app.data.api.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ActivityListResponse(
    @Json(name = "items") val items: List<ActivityItemDto>,
)

@JsonClass(generateAdapter = true)
data class ActivityItemDto(
    @Json(name = "kind") val kind: String,
    @Json(name = "id") val id: String,
    @Json(name = "title") val title: String = "",
    @Json(name = "description") val description: String = "",
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "ref_id") val refId: String? = null,
    @Json(name = "ref_type") val refType: String? = null,
    @Json(name = "summary_zh") val summaryZh: String? = null,
    @Json(name = "session_id") val sessionId: String? = null,
    @Json(name = "peer_name") val peerName: String? = null,
)
