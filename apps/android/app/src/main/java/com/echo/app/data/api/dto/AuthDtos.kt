package com.echo.app.data.api.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class RegisterRequest(
    @Json(name = "phone") val phone: String,
    @Json(name = "email") val email: String?,
    @Json(name = "password") val password: String,
    @Json(name = "displayName") val displayName: String?,
)

@JsonClass(generateAdapter = true)
data class LoginRequest(
    @Json(name = "identifier") val identifier: String,
    @Json(name = "password") val password: String,
)

@JsonClass(generateAdapter = true)
data class AuthResponse(
    @Json(name = "access_token") val accessToken: String,
    @Json(name = "refresh_token") val refreshToken: String?,
    @Json(name = "user_id") val userId: String,
    @Json(name = "onboarding_complete") val onboardingComplete: Boolean = false,
    @Json(name = "is_new_user") val isNewUser: Boolean = false,
)
