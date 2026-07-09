package com.echo.app.ui.screens.onboarding

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.echo.app.data.api.dto.DialogueMessage
import com.echo.app.data.model.OnboardingData
import com.echo.app.data.model.OpinionPick
import com.echo.app.data.model.StyleAnswer
import com.echo.app.data.model.TonePick
import com.echo.app.data.repository.AuthRepository
import com.echo.app.data.repository.OnboardingRepository
import com.squareup.moshi.Moshi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 四层人格采集模型入驻向导 ViewModel（见 docs_CN/Onboarding-Survey-Redesign-Proposal.md）。
 *
 * 步骤共 12 步，分四模块：
 *   0-2  M1 身份基座（基础/自我认知/兴趣经历社交角色）
 *   3-5  M2 语言指纹（语气习惯情绪/6场景含关系追问/自由写作口头禅）
 *   6-7  M3 信念系统（价值观信任幸福/观点改变边界）
 *   8    匹配偏好（保留）
 *   9    授权
 *   10   M4 深度对话（6-12 轮）
 *   11   孵化（自动触发）
 */
@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val onboardingRepository: OnboardingRepository,
    private val authRepository: AuthRepository,
    moshi: Moshi,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val dataAdapter = moshi.adapter(OnboardingData::class.java)

    private val _currentStep = MutableStateFlow(savedStateHandle.get<Int>(KEY_STEP) ?: 0)
    val currentStep: StateFlow<Int> = _currentStep.asStateFlow()

    private val _data = MutableStateFlow(restoreData(savedStateHandle, dataAdapter))
    val data: StateFlow<OnboardingData> = _data.asStateFlow()

    private val _isSubmitting = MutableStateFlow(false)
    val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _validationFailed = MutableStateFlow(false)
    val validationFailed: StateFlow<Boolean> = _validationFailed.asStateFlow()

    private val _submitSuccess = MutableStateFlow(false)
    val submitSuccess: StateFlow<Boolean> = _submitSuccess.asStateFlow()

    // ---------- M4 深度对话状态 ----------
    private val _sessionId = MutableStateFlow<String?>(null)
    val sessionId: StateFlow<String?> = _sessionId.asStateFlow()

    private val _dialogueLog = MutableStateFlow<List<DialogueItem>>(emptyList())
    val dialogueLog: StateFlow<List<DialogueItem>> = _dialogueLog.asStateFlow()

    private val _dialogueTurns = MutableStateFlow(0)
    val dialogueTurns: StateFlow<Int> = _dialogueTurns.asStateFlow()

    private val _dialogueReady = MutableStateFlow(false)
    val dialogueReady: StateFlow<Boolean> = _dialogueReady.asStateFlow()

    private val _dialogueSending = MutableStateFlow(false)
    val dialogueSending: StateFlow<Boolean> = _dialogueSending.asStateFlow()

    private val _dialogueError = MutableStateFlow<String?>(null)
    val dialogueError: StateFlow<String?> = _dialogueError.asStateFlow()

    fun updateData(transform: (OnboardingData) -> OnboardingData) {
        _data.update(transform)
        persist(savedStateHandle, dataAdapter, _data.value, _currentStep.value)
    }

    fun nextStep() {
        if (!canProceed(_currentStep.value)) {
            _validationFailed.value = true
            return
        }
        _validationFailed.value = false
        if (_currentStep.value >= TOTAL_STEPS - 1) return

        val nextStepIndex = _currentStep.value + 1
        // 进入 M4 对话步前先提交 survey，确保后端有问卷数据做个性化追问
        if (nextStepIndex == STEP_DIALOGUE) {
            submitSurveyAndStartDialogue()
            return
        }
        _currentStep.value = nextStepIndex
        persist(savedStateHandle, dataAdapter, _data.value, _currentStep.value)
    }

    fun prevStep() {
        _validationFailed.value = false
        if (_currentStep.value > 0) {
            _currentStep.value -= 1
            persist(savedStateHandle, dataAdapter, _data.value, _currentStep.value)
        }
    }

    fun canProceed(step: Int): Boolean = when (step) {
        0 -> _data.value.nickname.isNotBlank() && _data.value.city.isNotBlank()
        1 -> true // 自我认知全可选
        2 -> _data.value.interests.isNotEmpty()
        3 -> _data.value.tonePicks.size >= 2
        4 -> hasAllStyleScenarios(_data.value.styleAnswers)
        5 -> true // 自由写作/口头禅可选
        6 -> _data.value.valuesChoices.containsKey("pace") &&
            _data.value.valuesChoices.containsKey("conflict")
        7 -> hasAllOpinionProbes(_data.value.opinionPicks)
        8 -> _data.value.matchGenderPrefs.isNotEmpty()
        9 -> true // 授权
        10 -> _dialogueTurns.value >= DIALOGUE_MIN_TURNS
        11 -> true // 孵化中
        else -> false
    }

    fun clearValidationFailed() {
        _validationFailed.value = false
    }

    fun clearError() {
        _error.value = null
    }

    // ---------- M4 深度对话 ----------

    fun startDialogue() {
        viewModelScope.launch {
            _dialogueReady.value = false
            _dialogueError.value = null
            onboardingRepository.startDialogue(_sessionId.value).fold(
                onSuccess = { resp ->
                    _sessionId.value = resp.sessionId
                    _dialogueLog.value = resp.history.map { it.toDialogueItem() }
                    _dialogueTurns.value = resp.turnCount ?: 0
                    _dialogueReady.value = true
                },
                onFailure = { e ->
                    _dialogueError.value = e.message ?: "对话初始化失败"
                    _dialogueReady.value = false
                },
            )
        }
    }

    fun sendDialogueMessage(message: String) {
        val msg = message.trim()
        if (msg.isBlank() || _dialogueSending.value || _dialogueTurns.value >= DIALOGUE_MAX_TURNS) return
        if (!_dialogueReady.value) return

        viewModelScope.launch {
            _dialogueError.value = null
            _dialogueLog.update { it + DialogueItem("user", msg) }
            _dialogueSending.value = true
            onboardingRepository.sendDialogueTurn(msg, _sessionId.value).fold(
                onSuccess = { resp ->
                    if (resp.sessionId != null) _sessionId.value = resp.sessionId
                    val reply = resp.reply?.ifBlank { null } ?: DIALOGUE_FALLBACK
                    _dialogueLog.update { it + DialogueItem("assistant", reply) }
                    _dialogueTurns.value = minOf(DIALOGUE_MAX_TURNS, resp.turnCount ?: (_dialogueTurns.value + 1))
                },
                onFailure = { e ->
                    _dialogueError.value = e.message ?: "发送失败"
                },
            )
            _dialogueSending.value = false
        }
    }

    // ---------- 提交 survey 后启动 M4 对话 ----------

    private fun submitSurveyAndStartDialogue() {
        viewModelScope.launch {
            _isSubmitting.value = true
            _error.value = null
            onboardingRepository.submitSurvey(_data.value).fold(
                onSuccess = {
                    _isSubmitting.value = false
                    _currentStep.value = STEP_DIALOGUE
                    persist(savedStateHandle, dataAdapter, _data.value, _currentStep.value)
                    startDialogue()
                },
                onFailure = { e ->
                    _isSubmitting.value = false
                    _error.value = e.message ?: "Survey submit failed"
                },
            )
        }
    }

    // ---------- 孵化：finalize ----------

    fun submit() {
        viewModelScope.launch {
            _isSubmitting.value = true
            _error.value = null
            onboardingRepository.finalize().fold(
                onSuccess = { response ->
                    authRepository.saveToken(response.accessToken)
                    _submitSuccess.value = true
                },
                onFailure = { e ->
                    _error.value = e.message ?: "Finalize failed"
                },
            )
            _isSubmitting.value = false
        }
    }

    private fun hasAllStyleScenarios(answers: Map<String, StyleAnswer>): Boolean =
        STYLE_SCENARIO_IDS.all { id -> answers[id]?.let { it.choiceId.isNotBlank() } == true }

    private fun hasAllOpinionProbes(picks: Map<String, OpinionPick>): Boolean =
        OPINION_PROBE_IDS.all { id -> picks[id]?.let { it.choiceId.isNotBlank() } == true }

    private fun DialogueMessage.toDialogueItem(): DialogueItem = DialogueItem(role, text)

    companion object {
        const val TOTAL_STEPS = 12
        const val STEP_DIALOGUE = 10
        const val DIALOGUE_MIN_TURNS = 6
        const val DIALOGUE_MAX_TURNS = 12
        const val DIALOGUE_FALLBACK =
            "能再用你自己的话说说吗？比如最近一件让你觉得「这就是我」的小事，或者别人说什么会让你突然不想聊了～"

        /** M2 的 6 个场景 id（与 Web 端对齐） */
        val STYLE_SCENARIO_IDS = listOf("weekend", "disagree", "match", "excitement", "comfort", "vent")

        /** M3 的 4 个日常观点探针 id（与 Web 端对齐） */
        val OPINION_PROBE_IDS = listOf("effort", "socialMedia", "loan", "rareQuality")

        private const val KEY_STEP = "onboarding_step"
        private const val KEY_DATA = "onboarding_json"

        private fun restoreData(
            handle: SavedStateHandle,
            adapter: com.squareup.moshi.JsonAdapter<OnboardingData>,
        ): OnboardingData {
            val json = handle.get<String>(KEY_DATA) ?: return OnboardingData()
            return adapter.fromJson(json) ?: OnboardingData()
        }

        private fun persist(
            handle: SavedStateHandle,
            adapter: com.squareup.moshi.JsonAdapter<OnboardingData>,
            data: OnboardingData,
            step: Int,
        ) {
            handle[KEY_DATA] = adapter.toJson(data)
            handle[KEY_STEP] = step
        }
    }
}

/** 对话消息 UI 模型 */
data class DialogueItem(
    val role: String, // "user" | "assistant"
    val text: String,
)
