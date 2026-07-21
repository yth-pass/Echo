# Phase 2 对话 Agent 重新设计 — 汇总

## 改造概述

将老许（oldfriend / 深交老友）替换为阿辰（disappointed / 有过好感但让你失望的人），解决小鹿与老许关系类型重合的问题。同时将所有 4 个角色统一改为异性，覆盖交友关系发展弧线的四个独立阶段。

---

## 角色总览表

| 角色 | 现实中的关系 | 采集的语气 | 性别 |
|------|------------|-----------|------|
| **阿远** (stranger) | 刚认识的人 | 礼貌试探、第一印象管理、对陌生人的社交策略 | 异性 |
| **小鹿** (bestfriend) | 很聊得来的朋友 | 放松随意、幽默风格、最自然的说话方式 | 异性 |
| **小夜** (crush) | 暗暗心动的人 | 紧张小心、措辞会比较注意、偶尔的暧昧信号 | 异性 |
| **阿辰** (disappointed) | 有过好感但让你失望的人 | 冷下来还是直接怼、失望时的表达方式、冲突中的语言模式 | 异性 |

> 性别规则：女性用户 → 所有角色为男性；男性用户 → 所有角色为女性。通过 `getRoleDefinition(roleName, userGender)` 选择对应 prompt 集。

---

## System Prompt 内容详表

每个角色的 system prompt（静态部分）包含以下固定结构：

| 区块 | 内容 | 阿远 | 小鹿 | 小夜 | 阿辰 |
|------|------|------|------|------|------|
| 身份设定 | 名字 + 关系定位 + 性别 + 场景背景 | 刚认识的人 | 很聊得来的异性朋友 | 暧昧对象，心动未明说 | 有过好感但让你失望的人 |
| SHARED_BAN_LIST | 9 条硬性禁止（AI 身份泄漏/客服式表达/建议/格式/说教/AI 腔黑名单/标点换行/倒字序/断句换行） | 共用 | 共用 | 共用 | 共用 |
| 语言风格 | 句长、emoji 密度、标点偏好、感叹词 | 15-25字 / 0.3 emoji / 句号 / 哈哈 | 5-15字 / 0.5 emoji / 句号 / 我靠卧槽 | 10-20字 / 0.3 emoji / 省略号 / 嗯哦 | 15-25字 / 几乎无 emoji / 句号+省略号 / 嗯那个 |
| 情绪反应规则 | 面对好消息/坏消息/特定情境的反应方式 | 克制开心/轻度关心 | 夸张即时/条件反射 | 温柔内敛/欲言又止 | 先解释后软化/防御但理亏 |
| 不完美行为 | 话题跑偏/抢话/打错字/分享脆弱等 | 偶尔跑偏/接不住话题 | 经常抢话/突然分享自己/打错字 | 欲言又止/话题转向感受/分享柔软 | 转移注意力/牵强解释/辩解说不圆 |
| 收尾方式 | 专属告别语 | "那先这样，下次约咖啡～" | "行我去洗澡了，回聊" | "困了。晚安。" | "嗯。那我先不打扰你了。" |

---

## 完整提示词组成成分及来源

每轮对话发送给 LLM 的完整 system prompt 由 **5 个成分** 拼接而成：

### 成分 1：静态 System Prompt

| 项 | 说明 |
|----|------|
| **内容** | 角色身份 + 性别 + SHARED_BAN_LIST + 语言风格规则 + 情绪反应规则 + 不完美行为 + 收尾方式 |
| **来源** | `roleplay-agents.ts` 中硬编码 |
| **如何选择** | `getRoleDefinition(roleName, userGender)`：女性用户取 `ROLE_DEFINITIONS`（男 agent），男性用户取 `MALE_USER_ROLE_DEFINITIONS`（女 agent） |
| **何时使用** | `startChat()` 初始化 + `chatTurn()` 每轮注入 |

### 成分 2：性别占位符解析

| 项 | 说明 |
|----|------|
| **内容** | `{FRIEND_TERM}` → 兄弟/姐妹/朋友（向后兼容，新 prompt 已不使用此占位符） |
| **来源** | `resolveGenderPrompt(prompt, survey)` 根据 `survey.identity.genderIdentity` 替换 |
| **何时使用** | `startChat()` + `chatTurn()`，拼接在成分 1 之后 |

### 成分 3：个性化角色档案（AI 定制化生成）

