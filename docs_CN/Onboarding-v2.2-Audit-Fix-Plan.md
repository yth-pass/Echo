# Echo Onboarding v2.2 — 审计修补方案（5 阶段 + Agent 提示词）

> 本文档基于 `Onboarding-v2.2-Implementation-Audit.md` 识别的 9 个问题，拆为 5 个独立修复阶段（F1-F5）。
> 每阶段附带精确到行号的改动位置和可直接交给 Agent 的结构化提示词。

---

## 修补阶段总览

| 阶段 | 名称 | 涉及问题 | 改动层 | 优先级 | 依赖 |
|------|------|---------|--------|--------|------|
| F1 | 前端 Phase 0 字段修复 | #1 #2 #6 | Echo/ | P0 | 无 |
| F2 | 后端 embedding 互斥修复 | #3 | services/api | P0 | 无 |
| F3 | 后端 Rule 7 矛盾注入 | #8 | services/api | P1 | 无 |
| F4 | 文档与注释同步 | #4 #5 #7 | docs + worker | P2 | 无 |
| F5 | DTO 深度校验补全 | #9 | services/api | P2 | 无 |

**五个阶段彼此独立，可并行执行。** F1-F3 是高/中优先级，建议先做；F4-F5 是低优先级文档和防御性改进，可后续补。

---

## F1：前端 Phase 0 字段修复

### 涉及审计问题

- **#1** `industry` 未独立采集，直接复制 `occupation`
- **#2** `familyMembers` 表单输入被丢弃（类型不匹配）
- **#6** `displayName` 未作为独立字段采集

### 改动文件

| 文件 | 改动 |
|------|------|
| `echo/src/features/onboarding/v2/phase0-fields.data.ts` | 新增 `displayName`（第 0 位）和 `industry`（occupation 之后）字段定义；将 `familyMembers` 字段类型从 `text` 改为 `tag-input` 并调整 placeholder |
| `echo/src/features/onboarding/v2/Phase0Identity.tsx` | 修复 payload 构建器：`displayName` 从新字段读取，`industry` 从新字段读取，`familyMembers` 从新字段解析为 `FamilyMember[]` |
| `echo/src/features/onboarding/v2/onboarding-v2.types.ts` | 如需调整 `Phase0Payload` 类型中 `familyMembers` 的结构 |

### 提示词

