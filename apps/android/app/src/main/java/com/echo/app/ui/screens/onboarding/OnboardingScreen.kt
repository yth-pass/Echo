package com.echo.app.ui.screens.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RangeSlider
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.echo.app.R
import com.echo.app.data.model.OnboardingData
import com.echo.app.data.model.OpinionPick
import com.echo.app.data.model.StyleAnswer

private object OnboardingKeys {
    const val GENDER_MALE = "male"
    const val GENDER_FEMALE = "female"
    const val GENDER_OTHER = "other"
    const val INTENT_SERIOUS = "serious"
    const val INTENT_CASUAL = "casual"
    const val INTENT_FRIENDS = "friends"
    const val INTENT_UNSURE = "unsure"
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun OnboardingScreen(
    onComplete: () -> Unit,
    viewModel: OnboardingViewModel = hiltViewModel(),
) {
    val currentStep by viewModel.currentStep.collectAsStateWithLifecycle()
    val data by viewModel.data.collectAsStateWithLifecycle()
    val isSubmitting by viewModel.isSubmitting.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val validationFailed by viewModel.validationFailed.collectAsStateWithLifecycle()
    val submitSuccess by viewModel.submitSuccess.collectAsStateWithLifecycle()

    val pagerState = rememberPagerState(
        initialPage = currentStep,
        pageCount = { OnboardingViewModel.TOTAL_STEPS },
    )
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(currentStep) {
        if (pagerState.currentPage != currentStep) {
            pagerState.animateScrollToPage(currentStep)
        }
    }

    LaunchedEffect(submitSuccess) {
        if (submitSuccess) onComplete()
    }

    LaunchedEffect(error) {
        error?.let {
            snackbarHostState.showSnackbar(stringResource(R.string.onboarding_submit_failed, it))
            viewModel.clearError()
        }
    }

    LaunchedEffect(validationFailed) {
        if (validationFailed) {
            snackbarHostState.showSnackbar(stringResource(R.string.onboarding_validation_required))
            viewModel.clearValidationFailed()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = { TopAppBar(title = { Text(stringResource(R.string.onboarding_title)) }) },
        bottomBar = {
            OnboardingBottomBar(
                currentStep = currentStep,
                isSubmitting = isSubmitting,
                onPrev = { viewModel.prevStep() },
                onNext = { viewModel.nextStep() },
                onSubmit = { viewModel.submit() },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
        ) {
            val moduleMeta = STEP_MODULE.getOrNull(currentStep)
            LinearProgressIndicator(
                progress = { (currentStep + 1) / OnboardingViewModel.TOTAL_STEPS.toFloat() },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.onboarding_step_progress, currentStep + 1) +
                    (moduleMeta?.let { " · " + stringResource(it.titleRes) } ?: ""),
                style = MaterialTheme.typography.labelLarge,
            )
            Spacer(modifier = Modifier.height(16.dp))

            HorizontalPager(
                state = pagerState,
                userScrollEnabled = false,
                modifier = Modifier.fillMaxSize(),
            ) { page ->
                when (page) {
                    0 -> StepBasics(data = data, onUpdate = viewModel::updateData)
                    1 -> StepSelfAndDaily(data = data, onUpdate = viewModel::updateData)
                    2 -> StepInterestsAndSocial(data = data, onUpdate = viewModel::updateData)
                    3 -> StepToneAndHabits(data = data, onUpdate = viewModel::updateData)
                    4 -> StepScenarios(data = data, onUpdate = viewModel::updateData)
                    5 -> StepWritingAndCatchphrases(data = data, onUpdate = viewModel::updateData)
                    6 -> StepValues(data = data, onUpdate = viewModel::updateData)
                    7 -> StepOpinionsAndBoundaries(data = data, onUpdate = viewModel::updateData)
                    8 -> StepMatchPrefs(data = data, onUpdate = viewModel::updateData)
                    9 -> StepConsent()
                    10 -> StepDialogue(viewModel = viewModel)
                    11 -> StepFinalize(viewModel = viewModel)
                }
            }
        }
    }
}

// ==================== 底部栏 ====================

@Composable
private fun OnboardingBottomBar(
    currentStep: Int,
    isSubmitting: Boolean,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onSubmit: () -> Unit,
) {
    val isLastStep = currentStep == OnboardingViewModel.TOTAL_STEPS - 1
    Surface(tonalElevation = 3.dp) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = onPrev, enabled = currentStep > 0 && !isSubmitting) {
                Text(stringResource(R.string.btn_prev))
            }
            Button(
                onClick = if (isLastStep) onSubmit else onNext,
                enabled = !isSubmitting,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
            ) {
                if (isSubmitting && isLastStep) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.onboarding_creating_clone))
                } else {
                    Text(stringResource(if (isLastStep) R.string.btn_confirm_create_clone else R.string.btn_next))
                }
            }
        }
    }
}

