package com.echo.app.data.api.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ==================== M1: 身份基座 ====================

@JsonClass(generateAdapter = true)
data class SocialSpectrumRequest(
    @Json(name = "strangerComfort") val strangerComfort: Int?,
    @Json(name = "friendRole") val friendRole: String?,
    @Json(name = "groupRole") val groupRole: String?,
)

// ==================== M2: 语言指纹（含关系情境） ====================

@JsonClass(generateAdapter = true)
data class StyleReplyRequest(
    @Json(name = "scenarioId") val scenarioId: String,
    @Json(name = "choiceId") val choiceId: String,
    @Json(name = "text") val text: String,
    @Json(name = "relationContext") val relationContext: String? = null,
)

@JsonClass(generateAdapter = true)
data class ToneTagRequest(
    @Json(name = "tag") val tag: String,
    @Json(name = "evidence") val evidence: String? = null,
)

@JsonClass(generateAdapter = true)
data class ChatHabitsRequest(
    @Json(name = "usesPunctuation") val usesPunctuation: Boolean?,
    @Json(name = "likesEmoji") val likesEmoji: Boolean?,
    @Json(name = "prefersShortMessages") val prefersShortMessages: Boolean?,
    @Json(name = "sendsVoiceMessages") val sendsVoiceMessages: Boolean?,
)

@JsonClass(generateAdapter = true)
data class EmotionalPatternsRequest(
    @Json(name = "badMoodNeed") val badMoodNeed: String?,
    @Json(name = "happyExpression") val happyExpression: String?,
)

// ==================== M3: 信念系统 ====================

@JsonClass(generateAdapter = true)
data class ValuesChoiceRequest(
    @Json(name = "questionId") val questionId: String,
    @Json(name = "choiceId") val choiceId: String,
    @Json(name = "label") val label: String,
)

@JsonClass(generateAdapter = true)
data class OpinionProbeRequest(
    @Json(name = "questionId") val questionId: String,
    @Json(name = "choiceId") val choiceId: String?,
    @Json(name = "label") val label: String?,
    @Json(name = "reason") val reason: String? = null,
)

// ==================== 匹配偏好（保留） ====================

@JsonClass(generateAdapter = true)
data class MatchPrefsExtra(
    @Json(name = "gender") val gender: List<String>,
    @Json(name = "ageMin") val ageMin: Int,
    @Json(name = "ageMax") val ageMax: Int,
    @Json(name = "distanceKm") val distanceKm: Int,
)

// ==================== Survey 请求 ====================

@JsonClass(generateAdapter = true)
data class SurveyExtra(
    @Json(name = "gender") val gender: String?,
    @Json(name = "birthYear") val birthYear: Int?,
    @Json(name = "education") val education: String?,
    @Json(name = "matchPrefs") val matchPrefs: MatchPrefsExtra?,
    @Json(name = "relationshipDealbreaker") val relationshipDealbreaker: String?,
)

@JsonClass(generateAdapter = true)
data class SurveyRequest(
    // --- M1: 身份基座 ---
    @Json(name = "displayName") val displayName: String?,
    @Json(name = "city") val city: String?,
    @Json(name = "goal") val goal: String?,
    @Json(name = "interests") val interests: List<String>?,
    @Json(name = "occupation") val occupation: String?,
    @Json(name = "selfDescription") val selfDescription: String?,
    @Json(name = "dailyRoutine") val dailyRoutine: String?,
    @Json(name = "interestContexts") val interestContexts: Map<String, String>?,
    @Json(name = "keyExperience") val keyExperience: String?,
    @Json(name = "socialSpectrum") val socialSpectrum: SocialSpectrumRequest?,

    // --- M2: 语言指纹（含关系情境） ---
    @Json(name = "styleReplies") val styleReplies: List<StyleReplyRequest>?,
    @Json(name = "toneTags") val toneTags: List<ToneTagRequest>?,
    @Json(name = "freeWritingSample") val freeWritingSample: String?,
    @Json(name = "catchphrases") val catchphrases: List<String>?,
    @Json(name = "chatHabits") val chatHabits: ChatHabitsRequest?,
    @Json(name = "emotionalPatterns") val emotionalPatterns: EmotionalPatternsRequest?,
    @Json(name = "caringStyle") val caringStyle: String?,

    // --- M3: 信念系统 ---
    @Json(name = "valuesChoices") val valuesChoices: List<ValuesChoiceRequest>?,
    @Json(name = "valuesWhy") val valuesWhy: Map<String, String>?,
    @Json(name = "trustView") val trustView: String?,
    @Json(name = "happinessView") val happinessView: String?,
    @Json(name = "opinionProbes") val opinionProbes: List<OpinionProbeRequest>?,
    @Json(name = "changedMind") val changedMind: String?,
    @Json(name = "feelingHeardSignal") val feelingHeardSignal: String?,
    @Json(name = "shutDownTrigger") val shutDownTrigger: String?,

    // --- 兼容 ---
    @Json(name = "extra") val extra: SurveyExtra?,
)

@JsonClass(generateAdapter = true)
data class SurveyResponse(
    @Json(name = "sessionId") val sessionId: String,
    @Json(name = "saved") val saved: Boolean,
)

@JsonClass(generateAdapter = true)
data class FinalizeResponse(
    @Json(name = "cloneId") val cloneId: String?,
    @Json(name = "status") val status: String?,
    @Json(name = "onboardingComplete") val onboardingComplete: Boolean,
    @Json(name = "accessToken") val accessToken: String,
    @Json(name = "refreshToken") val refreshToken: String?,
    @Json(name = "userId") val userId: String,
)

// ==================== M4: 深度对话 ====================

@JsonClass(generateAdapter = true)
data class DialogueStartRequest(
    @Json(name = "sessionId") val sessionId: String? = null,
)

@JsonClass(generateAdapter = true)
data class DialogueMessage(
    @Json(name = "role") val role: String,
    @Json(name = "text") val text: String,
)

@JsonClass(generateAdapter = true)
data class DialogueStartResponse(
    @Json(name = "sessionId") val sessionId: String,
    @Json(name = "turnCount") val turnCount: Int? = 0,
    @Json(name = "history") val history: List<DialogueMessage> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class DialogueTurnRequest(
    @Json(name = "message") val message: String,
    @Json(name = "sessionId") val sessionId: String? = null,
)

@JsonClass(generateAdapter = true)
data class DialogueTurnResponse(
    @Json(name = "reply") val reply: String?,
    @Json(name = "sessionId") val sessionId: String?,
    @Json(name = "turnCount") val turnCount: Int? = 0,
    @Json(name = "maxReached") val maxReached: Boolean? = false,
)
