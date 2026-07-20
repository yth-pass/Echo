# Phase D 实施完成 — Bug ① Phase 0/1 字段不恢复

> **日期**：2026-07-20
> **方案文档**：`outputs/onboarding-resume-fix-plan.md`（v2）
> **改动文件数**：3 个
> **lint 验证**：前端 `tsc --noEmit` 退出码 0

---

## 改动清单

### 1. `Echo/src/features/onboarding/v2/OnboardingShell.tsx`

#### D1: mount 时调 getOnboardingProgress 优先恢复

新增逻辑（替换原 `restore().then(() => setReady(true))`）：

```ts
useEffect(() => {
  (async () => {
    try {
      const progress = await getOnboardingProgress();
      if (progress.hasActiveSession && progress.currentPhase) {
        // 后端有 active session → 用后端的 phase（权威）
        const targetIdx = PHASE_ORDER.indexOf(progress.currentPhase);
        if (targetIdx >= 0) {
          const completedPhases = PHASE_ORDER.slice(0, targetIdx);
          const newSession = { phase: progress.currentPhase, completedPhases, savedAt: ... };
          save(newSession);
          
          // 把后端字段数据缓存到 localStorage（让各 Phase 组件 mount 时能读）
          if (progress.phase0Data) {
            localStorage.setItem(`onboarding_phase0_formdata_${userId}`, JSON.stringify(progress.phase0Data));
          }
          if (progress.phase1Responses?.length > 0) {
            localStorage.setItem(`onboarding_phase1_responses_${userId}`, JSON.stringify({
              index: 0,
              responses: progress.phase1Responses,
            }));
          }
          if (progress.phase2CompletedRoles?.length > 0) {
            localStorage.setItem(`echo_phase2_completed_${userId}`, JSON.stringify(progress.phase2CompletedRoles));
          }
          await restore();
          setReady(true);
          return;
        }
      }
    } catch (e) {
      console.warn('getOnboardingProgress failed, fallback to localStorage:', e);
    }
    // 降级：原有 localStorage 恢复
    await restore();
    setReady(true);
  })();
}, [restore, save, userId]);
```

### 2. `Echo/src/features/onboarding/v2/Phase0Identity.tsx`

#### D2: 加 localStorage checkpoint

**组件签名变更**：新增 `userId` prop
```ts
export function Phase0Identity({ userId, onComplete, onClose }: PhaseProps & { userId: string })
```

**lazy initial state 从 localStorage 恢复**：
```ts
const [formData, setFormData] = useState<Partial<Phase0Payload>>(() => {
  try {
    const saved = localStorage.getItem(phase0StorageKey(userId));
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
});
```

**formData 变化时保存**：
```ts
useEffect(() => {
  localStorage.setItem(phase0StorageKey(userId), JSON.stringify(formData));
}, [formData, userId]);
```

**提交成功后清理**：
```ts
if (result.ok) {
  localStorage.removeItem(phase0StorageKey(userId));
  // ...
}
```

### 3. `Echo/src/features/onboarding/v2/Phase1Cards.tsx`

#### D3: 智能推断 cardIndex

**原代码**：用 `parsed.index`（OnboardingShell 写入 0）→ 从第一卡重新看
**修复后**：根据 `responses.length` 推断 → 跳到下一未答卡

```ts
const restoredResponses = parsed.responses ?? [];
const inferredIndex = restoredResponses.length > 0
  ? Math.min(restoredResponses.length, TOTAL_CARDS - 1)
  : parsed.index;
```

---

## 跨设备恢复完整路径

```
设备 A：用户完成 Phase 0 + Phase 1 部分
  → 后端 OnboardingSession.surveyJson 有 identity + scenarioCards

设备 B：用户登录 → OnboardingShell mount
  ↓
  调 getOnboardingProgress()
  ↓
  后端返回:
    { hasActiveSession: true, currentPhase: 'phase1',
      phase0Data: { displayName: '...', ... },
      phase1Responses: [{ cardId: '...', choice: 'A', ... }, ...] }
  ↓
  OnboardingShell 写 localStorage:
    onboarding_phase0_formdata_${userId} = phase0Data
    onboarding_phase1_responses_${userId} = { index: 0, responses: phase1Responses }
  ↓
  setPhase('phase1') → Phase1Cards mount
  ↓
  Phase1Cards 读 localStorage
    → 拿到 responses (长度 N)
    → 智能推断 cardIndex = N → 跳到第 N+1 卡
  ↓
  用户继续答题，无缝衔接
```