// ==================== M1 Step 0: 基础画像 ====================

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepBasics(
    data: OnboardingData,
    onUpdate: ((OnboardingData) -> OnboardingData) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(stringResource(R.string.onboarding_step_basics), style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(
            value = data.nickname,
            onValueChange = { v -> onUpdate { it.copy(nickname = v) } },
            modifier = Modifier.fillMaxWidth(),
            label = { Text(stringResource(R.string.label_display_name)) },
            singleLine = true,
        )
        OutlinedTextField(
            value = data.city,
            onValueChange = { v -> onUpdate { it.copy(city = v) } },
            modifier = Modifier.fillMaxWidth(),
            label = { Text(stringResource(R.string.label_city)) },
            singleLine = true,
        )
        Text(stringResource(R.string.label_goal), style = MaterialTheme.typography.labelLarge)
        GOAL_OPTIONS.forEach { (key, labelRes) ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(
                    selected = data.relationshipIntent == key,
                    onClick = { onUpdate { it.copy(relationshipIntent = key) } },
                )
                Text(stringResource(labelRes))
            }
        }
        Text(stringResource(R.string.label_occupation), style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OCCUPATION_OPTIONS.forEach { occ ->
                val selected = data.occupation == occ
                FilterChip(
                    selected = selected,
                    onClick = { onUpdate { it.copy(occupation = if (selected) "" else occ) } },
                    label = { Text(occ) },
                )
            }
        }
        // 性别 / 出生年（Profile 基础信息，保留）
        Text(stringResource(R.string.label_gender), style = MaterialTheme.typography.labelLarge)
        listOf(
            OnboardingKeys.GENDER_MALE to R.string.gender_male,
            OnboardingKeys.GENDER_FEMALE to R.string.gender_female,
            OnboardingKeys.GENDER_OTHER to R.string.gender_other,
        ).forEach { (key, labelRes) ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(selected = data.gender == key, onClick = { onUpdate { it.copy(gender = key) } })
                Text(stringResource(labelRes))
            }
        }
        OutlinedTextField(
            value = data.birthYear.toString(),
            onValueChange = { v ->
                val year = v.filter { it.isDigit() }.take(4).toIntOrNull() ?: data.birthYear
                onUpdate { it.copy(birthYear = year.coerceIn(1950, 2010)) }
            },
            modifier = Modifier.fillMaxWidth(),
            label = { Text(stringResource(R.string.label_birth_year)) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
        )
    }
}

// ==================== M1 Step 1: 朋友眼中的你 + 典型一天 ====================

