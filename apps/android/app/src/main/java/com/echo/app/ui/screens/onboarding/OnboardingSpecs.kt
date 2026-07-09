package com.echo.app.ui.screens.onboarding

import androidx.annotation.StringRes
import com.echo.app.R

/**
 * 四层人格采集模型题目定义（与 Web 端 surveySteps.ts 对齐）。
 * 把选项数据从 Composable 里抽出来，便于 ViewModel 校验和单测。
 */

data class ChoiceOption(
    val id: String,
    val labelRes: Int,
)

/** M2 语气标签（与 Web 端一致，直接用中文，不走 stringRes） */
val TONE_TAG_OPTIONS: List<String> = listOf("松弛", "直接", "温柔", "幽默", "理性", "热情")

/** M2 6 个语言场景 */
data class ScenarioSpec(
    val id: String,
    val promptRes: Int,
    val choices: List<ChoiceOption>,
    /** 关系情境追问，null 表示该场景无追问（如 match 场景本身即针对陌生人） */
    val relationFollowupRes: Int?,
)

val STYLE_SCENARIOS: List<ScenarioSpec> = listOf(
    ScenarioSpec(
        id = "weekend",
        promptRes = R.string.scenario_weekend_q,
        choices = listOf(
            ChoiceOption("a", R.string.scenario_weekend_a),
            ChoiceOption("b", R.string.scenario_weekend_b),
            ChoiceOption("c", R.string.scenario_weekend_c),
        ),
        relationFollowupRes = R.string.m2_relation_followup,
    ),
    ScenarioSpec(
        id = "disagree",
        promptRes = R.string.scenario_disagree_q,
        choices = listOf(
            ChoiceOption("a", R.string.scenario_disagree_a),
            ChoiceOption("b", R.string.scenario_disagree_b),
            ChoiceOption("c", R.string.scenario_disagree_c),
        ),
        relationFollowupRes = R.string.m2_relation_followup,
    ),
    ScenarioSpec(
        id = "match",
        promptRes = R.string.scenario_match_q,
        choices = listOf(
            ChoiceOption("a", R.string.scenario_match_a),
            ChoiceOption("b", R.string.scenario_match_b),
            ChoiceOption("c", R.string.scenario_match_c),
        ),
        relationFollowupRes = null,
    ),
    ScenarioSpec(
        id = "excitement",
        promptRes = R.string.scenario_excitement_q,
        choices = listOf(
            ChoiceOption("a", R.string.scenario_excitement_a),
            ChoiceOption("b", R.string.scenario_excitement_b),
            ChoiceOption("c", R.string.scenario_excitement_c),
        ),
        relationFollowupRes = R.string.m2_relation_followup,
    ),
    ScenarioSpec(
        id = "comfort",
        promptRes = R.string.scenario_comfort_q,
        choices = listOf(
            ChoiceOption("a", R.string.scenario_comfort_a),
            ChoiceOption("b", R.string.scenario_comfort_b),
            ChoiceOption("c", R.string.scenario_comfort_c),
        ),
        relationFollowupRes = R.string.m2_relation_followup,
    ),
    ScenarioSpec(
        id = "vent",
        promptRes = R.string.scenario_vent_q,
        choices = listOf(
            ChoiceOption("a", R.string.scenario_vent_a),
            ChoiceOption("b", R.string.scenario_vent_b),
            ChoiceOption("c", R.string.scenario_vent_c),
        ),
        relationFollowupRes = R.string.m2_relation_followup,
    ),
)

/** M3 价值观问题 */
data class ValuesQuestion(
    val id: String,
    val promptRes: Int,
    val choices: List<ChoiceOption>,
    val whyRes: Int,
)

val VALUES_QUESTIONS: List<ValuesQuestion> = listOf(
    ValuesQuestion(
        id = "pace",
        promptRes = R.string.m3_pace_q,
        choices = listOf(
            ChoiceOption("meet", R.string.m3_pace_meet),
            ChoiceOption("build", R.string.m3_pace_build),
        ),
        whyRes = R.string.m3_why_prompt,
    ),
    ValuesQuestion(
        id = "conflict",
        promptRes = R.string.m3_conflict_q,
        choices = listOf(
            ChoiceOption("talk", R.string.m3_conflict_talk),
            ChoiceOption("space", R.string.m3_conflict_space),
        ),
        whyRes = R.string.m3_why_prompt,
    ),
)

/** M3 日常观点探针 */
data class OpinionQuestion(
    val id: String,
    val promptRes: Int,
    val choices: List<ChoiceOption>,
    val whyRes: Int,
)

