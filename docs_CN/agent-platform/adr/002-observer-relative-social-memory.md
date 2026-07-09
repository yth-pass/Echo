# ADR 002：观察者相对社交记忆

| 字段 | 值 |
|------|-----|
| **状态** | 已接受 |
| **日期** | 2026-06-10 |

## 背景

A 从 B 处得知的事实不应自动成为 B 的官方档案。

## 决策

- 路径含 observer_id：`memory/users/{observer}/social/by_agent/{other}/`  
- 联合对话后 A、B **各抽取各写**  
- 第三人事实：① 中 `fact_scope=about_third_party`，`subject_agent_id` 为说话者  

## 后果

- 检索按观察者进行  
- share_policy 控制是否对 B 复述  