@Composable
private fun StepSelfAndDaily(
    data: OnboardingData,
    onUpdate: ((OnboardingData) -> OnboardingData) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(stringResource(R.string.onboarding_step_self), style = MaterialTheme.typography.titleMedium)
        Text(stringResource(R.string.m1_self_prompt), style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
            value = data.selfDescription,
            onValueChange = { v -> onUpdate { it.copy(selfDescription = v) } },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("如：直接、靠谱、有点轴——朋友说我答应的事就一定办到") },
            minLines = 2,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.m1_daily_prompt), style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
            value = data.dailyRoutine,
            onValueChange = { v -> onUpdate { it.copy(dailyRoutine = v) } },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("如：早上挤地铁刷手机，午休遛弯，晚上瘫着看剧") },
            minLines = 2,
        )
    }
}

// ==================== M1 Step 2: 兴趣 + 经历 + 社交角色 ====================

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepInterestsAndSocial(
    data: OnboardingData,
    onUpdate: ((OnboardingData) -> OnboardingData) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(stringResource(R.string.onboarding_step_interests_social), style = MaterialTheme.typography.titleMedium)
        Text(stringResource(R.string.label_interests), style = MaterialTheme.typography.labelLarge)
        val presetInterests = listOf("电影", "音乐", "旅行", "美食", "阅读", "运动", "艺术", "科技")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            presetInterests.forEach { interest ->
                val selected = data.interests.contains(interest)
                FilterChip(
                    selected = selected,
                    onClick = {
                        onUpdate {
                            val updated = if (selected) it.interests - interest
                            else if (it.interests.size < 4) it.interests + interest
                            else it.interests
                            it.copy(interests = updated)
                        }
                    },
                    label = { Text(interest) },
                )
            }
        }
        // 每个已选兴趣的"为什么"
        data.interests.forEach { interest ->
            Column {
                Text(
                    stringResource(R.string.m1_interest_context, interest),
                    style = MaterialTheme.typography.bodySmall,
                )
                OutlinedTextField(
                    value = data.interestContexts[interest] ?: "",
                    onValueChange = { v ->
                        onUpdate { it.copy(interestContexts = it.interestContexts + (interest to v)) }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.m1_experience_prompt), style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
            value = data.keyExperience,
            onValueChange = { v -> onUpdate { it.copy(keyExperience = v) } },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
        )
        Spacer(modifier = Modifier.height(8.dp))
        // 社交角色
        Text(stringResource(R.string.m1_social_stranger), style = MaterialTheme.typography.labelLarge)
        Slider(
            value = data.socialSpectrum.strangerComfort.toFloat(),
            onValueChange = { v -> onUpdate { it.copy(socialSpectrum = it.socialSpectrum.copy(strangerComfort = v.toInt())) } },
            valueRange = 0f..100f,
        )
        Text(stringResource(R.string.m1_social_friend), style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FRIEND_ROLE_OPTIONS.forEach { (key, labelRes) ->
                FilterChip(
                    selected = data.socialSpectrum.friendRole == key,
                    onClick = { onUpdate { it.copy(socialSpectrum = it.socialSpectrum.copy(friendRole = key)) } },
                    label = { Text(stringResource(labelRes)) },
                )
            }
        }
        Text(stringResource(R.string.m1_social_group), style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GROUP_ROLE_OPTIONS.forEach { (key, labelRes) ->
                FilterChip(
                    selected = data.socialSpectrum.groupRole == key,
                    onClick = { onUpdate { it.copy(socialSpectrum = it.socialSpectrum.copy(groupRole = key)) } },
                    label = { Text(stringResource(labelRes)) },
                )
            }
        }
    }
}

