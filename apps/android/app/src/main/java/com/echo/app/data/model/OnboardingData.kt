package com.echo.app.data.model

import com.squareup.moshi.JsonClass

/**
 * 四层人格采集模型 onboarding 数据（见 docs_CN/Onboarding-Survey-Redesign-Proposal.md）。
 *
 * 字段分两组：
 * - Profile 基础信息（nickname/gender/birthYear/city/education/occupation/matchPrefs）：后端 Profile 表仍需要，保留。
 * - 四层问卷字段（M1 身份基座 / M2 语言指纹含关系情境 / M3 信念系统）：本次升级新增，全 optional。
 * - M4 深度对话状态在 ViewModel 里管理，不入此 data class（对话通过 sessionId 在服务端持久化）。
 */
@JsonClass(generateAdapter = true)
data class OnboardingData(
    // ---------- Profile 基础信息 ----------
    val nickname: String = "",
    val gender: String = "",
    val birthYear: Int = 2000,
    val city: String = "",
    val education: String = "",
    val occupation: String = "",
    val relationshipIntent: String = "",
    val matchGenderPrefs: List<String> = emptyList(),
    val matchAgeMin: Float = 18f,
    val matchAgeMax: Float = 35f,
    val matchDistanceKm: Float = 50f,

    // ---------- M1: 身份基座 ----------
    val interests: List<String> = emptyList(),
    /** 每个兴趣的"为什么/怎么喜欢"，key=兴趣名 */
    val interestContexts: Map<String, String> = emptyMap(),
    /** 朋友们怎么形容你（社交人格锚点） */
    val selfDescription: String = "",
    /** 典型一天（生活节奏） */
    val dailyRoutine: String = "",
    /** 一个改变了你的经历 */
    val keyExperience: String = "",
    /** 社交角色基准 */
    val socialSpectrum: SocialSpectrum = SocialSpectrum(),

    // ---------- M2: 语言指纹（含关系情境层） ----------
    /** 6 个语言场景的选择 + 关系情境追问回答，key=scenarioId */
    val styleAnswers: Map<String, StyleAnswer> = emptyMap(),
    /** 语气标签 + 每个标签的真实原话证据 */
    val tonePicks: List<TonePick> = emptyList(),
    /** 自由写作样本：给朋友的消息 */
    val freeWritingSample: String = "",
    /** 口头禅列表 */
    val catchphrases: List<String> = emptyList(),
    /** 聊天习惯偏好 */
    val chatHabits: ChatHabits = ChatHabits(),
    /** 情绪反应模式 */
    val emotionalPatterns: EmotionalPatterns = EmotionalPatterns(),

    // ---------- M3: 信念系统 ----------
    /** 关系观/分歧观选择，key=questionId（pace/conflict） */
    val valuesChoices: Map<String, String> = emptyMap(),
    /** 每个价值观选择的理由，key=questionId */
    val valuesWhy: Map<String, String> = emptyMap(),
    /** 一段关系里最不能接受什么 */
    val relationshipDealbreaker: String = "",
    /** 信任观 */
    val trustView: String = "",
    /** 幸福观 */
    val happinessView: String = "",
    /** 日常观点探针，key=questionId */
    val opinionPicks: Map<String, OpinionPick> = emptyMap(),
    /** 改变过想法的事 */
    val changedMind: String = "",
    /** 被理解的信号 */
    val feelingHeardSignal: String = "",
    /** 不想说话的触发 */
    val shutDownTrigger: String = "",
)

@JsonClass(generateAdapter = true)
data class SocialSpectrum(
    /** 和陌生人：0=拘谨, 100=自来熟 */
    val strangerComfort: Int = 50,
    /** 和朋友：倾听者 / 分享者 / 兼有 */
    val friendRole: String = "",
    /** 在群体中：观察者 / 气氛组 / 视情况 */
    val groupRole: String = "",
)

@JsonClass(generateAdapter = true)
data class StyleAnswer(
    val choiceId: String = "",
    val text: String = "",
    /** 关系情境追问的回答（可选） */
    val relationContext: String = "",
)

@JsonClass(generateAdapter = true)
data class TonePick(
    val tag: String = "",
    /** 该标签对应的真实原话证据 */
    val evidence: String = "",
)

@JsonClass(generateAdapter = true)
data class ChatHabits(
    val usesPunctuation: Boolean = false,
    val likesEmoji: Boolean = false,
    val prefersShortMessages: Boolean = false,
    val sendsVoiceMessages: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class EmotionalPatterns(
    /** 心情不好时希望别人怎么做 */
    val badMoodNeed: String = "",
    /** 特别开心时会怎么表达 */
    val happyExpression: String = "",
)

@JsonClass(generateAdapter = true)
data class OpinionPick(
    val choiceId: String = "",
    val label: String = "",
    /** 可选 why 追问 */
    val reason: String = "",
)