```
你是一名 React + TypeScript 前端工程师，正在修复 Echo 入驻 v2 Phase 0 的三个字段采集缺陷。

## 背景
审计发现 Phase 0 渐进式名片 UI 中有三个字段存在数据采集问题：
1. `displayName`（昵称）没有独立采集，payload 中直接复制了 `preferredAddress` 的值
2. `industry`（行业）没有独立采集，payload 中直接复制了 `occupation` 的值
3. `familyMembers`（家庭信息）在表单中是纯文本输入，但类型期望 FamilyMember[]，
   payload 构建时直接设为 undefined，用户输入被丢弃

## 当前代码位置

### phase0-fields.data.ts（echo/src/features/onboarding/v2/phase0-fields.data.ts）
`PHASE0_FIELDS` 数组当前有 12 个字段（行 64-166），缺少 `displayName` 和 `industry`。

### Phase0Identity.tsx（echo/src/features/onboarding/v2/Phase0Identity.tsx）
payload 构建器在行 64-79：
- 行 65: `displayName: (formData.preferredAddress as string) ?? 'Echo 用户'` ← 错误来源
- 行 73: `industry: (formData.occupation as string) ?? ''` ← 错误来源
- 行 78: `familyMembers: undefined` ← 丢弃用户输入

## 任务 1：新增 displayName 字段

在 `phase0-fields.data.ts` 的 `PHASE0_FIELDS` 数组**最前面**（preferredAddress 之前）插入：

{
  key: 'displayName',
  label: '你的昵称',
  subtitle: '在 Echo 上大家怎么叫你？',
  type: 'text',
  placeholder: '比如：小明、Echo、阿杰…',
  required: true,
  maxLength: 20,
}

这样 displayName 成为表单的第一个字段（用户最先看到的），preferredAddress 成为第二个。

## 任务 2：新增 industry 字段

在 `PHASE0_FIELDS` 数组中，紧接在 `occupation` 字段之后插入：

{
  key: 'industry',
  label: '所在行业',
  subtitle: '你所在的行业领域是？',
  type: 'choice',
  options: [
    '互联网/科技', '金融/投资', '教育/学术', '医疗/健康',
    '公务员/事业单位', '媒体/内容', '创业', '学生',
    '自由职业', '制造/工程', '文化/艺术', '其他',
  ],
  required: true,
}

注意：`industry` 在 DTO 中是 string 类型（自由文本），这里用 choice 是为了降低用户输入负担。
选项值即为提交的字符串。如果用户选"其他"，可以显示一个补充文本框。

## 任务 3：修复 familyMembers 字段

将 `PHASE0_FIELDS` 中现有的 `familyMembers` 字段定义修改为结构化输入：

{
  key: 'familyMembers',
  label: '家庭信息（可选）',
  subtitle: '添加你愿意分享的家庭成员，后续可在 Profile 中补充',
  type: 'family-input',    // 新类型，需要 FieldCard 支持
  required: false,
  placeholder: '例如：爸爸是老师 / 妹妹在读研',
}

同时需要处理两种方案之一（选方案 A）：

### 方案 A：扩展 FieldCard 支持 family-input 类型
在 FieldCard.tsx 中新增一个 `family-input` case：
- 显示一个可动态增减的表单列表
- 每行两个字段：relation（下拉选择：父亲/母亲/兄弟姐妹/伴侣/其他）+ brief（文本输入，限 20 字）
- 底部"+ 添加家庭成员"按钮
- 输出值为 FamilyMember[] 数组

### 方案 B（更简单，如果不想改 FieldCard）：
保持 `familyMembers` 为 `text` 类型，但在 payload 构建时将文本解析为 FamilyMember[]：
- 按换行符或分号分割
- 每行尝试匹配 "关系:描述" 或 "关系 描述" 模式
- 无法解析的行归为 { relation: 'other', brief: line }
- 这种方案用户体验较差，**优先选方案 A**

## 任务 4：修复 Phase0Identity.tsx payload 构建器

修改 payload 构建逻辑（行 64-79）：

const payload: Phase0Payload = {
  displayName: (formData.displayName as string) ?? '',      // ← 从新字段读
  preferredAddress: (formData.preferredAddress as string) ?? '',
  genderIdentity: (formData.genderIdentity as GenderOption) ?? 'undisclosed',
  ageBand: (formData.ageBand as AgeBand) ?? '23-27',
  hometownCity: (formData.hometownCity as string) ?? '',
  currentCity: (formData.currentCity as string) ?? '',
  education: (formData.education as EducationLevel) ?? 'bachelor',
  occupation: (formData.occupation as string) ?? '',
  industry: (formData.industry as string) ?? '',             // ← 从新字段读
  workDescription: (formData.workDescription as string) ?? '',
  keyLifeExperiences: (formData.keyLifeExperiences as string[]) ?? [],
  selfIntroOneLiner: (formData.selfIntroOneLiner as string) ?? '',
  goalOnEcho: (formData.goalOnEcho as string) ?? undefined,
  familyMembers: (formData.familyMembers as FamilyMember[]) ?? undefined,  // ← 从新字段读
};

## 任务 5：更新进度计数

PHASE0_FIELDS 现在有 14 个字段（新增 displayName + industry），确认进度条和步骤计数从 "X/12" 自动适配为 "X/14"。
检查 Phase0Identity.tsx 中 TOTAL_FIELDS 常量或计算逻辑是否基于 PHASE0_FIELDS.length。

## 验证
1. 启动 echo 前端 dev server
2. 进入入驻 Phase 0，确认：
   - 第一个字段是"你的昵称"
   - occupation 之后有"所在行业"选择
   - 家庭信息是结构化多行输入
3. 走完后检查 POST /onboarding/phase0 的请求 body，确认 displayName、industry 各自独立
4. tsc --noEmit 零错误

## 不要做的事
- 不要修改后端 DTO（它已经正确了）
- 不要删除现有字段
- 不要改变 OnboardingShell 的状态机逻辑
```