// ==================== M2 Step 3: 语气标签 + 聊天习惯 + 情绪反应 ====================

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepToneAndHabits(
    data: OnboardingData,
    onUpdate: ((OnboardingData) -> OnboardingData) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(stringResource(R.string.onboarding_step_tone), style = MaterialTheme.typography.titleMedium)
        Text(stringResource(R.string.m2_tone_prompt), style = MaterialTheme.typography.bodySmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            TONE_TAG_OPTIONS.forEach { tag ->
                val selected = data.tonePicks.any { it.tag == tag }
                FilterChip(
                    selected = selected,
                    onClick = {
                        onUpdate {
                            val picks = if (selected) it.tonePicks.filter { p -> p.tag != tag }
                            else if (it.tonePicks.size < 3) it.tonePicks + com.echo.app.data.model.TonePick(tag = tag, evidence = "")
                            else it.tonePicks
                            it.copy(tonePicks = picks)
                        }
                    },
                    label = { Text(tag) },
                )
            }
        }
        // 每个已选语气标签的证据
        data.tonePicks.forEach { pick ->
            Column {
                Text(stringResource(R.string.m2_tone_evidence, pick.tag), style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(
                    value = pick.evidence,
                    onValueChange = { v ->
                        onUpdate {
                            it.copy(tonePicks = it.tonePicks.map { p -> if (p.tag == pick.tag) p.copy(evidence = v) else p })
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.m2_chat_habits_prompt), style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CHAT_HABIT_OPTIONS.forEach { opt ->
                val selected = when (opt.key) {
                    "usesPunctuation" -> data.chatHabits.usesPunctuation
                    "likesEmoji" -> data.chatHabits.likesEmoji
                    "prefersShortMessages" -> data.chatHabits.prefersShortMessages
                    "sendsVoiceMessages" -> data.chatHabits.sendsVoiceMessages
                    else -> false
                }
                FilterChip(
                    selected = selected,
                    onClick = {
                        onUpdate { d ->
                            val ch = d.chatHabits
                            val newCh = when (opt.key) {
                                "usesPunctuation" -> ch.copy(usesPunctuation = !ch.usesPunctuation)
                                "likesEmoji" -> ch.copy(likesEmoji = !ch.likesEmoji)
                                "prefersShortMessages" -> ch.copy(prefersShortMessages = !ch.prefersShortMessages)
                                "sendsVoiceMessages" -> ch.copy(sendsVoiceMessages = !ch.sendsVoiceMessages)
                                else -> ch
                            }
                            d.copy(chatHabits = newCh)
                        }
                    },
                    label = { Text(stringResource(opt.labelRes)) },
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.m2_bad_mood), style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BAD_MOOD_OPTIONS.forEach { (key, labelRes) ->
                FilterChip(
                    selected = data.emotionalPatterns.badMoodNeed == key,
                    onClick = { onUpdate { it.copy(emotionalPatterns = it.emotionalPatterns.copy(badMoodNeed = key)) } },
                    label = { Text(stringResource(labelRes)) },
                )
            }
        }
        Text(stringResource(R.string.m2_happy_expr), style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HAPPY_EXPR_OPTIONS.forEach { (key, labelRes) ->
                FilterChip(
                    selected = data.emotionalPatterns.happyExpression == key,
                    onClick = { onUpdate { it.copy(emotionalPatterns = it.emotionalPatterns.copy(happyExpression = key)) } },
                    label = { Text(stringResource(labelRes)) },
                )
            }
        }
    }
}

// ==================== M2 Step 4: 6 个语言场景 ====================

@Composable
private fun StepScenarios(
    data: OnboardingData,
    onUpdate: ((OnboardingData) -> OnboardingData) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        items(STYLE_SCENARIOS, key = { it.id }) { scenario ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(scenario.promptRes), style = MaterialTheme.typography.bodyMedium)
                    scenario.choices.forEach { opt ->
                        val selected = data.styleAnswers[scenario.id]?.choiceId == opt.id
                        val choiceText = stringResource(opt.labelRes)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(
                                selected = selected,
                                onClick = {
                                    val existing = data.styleAnswers[scenario.id]?.relationContext ?: ""
                                    onUpdate {
                                        it.copy(
                                            styleAnswers = it.styleAnswers + (scenario.id to StyleAnswer(opt.id, choiceText, existing)),
                                        )
                                    }
                                },
                            )
                            Text(choiceText, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    if (scenario.relationFollowupRes != null) {
                        Text(stringResource(scenario.relationFollowupRes), style = MaterialTheme.typography.bodySmall)
                        OutlinedTextField(
                            value = data.styleAnswers[scenario.id]?.relationContext ?: "",
                            onValueChange = { v ->
                                val existing = data.styleAnswers[scenario.id] ?: StyleAnswer()
                                onUpdate {
                                    it.copy(
                                        styleAnswers = it.styleAnswers + (scenario.id to existing.copy(relationContext = v)),
                                    )
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2,
                        )
                    }
                }
            }
        }
    }
}

// ==================== M2 Step 5: 自由写作 + 口头禅 ====================

@Composable
private fun StepWritingAndCatchphrases(
    data: OnboardingData,
    onUpdate: ((OnboardingData) -> OnboardingData) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(stringResource(R.string.onboarding_step_writing), style = MaterialTheme.typography.titleMedium)
        Text(stringResource(R.string.m2_free_writing_prompt), style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
            value = data.freeWritingSample,
            onValueChange = { v -> onUpdate { it.copy(freeWritingSample = v) } },
            modifier = Modifier.fillMaxWidth(),
            minLines = 4,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.m2_catchphrase_prompt), style = MaterialTheme.typography.bodySmall)
        // 3 个口头禅输入框
        val current = data.catchphrases
        val slots = (0 until 3).map { i -> current.getOrNull(i) ?: "" }
        slots.forEachIndexed { idx, value ->
            OutlinedTextField(
                value = value,
                onValueChange = { v ->
                    onUpdate { d ->
                        val list = d.catchphrases.toMutableList()
                        while (list.size <= idx) list.add("")
                        list[idx] = v
                        d.copy(catchphrases = list)
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text(when (idx) { 0 -> "如：笑死"; 1 -> "如：那确实"; else -> "如：不是我说" }) },
            )
        }
    }
}

// ==================== M3 Step 6: 价值观 ====================

@Composable
private fun StepValues(
    data: OnboardingData,
    onUpdate: ((OnboardingData) -> OnboardingData) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(stringResource(R.string.onboarding_step_values), style = MaterialTheme.typography.titleMedium)
        VALUES_QUESTIONS.forEach { q ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(q.promptRes), style = MaterialTheme.typography.bodyMedium)
                    q.choices.forEach { opt ->
                        val selected = data.valuesChoices[q.id] == opt.id
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(
                                selected = selected,
                                onClick = { onUpdate { it.copy(valuesChoices = it.valuesChoices + (q.id to opt.id)) } },
                            )
                            Text(stringResource(opt.labelRes), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    OutlinedTextField(
                        value = data.valuesWhy[q.id] ?: "",
                        onValueChange = { v -> onUpdate { it.copy(valuesWhy = it.valuesWhy + (q.id to v)) } },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(q.whyRes)) },
                        singleLine = true,
                    )
                }
            }
        }
        // 关系不可接受项
        Text(stringResource(R.string.m3_dealbreaker), style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
            value = data.relationshipDealbreaker,
            onValueChange = { v -> onUpdate { it.copy(relationshipDealbreaker = v) } },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.m3_trust_q), style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
            value = data.trustView,
            onValueChange = { v -> onUpdate { it.copy(trustView = v) } },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.m3_happiness_q), style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
            value = data.happinessView,
            onValueChange = { v -> onUpdate { it.copy(happinessView = v) } },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
    }
}