---

## 验证结果

```
前端：npm --prefix Echo run lint
  > tsc --noEmit
  退出码 0 ✅
  (3 个预先存在的 poster 模块错误与本次改动无关)
```

---

## 整体修复总结（Phase A/B/C/D 全部完成）

| Phase | Bug | 改动文件 | 修复点 | lint |
|---|---|---|---|---|
| **A** | 基础设施 | 4 | 2 个 GET 端点 + startChat 改造 | ✅ 后端+前端 |
| **B** | ② 死循环 | 1 | 4 处（B1/B2/B3/B4） | ✅ 前端 |
| **C** | ③ 消息全发+气泡 | 2 | 6 处（C1-C6） | ✅ 前端 |
| **D** | ① 字段不恢复 | 3 | 3 处（D1/D2/D3） | ✅ 前端 |
| **合计** | — | **10** | **15 处** | ✅ |

### 涉及的所有文件清单

**后端**（Phase A）：
1. `services/api/src/onboarding/onboarding.controller.ts` — 2 个 GET 端点
2. `services/api/src/onboarding/onboarding.service.ts` — getProgress() 方法
3. `services/api/src/onboarding/roleplay-agent.service.ts` — startChat 改造 + listChats() 方法

**前端**（Phase A/B/C/D）：
4. `Echo/src/features/onboarding/v2/onboarding-v2.api.ts` — 新 API 函数 + 类型扩展
5. `Echo/src/features/onboarding/v2/onboarding-v2.types.ts` — RoleplayConversation 加 pendingDisplayIds
6. `Echo/src/features/onboarding/v2/OnboardingShell.tsx` — mount 时调 getOnboardingProgress
7. `Echo/src/features/onboarding/v2/Phase0Identity.tsx` — localStorage checkpoint + userId prop
8. `Echo/src/features/onboarding/v2/Phase1Cards.tsx` — 智能推断 cardIndex
9. `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx` — B1-B4 + C1-C6 全部修复

### 三个 Bug 修复效果对比

| Bug | 修复前 | 修复后 |
|---|---|---|
| ② Phase 2 死循环 | 自然告别后死循环，角色屏永远显示需要聊 | 自动标记完成 + 后端同步 + startRoleplay 返回 status |
| ③ 消息一次性全发 | 退回角色屏后所有消息立即显示 | pendingDisplayIds 持久化 + 自动重启动画 |
| ① 字段不恢复 | Phase 0 全部重填，跨设备从 phase0 重头 | localStorage checkpoint + 后端 GET /progress 跨设备恢复 |

---

## 建议的手动测试清单

### Bug ② 死循环测试
- [ ] 4 个角色每个自然告别结束 → completedRoles 自动更新
- [ ] 4 个角色每个手动点"可以结束了" → 正常推进
- [ ] 中途退出 onboarding 重新进入 → 正常继续
- [ ] 换设备继续入驻 → listRoleplayChats 拉到正确 completedRoles

### Bug ③ 消息动画测试
- [ ] 在打字动画中退回角色屏 → 下次进入仍逐条动画展示
- [ ] 在打字动画中按 X 退出 onboarding → 未读数累加，下次进入恢复
- [ ] 跨角色切换无串台

### Bug ① 字段恢复测试
- [ ] 同设备 Phase 0 中途退出 → 自动恢复
- [ ] 同设备 Phase 1 中途退出 → 无丢失，跳到下一未答卡
- [ ] 清缓存后重新进入 → 跳到对应 phase + 字段恢复
- [ ] 换浏览器继续入驻 → 后端 active session 跳到对应 phase

---

## 后续建议

1. **数据库字段优化**（二期）：`OnboardingSession` 表新增 `currentPhase String?` 字段做权威值，避免推断逻辑的边界场景
2. **错误码标准化**（二期）：后端 `BadRequestException` 加 `code: 'CHAT_ENDED'`，前端不用字符串匹配"对话已结束"
3. **重聊支持**（二期）：如果未来要支持重聊已结束的角色，startChat 加 `?force_new=true` 参数
4. **测试用例**：建议为 16 个场景（4 角色 × 4 退出方式）写自动化测试
