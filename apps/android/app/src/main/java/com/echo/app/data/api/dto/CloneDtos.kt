package com.echo.app.data.api.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class CloneDetailResponse(
    @Json(name = "clone") val clone: CloneInfo,
    @Json(name = "profile") val profile: ProfileInfo?,
)

@JsonClass(generateAdapter = true)
data class CloneInfo(
    @Json(name = "id") val id: String,
    @Json(name = "status") val status: String,
    @Json(name = "persona_prompt") val personaPrompt: String?,
)

@JsonClass(generateAdapter = true)
data class ProfileInfo(
    @Json(name = "display_name") val displayName: String?,
    @Json(name = "city") val city: String?,
    @Json(name = "style_md") val styleMd: String?,
)

@JsonClass(generateAdapter = true)
data class BoundariesDto(
    @Json(name = "forbiddenWords") val forbiddenWords: List<String>? = null,
    @Json(name = "topicsToAvoid") val topicsToAvoid: String? = null,
)

@JsonClass(generateAdapter = true)
data class UpdateCloneApiRequest(
    @Json(name = "personaText") val personaText: String? = null,
    @Json(name = "boundaries") val boundaries: BoundariesDto? = null,
)

@JsonClass(generateAdapter = true)
data class UpdateCloneResponse(
    @Json(name = "id") val id: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "persona") val persona: String? = null,
    @Json(name = "boundaries") val boundaries: BoundariesDto? = null,
)