// ==================== M3 Step 7: 观点 + 改变 + 边界 ====================

@Composable
private fun StepOpinionsAndBoundaries(
    data: OnboardingData,
    onUpdate: ((OnboardingData) -> OnboardingData) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(stringResource(R.string.onboarding_step_opinions), style = MaterialTheme.typography.titleMedium)
        OPINION_PROBES.forEach { q ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(q.promptRes), style = MaterialTheme.typography.bodyMedium)
                    q.choices.forEach { opt ->
                        val selected = data.opinionPicks[q.id]?.choiceId == opt.id
                        val choiceLabel = stringResource(opt.labelRes)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(
                                selected = selected,
                                onClick = {
                                    val existingReason = data.opinionPicks[q.id]?.reason ?: ""
                                    onUpdate {
                                        it.copy(
                                            opinionPicks = it.opinionPicks + (q.id to OpinionPick(opt.id, choiceLabel, existingReason)),
                                        )
                                    }
                                },
                            )
                            Text(choiceLabel, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    OutlinedTextField(
                        value = data.opinionPicks[q.id]?.reason ?: "",
                        onValueChange = { v ->
                            val existing = data.opinionPicks[q.id] ?: OpinionPick()
                            onUpdate { it.copy(opinionPicks = it.opinionPicks + (q.id to existing.copy(reason = v))) }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(q.whyRes)) },
                        singleLine = true,
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.m3_changed_q), style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
            value = data.changedMind,
            onValueChange = { v -> onUpdate { it.copy(changedMind = v) } },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.m3_heard_q), style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
            value = data.feelingHeardSignal,
            onValueChange = { v -> onUpdate { it.copy(feelingHeardSignal = v) } },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(stringResource(R.string.m3_shutdown_q), style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
            value = data.shutDownTrigger,
            onValueChange = { v -> onUpdate { it.copy(shutDownTrigger = v) } },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
    }
}

