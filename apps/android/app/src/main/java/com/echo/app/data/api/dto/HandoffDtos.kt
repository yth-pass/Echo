package com.echo.app.data.api.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class HandoffDetailResponse(
    @Json(name = "id") val id: String,
    @Json(name = "status") val status: String,
    @Json(name = "session_id") val sessionId: String,
    @Json(name = "affinity_score") val affinityScore: Double?,
    @Json(name = "user_a_id") val userAId: String,
    @Json(name = "user_b_id") val userBId: String,
    @Json(name = "contact_exchanged") val contactExchanged: Boolean,
    @Json(name = "responses") val responses: List<HandoffResponseItem>?,
)

@JsonClass(generateAdapter = true)
data class HandoffResponseItem(
    @Json(name = "user_id") val userId: String,
    @Json(name = "decision") val decision: String,
    @Json(name = "created_at") val createdAt: String,
)

@JsonClass(generateAdapter = true)
data class HandoffRespondRequest(
    @Json(name = "accept") val accept: Boolean,
)

@JsonClass(generateAdapter = true)
data class HandoffRespondResponse(
    @Json(name = "id") val id: String,
    @Json(name = "status") val status: String,
    @Json(name = "contact_exchanged") val contactExchanged: Boolean,
)

@JsonClass(generateAdapter = true)
data class PushRegisterRequest(
    @Json(name = "token") val token: String,
    @Json(name = "platform") val platform: String = "android",
)
