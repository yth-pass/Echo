package com.echo.app.data.repository

import com.echo.app.data.api.EchoApi
import com.echo.app.data.api.dto.ChatHabitsRequest
import com.echo.app.data.api.dto.DialogueMessage
import com.echo.app.data.api.dto.DialogueStartRequest
import com.echo.app.data.api.dto.DialogueStartResponse
import com.echo.app.data.api.dto.DialogueTurnRequest
import com.echo.app.data.api.dto.DialogueTurnResponse
import com.echo.app.data.api.dto.EmotionalPatternsRequest
import com.echo.app.data.api.dto.FinalizeResponse
import com.echo.app.data.api.dto.MatchPrefsExtra
import com.echo.app.data.api.dto.OpinionProbeRequest
import com.echo.app.data.api.dto.SocialSpectrumRequest
import com.echo.app.data.api.dto.StyleReplyRequest
import com.echo.app.data.api.dto.SurveyExtra
import com.echo.app.data.api.dto.SurveyRequest
import com.echo.app.data.api.dto.ToneTagRequest
import com.echo.app.data.api.dto.ValuesChoiceRequest
import com.echo.app.data.model.OnboardingData
import com.echo.app.data.model.OpinionPick
import com.echo.app.data.model.StyleAnswer
import com.echo.app.data.model.TonePick
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 四层人格采集模型 onboarding 仓库（见 docs_CN/Onboarding-Survey-Redesign-Proposal.md）。
 * 负责把 [OnboardingData] 映射成后端 [SurveyRequest]，并封装 M4 深度对话两个端点。
 */