// ==================== Step 8: 匹配偏好（保留） ====================

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepMatchPrefs(
    data: OnboardingData,
    onUpdate: ((OnboardingData) -> OnboardingData) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(stringResource(R.string.onboarding_step_match_prefs), style = MaterialTheme.typography.titleMedium)
        Text(stringResource(R.string.label_match_gender), style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                OnboardingKeys.GENDER_MALE to R.string.gender_male,
                OnboardingKeys.GENDER_FEMALE to R.string.gender_female,
                OnboardingKeys.GENDER_OTHER to R.string.gender_other,
            ).forEach { (key, labelRes) ->
                val selected = data.matchGenderPrefs.contains(key)
                FilterChip(
                    selected = selected,
                    onClick = {
                        onUpdate {
                            val updated = if (selected) it.matchGenderPrefs - key else it.matchGenderPrefs + key
                            it.copy(matchGenderPrefs = updated.distinct())
                        }
                    },
                    label = { Text(stringResource(labelRes)) },
                )
            }
        }
        Text(stringResource(R.string.label_match_age_range, data.matchAgeMin.toInt(), data.matchAgeMax.toInt()))
        RangeSlider(
            value = data.matchAgeMin..data.matchAgeMax,
            onValueChange = { range -> onUpdate { it.copy(matchAgeMin = range.start, matchAgeMax = range.endInclusive) } },
            valueRange = 18f..60f,
        )
        Text(stringResource(R.string.label_match_distance, data.matchDistanceKm.toInt()))
        Slider(
            value = data.matchDistanceKm,
            onValueChange = { v -> onUpdate { it.copy(matchDistanceKm = v) } },
            valueRange = 1f..100f,
        )
    }
}

// ==================== Step 9: 授权 ====================

@Composable
private fun StepConsent() {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(stringResource(R.string.onboarding_step_consent), style = MaterialTheme.typography.titleMedium)
        Text(stringResource(R.string.consent_body), style = MaterialTheme.typography.bodyMedium)
    }
}

// ==================== Step 10: M4 深度对话 ====================