---

## F2：后端 embedding 互斥修复

### 涉及审计问题

- **#3** `buildTextForEmbedding` 中 `keyExperience` 和 `identity.keyLifeExperiences` 未互斥，导致 embedding 文本中出现两段"关键经历"

### 改动文件

| 文件 | 改动 |
|------|------|
| `services/api/src/onboarding/survey-schema.ts` | 行 334-338：改为 if/else if 互斥 |

### 提示词

```
你是一名 TypeScript 工程师，正在修复 Echo 入驻问卷 embedding 文本生成中的一个重复字段 bug。

## 背景
`buildTextForEmbedding()` 函数（survey-schema.ts）在构建向量化文本时，同时推送了旧版
`survey.keyExperience`（单条字符串）和新版 `survey.identity.keyLifeExperiences`（字符串数组），
两者用相同的标签 `关键经历:` 推入 parts 数组，导致 embedding 文本中出现两段重复的"关键经历"。

当前代码（行 334-338）：
```typescript
if (survey.keyExperience?.trim()) parts.push(`关键经历:${survey.keyExperience.trim()}`);
// v2.2: identity.keyLifeExperiences 数组替换旧单条（如两者都有，数组优先）
if (survey.identity?.keyLifeExperiences?.length) {
  parts.push(`关键经历:${survey.identity.keyLifeExperiences.join('；')}`);
}
```

注释说"数组优先"，但代码没有实现互斥——两个 if 是独立的。

## 修复

将上述两个 if 改为 if/else if，实现互斥：

```typescript
// v2.2: identity.keyLifeExperiences 数组优先，降级到旧版单条
if (survey.identity?.keyLifeExperiences?.length) {
  parts.push(`关键经历:${survey.identity.keyLifeExperiences.join('；')}`);
} else if (survey.keyExperience?.trim()) {
  parts.push(`关键经历:${survey.keyExperience.trim()}`);
}
```

这个写法与 `style-generator.service.ts`（行 114-115）中的同字段处理保持一致（那里已经用了 if/else if）。

## 验证
1. 构造一个同时有 `keyExperience: "支教一年"` 和 `identity.keyLifeExperiences: ["创业失败", "独自旅行"]` 的 survey 对象
2. 调用 `buildTextForEmbedding(profile, survey, userId)`
3. 确认输出中只有一段 `关键经历:创业失败；独自旅行`，没有 `关键经历:支教一年`
4. 构造一个只有旧版 `keyExperience` 的 survey 对象，确认降级正常工作
5. tsc --noEmit 零错误

## 不要做的事
- 不要修改 buildPersonaSeedFromSurvey 函数
- 不要修改 buildSeed 函数（它已经是正确的）
- 不要改变 parts 数组中其他字段的顺序
```

---

## F3：后端 Rule 7 矛盾注入 + null-guard

### 涉及审计问题

- **#8** Rule 7（记忆与矛盾）缺乏服务层支持——`contradictions` 未被注入到任何角色的上下文中；`buildPersonaContext` 缺少 null-guard

### 改动文件

| 文件 | 改动 |
|------|------|
| `services/api/src/onboarding/roleplay-agent.service.ts` | `buildPersonaContext()` 方法：为 oldfriend 注入 contradictions；添加 sections null-guard |

### 提示词

