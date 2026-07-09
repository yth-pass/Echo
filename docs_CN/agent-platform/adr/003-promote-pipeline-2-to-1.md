# ADR 003：②→① Promote 管线

| 字段 | 值 |
|------|-----|
| **状态** | 已接受 |
| **日期** | 2026-06-10 |

## 背景

推断与观点不能当作客观事实。

## 决策

- ② 存观点与 `implicit_inferred`  
- ① 仅 explicit 可验证陈述  
- 其他 Agent 明确确认 → 写 ①，② 标 `promoted_to_objective`（保留审计）  
- 矛盾 → ② `contradicted`，不写 ①  
- **禁止** 同一事实在 ①② 同时 active  

## 后果

- 与 trust_confirm / trust_break 联动  
- PromoteCheck 在话题结束异步运行  