@Composable
private fun StepDialogue(viewModel: OnboardingViewModel) {
    val dialogueLog by viewModel.dialogueLog.collectAsStateWithLifecycle()
    val turns by viewModel.dialogueTurns.collectAsStateWithLifecycle()
    val ready by viewModel.dialogueReady.collectAsStateWithLifecycle()
    val sending by viewModel.dialogueSending.collectAsStateWithLifecycle()
    val dialogueError by viewModel.dialogueError.collectAsStateWithLifecycle()

    var input by remember { mutableStateOf("") }
    val atMax = turns >= OnboardingViewModel.DIALOGUE_MAX_TURNS

    Column(modifier = Modifier.fillMaxSize()) {
        Text(stringResource(R.string.onboarding_step_dialogue), style = MaterialTheme.typography.titleMedium)
        Text(
            stringResource(
                R.string.dialogue_turn_count,
                turns,
                OnboardingViewModel.DIALOGUE_MAX_TURNS,
                OnboardingViewModel.DIALOGUE_MIN_TURNS,
            ),
            style = MaterialTheme.typography.labelMedium,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(stringResource(R.string.dialogue_guide), style = MaterialTheme.typography.bodySmall)
        Spacer(modifier = Modifier.height(8.dp))

        // 消息列表
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            items(dialogueLog) { item ->
                val isUser = item.role == "user"
                Surface(
                    color = if (isUser) MaterialTheme.colorScheme.primaryContainer
                    else MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(if (isUser) 0.8f else 1f),
                ) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        Text(
                            stringResource(if (isUser) R.string.label_you else R.string.label_assistant),
                            style = MaterialTheme.typography.labelSmall,
                        )
                        Text(item.text, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        dialogueError?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        if (!ready) {
            Text(stringResource(R.string.dialogue_preparing), style = MaterialTheme.typography.bodySmall)
        } else if (sending) {
            Text(stringResource(R.string.dialogue_assistant_replying), style = MaterialTheme.typography.bodySmall)
        } else {
            val hintRes = when {
                turns < OnboardingViewModel.DIALOGUE_MIN_TURNS -> R.string.dialogue_min_not_met
                atMax -> R.string.dialogue_at_max
                else -> R.string.dialogue_can_continue
            }
            val hintText = if (turns < OnboardingViewModel.DIALOGUE_MIN_TURNS) {
                stringResource(hintRes, OnboardingViewModel.DIALOGUE_MIN_TURNS, turns)
            } else {
                stringResource(hintRes)
            }
            Text(hintText, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(modifier = Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                modifier = Modifier.weight(1f),
                enabled = ready && !sending && !atMax,
                placeholder = { Text(stringResource(R.string.dialogue_input_hint)) },
                minLines = 1,
                maxLines = 3,
            )
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(
                onClick = {
                    if (input.isNotBlank()) {
                        viewModel.sendDialogueMessage(input)
                        input = ""
                    }
                },
                enabled = ready && !sending && !atMax && input.isNotBlank(),
            ) {
                Icon(Icons.Default.Send, contentDescription = stringResource(R.string.btn_send))
            }
        }
    }
}

// ==================== Step 11: 孵化 ====================

@Composable
private fun StepFinalize(viewModel: OnboardingViewModel) {
    val isSubmitting by viewModel.isSubmitting.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val submitSuccess by viewModel.submitSuccess.collectAsStateWithLifecycle()

    // 进入孵化步自动触发提交
    LaunchedEffect(Unit) {
        if (!isSubmitting && !submitSuccess && error == null) {
            viewModel.submit()
        }
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        if (isSubmitting) {
            CircularProgressIndicator(modifier = Modifier.size(48.dp))
            Spacer(modifier = Modifier.height(16.dp))
        } else {
            Icon(
                Icons.Default.Fingerprint,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.primary,
            )
            Spacer(modifier = Modifier.height(16.dp))
        }
        Text(
            text = if (submitSuccess) "✓" else stringResource(R.string.onboarding_step_finalize),
            style = MaterialTheme.typography.titleLarge,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = if (submitSuccess) stringResource(R.string.btn_confirm_create_clone)
            else stringResource(R.string.onboarding_creating_clone),
            style = MaterialTheme.typography.bodyMedium,
        )
        error?.let {
            Spacer(modifier = Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
}
