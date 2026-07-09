# ADR 004：主/次主题非覆盖

| 字段 | 值 |
|------|-----|
| **状态** | 已接受 |
| **日期** | 2026-06-10 |

## 背景

对话有主线与临时岔题；任何新话题都覆盖文件会丢失主线。

## 决策

- 持久 `main_topic` + 可选 `active_subtopic`  
- 仅 **`new_main`** 整包归档并重置  
- `return_to_main`：sub → `subtopic_history`，保留 main  
- summary ≤ 150 字  

## 后果

- Composer 注入 main + sub + 已结束 sub 列表  
- MVP：同时仅一个 active sub  
