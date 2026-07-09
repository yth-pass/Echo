package com.echo.app.data.api.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class SessionListResponse(
    @Json(name = "items") val items: List<SessionDto>,
)

@JsonClass(generateAdapter = true)
data class MessageListResponse(
    @Json(name = "items") val items: List<MessageDto>,
)

@JsonClass(generateAdapter = true)
data class SessionDto(
    @Json(name = "id") val id: String,
    @Json(name = "clone_a_id") val cloneAId: String,
    @Json(name = "clone_b_id") val cloneBId: String,
    @Json(name = "status") val status: String,
    @Json(name = "started_at") val startedAt: String,
    @Json(name = "ended_at") val endedAt: String? = null,
    @Json(name = "other_user_name") val otherUserName: String = "对方",
    @Json(name = "last_message_preview") val lastMessagePreview: String? = null,
    @Json(name = "last_message_at") val lastMessageAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class MessageDto(
    @Json(name = "id") val id: String,
    @Json(name = "speaker_clone_id") val speakerCloneId: String,
    @Json(name = "content") val content: String,
    @Json(name = "turn_index") val turnIndex: Int,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "is_self") val isSelf: Boolean = false,
    @Json(name = "speaker_name") val speakerName: String? = null,
)