| 项 | 说明 |
|----|------|
| **内容** | 5 个字段：`personality`（性格 2-3 句）、`speechStyle`（说话风格）、`sharedContext`（共同背景/经历）、`relationshipDynamics`（关系动态）、`topicAffinity`（共鸣话题） |
| **来源** | `generateAgentProfiles(userId)` 调用 LLM 生成 |
| **LLM 输入** | ① 用户基本信息（名字/性别/年龄/职业/兴趣）② 人格画像 narrative + 4 个 section ③ Phase 1 的 15 张卡片回答摘要 ④ genderNote（指定所有角色为异性） |
| **生成时机** | Phase 1.7 步骤，画像完成后自动触发 |
| **存储位置** | `survey.agentProfiles[roleName]` → `OnboardingSession.surveyJson` |
| **何时使用** | `buildPersonaContext()` 读取并拼接到 prompt 中 |

### 成分 4：用户特征上下文

| 项 | 说明 |
|----|------|
| **内容** | 用户性格质感（前 80 字）、关心方式（前 60 字）、兴趣列表 |
| **来源** | `buildPersonaContext()` 从 `survey.personaSketch.sections` + `survey.interests` 提取 |
| **何时使用** | 当成分 3 不存在时的 fallback；或与成分 3 同时存在时作为补充 |
| **注意** | 阿辰额外注入完整画像 narrative + 矛盾标记（因为之前有过好感，了解对方），与老许原逻辑一致；其他三个角色只注入简要特征 |

### 成分 5：行为提示（动态注入）

| 项 | 说明 |
|----|------|
| **内容** | 话题跑偏提示 / 忘记前文提示 / 不同意用户提示 / 脆弱分享提示 / 告别提示 |
| **来源** | `chatTurn()` 中概率触发：topicDrift 20% / forgetContext 5% / disagree 10% / vulnerability（对话>6轮且未分享过时触发）/ farewell（用户说了结束语时触发） |
| **何时使用** | 每轮对话，拼接在完整 prompt 末尾 |

### 后处理：AI 腔黑名单过滤

| 项 | 说明 |
|----|------|
| **内容** | 30+ 条 AI 腔表达黑名单检测 |
| **来源** | `detectAiSpeech(text)` 对 LLM 输出做字符串匹配 |
| **触发时** | 命中黑名单 → 追加警告消息重生成 1 次（temperature 0.9）；二次仍命中 → 用角色化 fallback 回复 |

---

## 拼接顺序

```
完整 system prompt =
  [成分1] 静态 system prompt（角色身份 + 行为规则）
  + [成分2] 性别占位符解析
  + "\n\n"
  + [成分3] 个性化角色档案（AI 生成，如果存在）
  + [成分4] 用户特征上下文（fallback 或补充）
  + [成分5] 行为提示（概率注入）
```

---

## 改动文件清单

| 文件 | 改动内容 |
|------|---------|
| `services/api/src/onboarding/roleplay-agents.ts` | RoleName oldfriend→disappointed；新增阿辰 prompt（男/女）；重写阿远/小鹿 prompt 为异性；小夜女版替换原 CRUSH_PROMPT_MALE；ROLE_DEFINITIONS + MALE_USER_ROLE_DEFINITIONS 全量更新 |
| `services/api/src/onboarding/roleplay-agent.service.ts` | 错误消息/JSON 模板/genderNote/buildPersonaContext/followUps/fallbacks/hasAny 检查中 oldfriend→disappointed；移除老许专属画像注入逻辑 |
| `services/api/src/onboarding/survey-schema.ts` | RoleplayChat.roleName + AgentProfiles 类型 oldfriend→disappointed |
| `services/api/src/onboarding/onboarding.dto.ts` | 2 处 IsEnum + 类型 oldfriend→disappointed |
| `services/api/test/roleplay-agent.spec.ts` | 移除 oldfriend 专属测试（矛盾注入/画像注入），改为 disappointed 走标准路径的测试 |
| `Echo/src/features/onboarding/v2/onboarding-v2.types.ts` | RoleId 类型 oldfriend→disappointed |
| `Echo/src/features/onboarding/v2/onboarding-v2.api.ts` | AgentProfilesResponse 类型 oldfriend→disappointed |
| `Echo/src/features/onboarding/v2/roleplay-agents.data.ts` | 展示定义：老许→阿辰，描述更新 |
| `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx` | ROLE_RELATIONSHIP + ROLE_TONE_HINT 映射更新 |

## 验证

- 后端 `tsc --noEmit` 退出码 0
- 前端 `tsc --noEmit` 退出码 0