```
你是一名 TypeScript 工程师，正在修复 Echo Phase 2 角色扮演系统中 Rule 7（记忆与矛盾）的服务层缺陷。

## 背景
审计发现 `roleplay-agent.service.ts` 中的 `buildPersonaContext()` 方法（约行 524-555）
存在两个问题：

1. **缺少 null-guard**：行 544 直接访问 `sketch.sections.personalityTexture`，
   没有先检查 `sketch.sections` 是否存在。如果 personaSketch 对象不完整
   （sections 为 undefined），会抛运行时错误。

2. **contradictions 未注入**：老许（oldfriend）的角色定位是"看过 Phase 1.5 人格画像、
   主动引用画像追问矛盾"的角色，但 `buildPersonaContext` 只注入了 `sketch.narrative`，
   没有单独提取 `sketch.sections.contradictions` 供老许在对话中有意识地追问。

当前代码（约行 534-539，老许分支）：
```typescript
if (roleName === 'oldfriend') {
  return (
    `【你认识的${name} — 来自画像的参考信息，你可以自然地引用和追问】\n` +
    `${sketch.narrative}`
  );
}
```

当前代码（约行 542-555，其他角色分支）：
```typescript
const parts = [`【关于${name}的一些特征，帮助你更自然地对话】`];
if (sketch.sections.personalityTexture) {     // ← 缺少 sections null-guard
  parts.push(`性格：${sketch.sections.personalityTexture.slice(0, 80)}`);
}
if (sketch.sections.caringStyle) {             // ← 同上
  parts.push(`关心方式：${sketch.sections.caringStyle.slice(0, 60)}`);
}
```

## 修复 1：添加 sections null-guard

在其他角色分支的开头添加 sections 存在性检查：

```typescript
const sections = sketch.sections;
if (!sections) return parts.join('\n');  // 没有 sections 就只返回标题行
```

## 修复 2：为老许注入 contradictions

在老许分支中，追加 contradictions 内容（如果存在）：

```typescript
if (roleName === 'oldfriend') {
  let ctx =
    `【你认识的${name} — 来自画像的参考信息，你可以自然地引用和追问】\n` +
    `${sketch.narrative}`;

  // 单独提取矛盾标记，供老许有意识地追问
  if (sketch.sections?.contradictions?.trim()) {
    ctx += `\n\n【${name}的内在矛盾 — 在适当时机自然地追问，不要生硬引用】\n${sketch.sections.contradictions}`;
  }

  return ctx;
}
```

注意：
- 使用 optional chaining `sketch.sections?.contradictions` 避免 sections 为 undefined 时报错
- 指令措辞是"自然地追问"，不是"直接读出矛盾"——老许不应该像读报告一样念给用户听

## 验证
1. 构造一个有完整 personaSketch 的 survey 对象，包含 contradictions 节
2. 调用 `buildPersonaContext(survey, 'oldfriend')`，确认输出包含矛盾标记段落
3. 调用 `buildPersonaContext(survey, 'bestfriend')`，确认不报错
4. 构造一个 sections 为 undefined 的 personaSketch，调用所有角色，确认不抛异常
5. tsc --noEmit 零错误

## 不要做的事
- 不要修改 4 个角色的 system prompt（它们在 roleplay-agents.ts 中）
- 不要修改 chatTurn 或 endChat 逻辑
- 不要改变其他角色（非 oldfriend）的上下文注入内容
```

---

## F4：文档与注释同步

### 涉及审计问题

- **#4** 文档说"10 个必填"但实际列了 12 个字段名
- **#5** 文档引用 `roleplay-prompts.ts` 但实际文件名为 `roleplay-agents.ts`
- **#7** `prompt-composer.ts` 文件头注释的 L0-L8 编号与函数体不一致

### 改动文件

| 文件 | 改动 |
|------|------|
| `docs_CN/Onboarding-v2.2-Implementation-Plan.md` | 修正"10 个必填"为"12 个必填"；修正文件名引用 |
| `services/worker/src/agent-platform/composer/prompt-composer.ts` | 统一文件头注释中的 L0-L8 编号 |

### 提示词

