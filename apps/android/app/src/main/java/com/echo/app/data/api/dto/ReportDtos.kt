package com.echo.app.data.api.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ReportRequest(
    @Json(name = "targetType") val targetType: String,
    @Json(name = "targetId") val targetId: String,
    @Json(name = "reason") val reason: String?,
)

@JsonClass(generateAdapter = true)
data class ReportResponse(
    @Json(name = "id") val id: String,
    @Json(name = "status") val status: String,
)
