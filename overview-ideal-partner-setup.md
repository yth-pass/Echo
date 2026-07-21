# 分身页人格线索 + 理想型补做改造

## 完成内容

### 问题
1. 分身页"人格线索"错误地显示每题选项罗列（scenarioCards），应为入驻前 15 题总结的人物画像叙事（personaSketchSections）
2. 部分用户"理想型"显示"尚未生成理想型描述"——finalize 软校验放行 + 旧流程/老用户可能缺 idealPartnerSketch，导致双向互匹配 ideal_embedding 缺失，配对功能受影响

### 方案
- **人格线索**：改用 personaSketchSections（7 段画像叙事：身份脉络/性格底色/核心信念/价值观优先级/关心方式/社交边界/内在矛盾），移除 scenarioCards 选项罗列
- **理想型缺失**：不报错阻断，在分身页给 CTA 入口
  - 3 道探测卡已答 → "生成理想型描述"直接调 generate
  - 3 道未答 → "补做理想型问卷"进入补做流程页（答题 → 生成 → 展示）
- 补做绕开 `OnboardingSession.completed=false` 限制，直接从 Profile.bioJson 读数据

## 改动文件

### 后端（services/api）
| 文件 | 改动 |
|---|---|
| `src/onboarding/ideal-partner-sketch.service.ts` | 抽出 `generateFromSurvey(survey)` 纯合成函数（不查 DB），供分身页补做复用 |
| `src/onboarding/onboarding.module.ts` | exports 加 IdealPartnerSketchService |
| `src/clones/clones.module.ts` | imports 加 LlmModule + OnboardingModule |
| `src/clones/clones.service.ts` | 注入 IdealPartnerSketchService + LlmService；getMe 返回 `idealPartnerCardsAnswered`；新增 `submitIdealPartnerCards` / `generateIdealPartner` / `reembedIdeal` |
| `src/clones/clones.controller.ts` | 新增 `POST /clones/me/ideal-partner/cards` + `POST /clones/me/ideal-partner/generate` + DTO；GetMeResponseDto 加字段 |

### 前端（Echo）
| 文件 | 改动 |
|---|---|
| `src/api/clone.ts` | CloneMe 加 `idealPartnerCardsAnswered`；新增 `submitIdealPartnerCards` / `generateIdealPartnerClone`（返回 ApiResult） |
| `src/features/clone/CloneView.tsx` | 人格线索改用画像叙事；理想型兜底改 CTA（根据答题状态分流） |
| `src/features/clone/IdealPartnerSetup.tsx` | 新建补做流程页（答题 → 生成 → 展示） |
| `src/App.tsx` | 注册 `/ideal-setup` 独立全屏路由 |

## 关键设计
- **补做后必须重算 ideal_embedding**：双向互匹配公式 `sqrt(cos(self_A, ideal_B) × cos(self_B, ideal_A))` 依赖 ideal_embedding，补做生成 sketch 后自动 upsert profile_embeddings.ideal_embedding（只更该列，保留 self embedding）
- **三步分离**：Phase 1 提交（存卡答案+维度）→ Phase 1.6 generate（LLM 合成 sketch 叙事）→ finalize embed（算 embedding 存表）。"卡已答但 sketch 缺"是合法状态，补做只需调 generate
- **finalize 软校验不动**：idealPartnerSketch 缺失只 warn 不阻断（符合"不报错"要求）
- **embed 失败静默降级**：reembedIdeal 失败不阻断 sketch 写入，匹配侧降级

## 验证
- 后端 `cd services/api && npm run lint`（tsc --noEmit）退出码 0
- 前端 `npm --prefix Echo run lint` 退出码 0

## API 新增
- `POST /clones/me/ideal-partner/cards` — 补答 3 道理想伴侣探测卡，合并答案 + 重算维度
- `POST /clones/me/ideal-partner/generate` — 从 bioJson 生成 idealPartnerSketch + 重算 ideal_embedding
- `GET /clones/me` 新增返回字段 `idealPartnerCardsAnswered: boolean`