val OPINION_PROBES: List<OpinionQuestion> = listOf(
    OpinionQuestion(
        id = "effort",
        promptRes = R.string.opinion_effort_q,
        choices = listOf(
            ChoiceOption("agree", R.string.opinion_effort_agree),
            ChoiceOption("partial", R.string.opinion_effort_partial),
            ChoiceOption("disagree", R.string.opinion_effort_disagree),
        ),
        whyRes = R.string.m3_why_prompt,
    ),
    OpinionQuestion(
        id = "socialMedia",
        promptRes = R.string.opinion_social_q,
        choices = listOf(
            ChoiceOption("inspired", R.string.opinion_social_inspired),
            ChoiceOption("neutral", R.string.opinion_social_neutral),
            ChoiceOption("tired", R.string.opinion_social_tired),
        ),
        whyRes = R.string.m3_why_prompt,
    ),
    OpinionQuestion(
        id = "loan",
        promptRes = R.string.opinion_loan_q,
        choices = listOf(
            ChoiceOption("ask", R.string.opinion_loan_ask),
            ChoiceOption("hint", R.string.opinion_loan_hint),
            ChoiceOption("swallow", R.string.opinion_loan_swallow),
        ),
        whyRes = R.string.m3_why_prompt,
    ),
    OpinionQuestion(
        id = "rareQuality",
        promptRes = R.string.opinion_rare_q,
        choices = listOf(
            ChoiceOption("honest", R.string.opinion_rare_honest),
            ChoiceOption("stable", R.string.opinion_rare_stable),
            ChoiceOption("curious", R.string.opinion_rare_curious),
            ChoiceOption("kind", R.string.opinion_rare_kind),
        ),
        whyRes = R.string.m3_why_prompt,
    ),
)

/** M2 聊天习惯选项 */
data class HabitOption(
    val key: String, // 对应 ChatHabits 字段名
    val labelRes: Int,
)

val CHAT_HABIT_OPTIONS = listOf(
    HabitOption("usesPunctuation", R.string.habit_punctuation),
    HabitOption("likesEmoji", R.string.habit_emoji),
    HabitOption("prefersShortMessages", R.string.habit_short),
    HabitOption("sendsVoiceMessages", R.string.habit_voice),
)

/** M2 情绪反应选项 */
val BAD_MOOD_OPTIONS = listOf(
    "陪我聊聊" to R.string.mood_chat,
    "给我空间" to R.string.mood_space,
    "逗我开心" to R.string.mood_cheer,
    "不用管我" to R.string.mood_leave,
)

val HAPPY_EXPR_OPTIONS = listOf(
    "立刻分享" to R.string.happy_share,
    "自己消化一会" to R.string.happy_sit,
    "请客庆祝" to R.string.happy_treat,
    "发朋友圈" to R.string.happy_post,
)

/** M1 社交角色选项 */
val FRIEND_ROLE_OPTIONS = listOf(
    "倾听者" to R.string.role_listener,
    "分享者" to R.string.role_sharer,
    "兼有" to R.string.role_both,
)

val GROUP_ROLE_OPTIONS = listOf(
    "观察者" to R.string.role_observer,
    "气氛组" to R.string.role_hype,
    "视情况" to R.string.role_context,
)

/** M1 职业选项 */
val OCCUPATION_OPTIONS = listOf(
    "互联网", "金融", "教育", "医疗", "学生", "自由职业", "其他",
)

/** 关系目标选项（goal） */
val GOAL_OPTIONS = listOf(
    "认真约会" to R.string.goal_serious,
    "先交朋友" to R.string.goal_friends,
    "慢慢来" to R.string.goal_slow,
)

/** 模块元信息（用于进度展示） */
data class ModuleMeta(
    val id: String,
    val titleRes: Int,
)

/** 12 步对应的模块（用于进度条副标题） */
val STEP_MODULE: List<ModuleMeta> = listOf(
    ModuleMeta("m1", R.string.onboarding_module_m1), // 0 basics
    ModuleMeta("m1", R.string.onboarding_module_m1), // 1 self
    ModuleMeta("m1", R.string.onboarding_module_m1), // 2 interests+social
    ModuleMeta("m2", R.string.onboarding_module_m2), // 3 tone+habits
    ModuleMeta("m2", R.string.onboarding_module_m2), // 4 scenarios
    ModuleMeta("m2", R.string.onboarding_module_m2), // 5 writing
    ModuleMeta("m3", R.string.onboarding_module_m3), // 6 values
    ModuleMeta("m3", R.string.onboarding_module_m3), // 7 opinions
    ModuleMeta("match", R.string.onboarding_step_match_prefs), // 8 match prefs
    ModuleMeta("consent", R.string.onboarding_module_consent), // 9 consent
    ModuleMeta("m4", R.string.onboarding_module_m4), // 10 dialogue
    ModuleMeta("finalize", R.string.onboarding_module_finalize), // 11 finalize
)