```
你是一名技术文档维护者，正在同步 Echo 项目的实施文档和代码注释，使其与已实现的代码一致。

## 任务 1：修正实施计划文档中的字段计数

文件：docs_CN/Onboarding-v2.2-Implementation-Plan.md

在 S2 章节中找到以下内容（约行 204-208）：
```
1. 校验必填字段（10 个必填 + 2 个可选）：
```

改为：
```
1. 校验必填字段（12 个必填 + 2 个可选）：
```

理由：下方紧接着列出的字段名确实有 12 个（displayName 到 selfIntroOneLiner），
原文的"10"是计数笔误。

## 任务 2：修正文件名引用

文件：docs_CN/Onboarding-v2.2-Implementation-Plan.md

在 S5 章节中找到以下文件名引用：
- `services/api/src/onboarding/roleplay-prompts.ts`

改为：
- `services/api/src/onboarding/roleplay-agents.ts`

理由：实际实现中角色 prompt 定义在 `roleplay-agents.ts` 而非 `roleplay-prompts.ts`。
搜索文档中所有出现 `roleplay-prompts.ts` 的位置，全部替换。

同时在 S5 的"改动文件"表格中，如果存在 roleplay-prompts.ts 的行，将文件名改为 roleplay-agents.ts。

## 任务 3：统一 prompt-composer.ts 文件头注释

文件：services/worker/src/agent-platform/composer/prompt-composer.ts

当前文件头注释（约行 6-15）：
```
/**
 * M1 Prompt Composer — Shared Layer Loader
 *
 * Layer mapping (per prompt-layers.md):
 *   L0 = safety.md          (absolute highest priority, ~300 tokens target)
 *   L1 = SKILL.md           (core capability & role, ~400 tokens target)
 *   L2 = persona + boundary (user voice, injected per turn)
 *   L8 = output contract    (strict reply-only discipline)
 *
 * Token budget guideline for M1 (safety + skill combined): < 800 tokens.
```

改为（与函数体中的实际变量名 l0/l1 对齐）：
```
/**
 * M1 Prompt Composer — Shared Layer Loader
 *
 * Layer mapping (v2.2 aligned with implementation):
 *   L0 = SKILL.md           (core role baseline, ~400 tokens target)
 *   L1 = safety.md + boundaryClause (non-violable premises, ~300+ tokens)
 *   L2 = sanitized persona  (user voice, injected per turn)
 *   L3-L6 = memory layers   (reserved, currently unused)
 *   L8 = output contract    (strict reply-only discipline)
 *
 * Token budget guideline for M0+M1 (skill + safety combined): < 800 tokens.
```

注意：只改注释，不改任何代码逻辑。函数体中 `const l0 = SKILL_MD` 和
`const l1 = ...safety...` 是正确的实现，注释应该跟着代码走。

## 验证
- 全文搜索确认没有遗漏的 `roleplay-prompts.ts` 引用
- 确认 prompt-composer.ts 的 tsc --noEmit 仍为零错误
- 不需要运行测试（纯文档/注释变更）

## 不要做的事
- 不要修改任何 .ts 文件的代码逻辑
- 不要修改 safety.md 文件（它自称 L0 的问题需要单独讨论，不在本次修复范围）
```

---

## F5：DTO 深度校验补全

### 涉及审计问题

- **#9** `PersonaSketchDto.sections` 使用 `@IsObject()` 但缺少 `@ValidateNested()`，导致空对象 `{}` 也能通过校验

### 改动文件

| 文件 | 改动 |
|------|------|
| `services/api/src/onboarding/onboarding.dto.ts` | 新增 `PersonaSketchSectionsDto` 类；`PersonaSketchDto.sections` 改用 `@ValidateNested()` + `@Type()` |

### 提示词

```
你是一名 NestJS 后端工程师，正在为 Echo 入驻 DTO 补充深度校验。

## 背景
`onboarding.dto.ts` 中的 `PersonaSketchDto`（约行 232-250）的 `sections` 字段
使用 `@IsObject()` 做校验，但没有 `@ValidateNested()` + `@Type()`。
这意味着 `sections: {}` 或 `sections: { identityNarrative: 123 }` 都能通过校验，
因为 `@IsObject()` 只检查值是否为 object 类型，不检查内部结构。

当前代码（约行 232-250）：
```typescript
export class PersonaSketchDto {
  @IsString()
  narrative!: string;

  @IsObject()
  sections!: {
    identityNarrative: string;
    personalityTexture: string;
    // ... 6 more fields
  };

  @IsNumber()
  generationTimestamp!: number;
}
```

## 修复

### 步骤 1：新建 PersonaSketchSectionsDto 类

在 PersonaSketchDto 之前插入：

```typescript
export class PersonaSketchSectionsDto {
  @IsString()
  identityNarrative!: string;

  @IsString()
  personalityTexture!: string;

  @IsString()
  coreBeliefs!: string;

  @IsString()
  valuesInAction!: string;

  @IsString()
  caringStyle!: string;

  @IsString()
  socialBoundaries!: string;

  @IsString()
  contradictions!: string;

  @IsArray()
  @IsString({ each: true })
  voiceAnchors!: string[];
}
```

### 步骤 2：修改 PersonaSketchDto.sections

将 `@IsObject()` 替换为 `@ValidateNested()` + `@Type()`：

```typescript
export class PersonaSketchDto {
  @IsString()
  narrative!: string;

  @ValidateNested()
  @Type(() => PersonaSketchSectionsDto)
  sections!: PersonaSketchSectionsDto;

  @IsNumber()
  generationTimestamp!: number;
}
```

### 步骤 3：确认 import

确认文件顶部已经 import 了 `ValidateNested` 和 `Type`：
- `import { ..., ValidateNested, ... } from 'class-validator';`
- `import { Type } from 'class-transformer';`

如果已经有了就不用加（大概率已经有了，因为其他 DTO 如 UserFeedbackDto 已经使用了这两个装饰器）。

## 验证
1. 用 curl/Postman 发送 `persona-sketch/generate` 请求，确认正常响应不受影响
2. 发送一个 `sections: {}` 的伪造请求，确认返回 400 校验错误
3. 发送一个 `sections: { identityNarrative: 123 }` 的请求，确认返回 400
4. tsc --noEmit 零错误
5. 运行现有测试确认不破坏回归

## 不要做的事
- 不要修改其他 DTO（StyleProfileDto 等的宽松校验是有意为之，因为结构过于复杂）
- 不要修改 persona-sketch.service.ts 的逻辑
- 不要给 generationTimestamp 添加额外校验（@IsNumber 已经足够）
```

---

## 附：执行优先级与依赖图

```
F1 (前端 Phase 0) ─── 独立，P0
F2 (embedding 互斥) ─── 独立，P0
F3 (Rule 7 矛盾注入) ─── 独立，P1
F4 (文档同步) ─── 独立，P2
F5 (DTO 深度校验) ─── 独立，P2
```

五个阶段完全独立，没有依赖链。建议按优先级从高到低执行：F1 → F2 → F3 → F4/F5。

## 附：修复后验证检查清单

| 阶段 | 验证方法 |
|------|---------|
| F1 | 浏览器走完 Phase 0，确认 14 个字段依次出现；POST body 中 displayName ≠ preferredAddress，industry ≠ occupation |
| F2 | 单元测试：同时提供 keyExperience + keyLifeExperiences，确认 embedding 文本只有一段 |
| F3 | 调用 buildPersonaContext(survey, 'oldfriend')，确认输出含"内在矛盾"段落；sections 为 undefined 时不抛异常 |
| F4 | 全文搜索 "roleplay-prompts.ts" 零命中；prompt-composer.ts 注释与代码 L0/L1 一致 |
| F5 | 发送 sections: {} 请求，确认 400 错误 |