@Singleton
class OnboardingRepository @Inject constructor(
    private val api: EchoApi,
) {
    suspend fun submitSurvey(data: OnboardingData): Result<String?> {
        return try {
            val res = api.submitSurvey(data.toSurveyRequest())
            if (res.isSuccessful) {
                Result.success(res.body()?.sessionId)
            } else {
                Result.failure(apiError(res, "Survey submit failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun startDialogue(sessionId: String?): Result<DialogueStartResponse> {
        return try {
            val res = api.startDialogue(DialogueStartRequest(sessionId))
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                Result.failure(apiError(res, "Dialogue start failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendDialogueTurn(message: String, sessionId: String?): Result<DialogueTurnResponse> {
        return try {
            val res = api.sendDialogueTurn(DialogueTurnRequest(message, sessionId))
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                Result.failure(apiError(res, "Dialogue turn failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun finalize(): Result<FinalizeResponse> {
        return try {
            val res = api.finalizeOnboarding()
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                Result.failure(apiError(res, "Finalize failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun apiError(res: Response<*>, fallback: String): Exception {
        val body = res.errorBody()?.string()?.trim()
        val message = when {
            !body.isNullOrBlank() -> body
            else -> "$fallback (${res.code()})"
        }
        return Exception(message)
    }

    // ---------- 四层问卷 → SurveyRequest 映射 ----------

    private fun OnboardingData.toSurveyRequest(): SurveyRequest {
        // M2 场景：从 styleAnswers 构造 StyleReplyRequest 列表
        val styleReplies = styleAnswers.map { (scenarioId, ans) ->
            StyleReplyRequest(
                scenarioId = scenarioId,
                choiceId = ans.choiceId,
                text = ans.text,
                relationContext = ans.relationContext.ifBlank { null },
            )
        }.ifEmpty { null }

        // M2 语气标签
        val toneTags = tonePicks.filter { it.tag.isNotBlank() }.map { tp ->
            ToneTagRequest(tag = tp.tag, evidence = tp.evidence.ifBlank { null })
        }.ifEmpty { null }

        // M2 comfort 场景的关系追问回答同时作为 caringStyle
        val caringStyle = styleAnswers["comfort"]?.relationContext?.ifBlank { null }

        // M2 聊天习惯
        val chatHabitsReq = ChatHabitsRequest(
            usesPunctuation = chatHabits.usesPunctuation,
            likesEmoji = chatHabits.likesEmoji,
            prefersShortMessages = chatHabits.prefersShortMessages,
            sendsVoiceMessages = chatHabits.sendsVoiceMessages,
        )

        // M2 情绪反应
        val emotionalReq = EmotionalPatternsRequest(
            badMoodNeed = emotionalPatterns.badMoodNeed.ifBlank { null },
            happyExpression = emotionalPatterns.happyExpression.ifBlank { null },
        )

        // M3 价值观
        val valuesChoicesReq = valuesChoices.map { (qid, cid) ->
            // label 由 ViewModel 在选择时填入；这里从已知映射取，找不到就空
            ValuesChoiceRequest(questionId = qid, choiceId = cid, label = valueLabel(qid, cid))
        }.ifEmpty { null }

        val valuesWhyClean = valuesWhy.filterValues { it.isNotBlank() }.ifEmpty { null }

        // M3 日常观点
        val opinionReq = opinionPicks.map { (qid, pick) ->
            OpinionProbeRequest(
                questionId = qid,
                choiceId = pick.choiceId.ifBlank { null },
                label = pick.label.ifBlank { null },
                reason = pick.reason.ifBlank { null },
            )
        }.ifEmpty { null }

        // M1 社交角色
        val socialReq = SocialSpectrumRequest(
            strangerComfort = socialSpectrum.strangerComfort,
            friendRole = socialSpectrum.friendRole.ifBlank { null },
            groupRole = socialSpectrum.groupRole.ifBlank { null },
        )

        return SurveyRequest(
            // M1
            displayName = nickname.ifBlank { null },
            city = city.ifBlank { null },
            goal = relationshipIntentToGoal(relationshipIntent),
            interests = interests.ifEmpty { null },
            occupation = occupation.ifBlank { null },
            selfDescription = selfDescription.ifBlank { null },
            dailyRoutine = dailyRoutine.ifBlank { null },
            interestContexts = interestContexts.filterValues { it.isNotBlank() }.ifEmpty { null },
            keyExperience = keyExperience.ifBlank { null },
            socialSpectrum = socialReq,
            // M2
            styleReplies = styleReplies,
            toneTags = toneTags,
            freeWritingSample = freeWritingSample.ifBlank { null },
            catchphrases = catchphrases.filter { it.isNotBlank() }.ifEmpty { null },
            chatHabits = chatHabitsReq,
            emotionalPatterns = emotionalReq,
            caringStyle = caringStyle,
            // M3
            valuesChoices = valuesChoicesReq,
            valuesWhy = valuesWhyClean,
            trustView = trustView.ifBlank { null },
            happinessView = happinessView.ifBlank { null },
            opinionProbes = opinionReq,
            changedMind = changedMind.ifBlank { null },
            feelingHeardSignal = feelingHeardSignal.ifBlank { null },
            shutDownTrigger = shutDownTrigger.ifBlank { null },
            // 兼容
            extra = SurveyExtra(
                gender = gender.ifBlank { null },
                birthYear = birthYear,
                education = education.ifBlank { null },
                matchPrefs = if (matchGenderPrefs.isEmpty()) null else MatchPrefsExtra(
                    gender = matchGenderPrefs,
                    ageMin = matchAgeMin.toInt(),
                    ageMax = matchAgeMax.toInt(),
                    distanceKm = matchDistanceKm.toInt(),
                ),
                relationshipDealbreaker = relationshipDealbreaker.ifBlank { null },
            ),
        )
    }

    companion object {
        private fun relationshipIntentToGoal(intent: String): String? = when (intent) {
            "serious" -> "认真约会"
            "casual" -> "慢慢来"
            "friends" -> "先交朋友"
            "unsure" -> "慢慢来"
            else -> intent.ifBlank { null }
        }

        /** 价值观选择的 label 映射（与 ViewModel 选项定义保持一致） */
        private fun valueLabel(questionId: String, choiceId: String): String = when {
            questionId == "pace" && choiceId == "meet" -> "遇到的，对的人天然合拍"
            questionId == "pace" && choiceId == "build" -> "磨合出来的，没有天生一对"
            questionId == "conflict" && choiceId == "talk" -> "直接沟通说清楚"
            questionId == "conflict" && choiceId == "space" -> "先冷静再给台阶"
            else -> ""
        }
    }
}
