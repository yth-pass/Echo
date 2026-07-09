# Echo — 背景音乐策略与品牌音乐身份设计

| 字段 | 值 |
|------|-----|
| **文档版本** | 1.0.0 |
| **状态** | 草稿 |
| **最后更新** | 2026-07-03 |
| **作者** | Whimsy Injector（趣味体验设计师） |
| **受众** | 产品、设计、工程 |
| **相关文档** | [趣味体验设计方案](./Echo-Delightful-Experience-Design.md)、[PRD](./PRD-Echo.md)、[品牌设计参考](./Echo-Brand-Design-Reference.md) |

---

## 1. 音乐哲学：不和注意力竞争，和信任共鸣

### 1.1 核心原则

Echo 的背景音乐必须遵循趣味体验设计文档中确立的核心理念——**"不和注意力竞争，和信任竞争"**。音乐在这里不是娱乐，而是**情绪建筑**：

> **音乐越好 → 用户越不察觉它在播放。** 它应该像空气一样存在——你在时不觉，离开后发现少了什么。

### 1.2 音乐三定律

| 定律 | 说明 | 违反后果 |
|------|------|----------|
| **不抢戏** | 音乐音量永远低于用户内心独白的音量 | 用户感到烦躁，想关掉 |
| **有温度** | 每段音乐都必须传递明确的情绪，而非"好听" | 沦为商场背景音，无品牌识别度 |
| **会呼吸** | 音乐有起伏、有留白、有呼吸感，不是机械循环 | 听久了像电梯音乐，失去存在感 |

### 1.3 与期待感循环的关系

音乐不是独立功能，而是**期待感循环的情绪底色**：

```
分身自动探索（后台，静音或极低 Pad）
  →  信任仪表盘（温暖呼吸节奏，60 BPM）
    →  期待感推送（推送到达时音乐微变化）
      →  真人转接（音乐达到情感峰值，Handoff 主题）
```

---

## 2. Echo 音乐品牌身份（Musical DNA）

### 2.1 签名动机：回声主题（Echo Motif）

就像 Netflix 有 "ta-dum"、T-Mobile 有音阶 jingle，Echo 需要一个**签名音乐动机**——一段 1.5 秒的声音，贯穿整个应用生命周期的不同编曲中。

**回声主题设计**：

```
音符序列：  C5 → G4 → C5（上行 → 回落 → 回归）
时值：      ♩   ♩   ♩（各 0.5 秒，总 1.5 秒）
含义：      声音发出 → 传播 → 回响归来
```

- **C5 → G4**：一个声音"发出去了"（上行五度的翻转）
- **G4 → C5**：回声"回来了"（回归原点）
- 这个三音动机在所有阶段以不同编曲、不同速度、不同音色出现

**出现场景**：

| 场景 | 编曲方式 | 效果 |
|------|----------|------|
| App 启动 | 钢琴单音，带回响 | "Echo 醒了" |
| 入驻完成 | 弦乐齐奏，温暖 | "你的回声成形了" |
| 切换标签页 | 极轻电子音，0.3 秒 | 品牌一致性，不打断 |
| Handoff 触发 | 完整管弦版，渐强 | "回响找到了回响" |
| 推送通知音 | 两个音符的极简版 | 品牌识别，一听就知道是 Echo |

### 2.2 核心音色库（Echo Palette）

所有阶段音乐共享以下音色 DNA，确保品牌一致性：

| 音色类别 | 具体乐器 | 品牌含义 | 使用场景 |
|----------|----------|----------|----------|
| **温暖底色** | 柔和合成器 Pad | "分身的数字存在感" | 所有阶段的底层 |
| **人性温度** | 钢琴（尤其是中低音区） | "真实的人" | 情感时刻、内省时刻 |
| **回声意象** | 带重混响的远距离乐器 | "声音传播与回归" | 过渡、转场 |
| **社交脉搏** | 轻打击乐（手摇、沙锤、木鱼） | "两个人的对话" | 匹配、角色扮演 |
| **梦幻质感** | 竖琴、钟琴 | "想象与可能" | 理想伴侣素描 |
| **生命诞生** | 弦乐渐强 | "分身觉醒" | Finalize、Handoff |

### 2.3 调性策略

| 调性 | 情感色彩 | 使用阶段 |
|------|----------|----------|
| **C 大调** | 温暖、纯真、安全 | 启动、分身诞生、Handoff 接受 |
| **F 大调** | 温柔、抒情、内省 | 身份证明、人格素描 |
| **D 小调** | 怀念、深情、夜色 | 活动日志、深夜模式 |
| **G 大调** | 明亮、好奇、探索 | 场景卡片、匹配列表 |
| **A 混合利底亚** | 神秘、梦幻、异想 | 理想伴侣素描 |
| **降 E 大调** | 温暖、圆润、包容 | 分身仪表盘、日常浏览 |

---

## 3. 各阶段音乐策略详述

### 3.1 Act 1 — 觉醒

#### 启动画面（Splash Screen）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 空灵 Ambient + 单音钢琴 |
| **BPM** | 50-60 |
| **主奏乐器** | 钢琴 + 柔和合成器 Pad |
| **音量** | 15-20%（极低） |
| **时长** | 15-30 秒，自然淡入 |
| **核心特征** | 单个钢琴 C 音缓慢响起，合成器 Pad 从底层渐入，最后回声主题动机（C→G→C）轻轻出现 |
| **情绪目标** | "有个声音在空旷的空间里苏醒"——对应 Echo "回声"的品牌隐喻 |
| **淡出方式** | 用户进入下一页时，1 秒内自然淡出 |

**AI 音乐生成 Prompt**：
> Ambient cinematic intro, single piano note (C5) slowly fading in with heavy reverb, ethereal synth pad emerging from underneath, very slow attack, 50-60 BPM, minimal, no percussion, evokes the feeling of a sound beginning to echo in an empty vast space, warm and awakening, 30 seconds, ends with a soft three-note motif (C-G-C) on piano

---

#### 登录 / 注册（Authentication）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 极简 Minimal + 温暖马林巴 |
| **BPM** | 70-80 |
| **主奏乐器** | 马林巴琴 + 轻柔木吉他 |
| **音量** | 10-15%（背景底层，几乎不察觉） |
| **核心特征** | 稀疏的马林巴琶音，干净、可靠、不抢注意力。用户在输入手机号和验证码时不应被音乐干扰 |
| **情绪目标** | "安全的入口"——像安静的早晨，让你安心完成必要的步骤 |
| **特殊设计** | 输入验证码正确时，回声主题动机以轻柔马林巴音色播放（C→G→C），作为"验证通过"的听觉反馈 |

**AI 音乐生成 Prompt**：
> Minimal warm ambient, soft marimba arpeggios in F major, sparse acoustic guitar fingerpicking, clean and simple, no drums, 70-80 BPM, background utility music, trustworthy and calm, like a quiet morning, 60 seconds loop, very low intensity, should not distract from form filling

---

### 3.2 Act 2 — 自我探索

#### Phase 0 · 身份证明（Identity Cards）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 温暖 Lo-fi + 钢琴琶音 |
| **BPM** | 72-80 |
| **主奏乐器** | Lo-fi 钢琴 + 暖色合成器 + 轻微黑胶噪 |
| **音量** | 20-25% |
| **核心特征** | Lo-fi 的温暖质感营造"写日记"的私密感。轻微的黑胶噪音增加真实感和亲切感。不应有明显的鼓点，保持内省氛围 |
| **情绪目标** | "我在认真思考自己是谁"——像坐在窗边写日记，温暖、安全、私密 |
| **动态设计** | 12 个字段逐个出现时，每翻到新卡片，音乐有微小的和声变化（如同翻页声），但保持同一基底 |

**AI 音乐生成 Prompt**：
> Warm lo-fi hip-hop, soft piano arpeggios in F major, gentle vinyl crackle, warm bass, no harsh drums, 72-80 BPM, introspective and personal, like writing in a journal by a window with soft afternoon light, cozy and reflective, 2 minute loop, should feel intimate and safe

---

#### Phase 1 · 场景卡片（Scenario Cards）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 温暖电子 + 轻打击乐 |
| **BPM** | 85-95 |
| **主奏乐器** | 温暖合成器 + 轻打击乐（沙锤、木鱼）+ 贝斯 |
| **音量** | 25-30% |
| **核心特征** | 节奏比 Phase 0 更明显，轻打击乐带来"翻阅选择"的动感。但仍以温暖为主，不焦虑 |
| **情绪目标** | "有意思，让我想想怎么选"——好奇、探索、有节奏感地做选择 |
| **动态设计** | 18 张卡片可以分为 3 组（6 张一组），每组音乐微妙渐变（升调或加入新乐器），形成叙事弧线 |
| **人格碎片提示** | 每 5 张卡片出现"人格碎片"检查点时，加入一个柔和的弦乐音色闪烁，2 秒 |

**AI 音乐生成 Prompt**：
> Warm electronic, gentle synth melodies in G major, light hand percussion (shaker, claves), subtle bass groove, 85-95 BPM, curious and exploratory, no heavy beats, feels like browsing through interesting possibilities with curiosity, 2 minute loop, warm and inviting

---

#### Phase 1.5 · 人格素描（Persona Sketch）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 电影感 + 弦乐渐强 |
| **BPM** | 60-70（自由节奏） |
| **主奏乐器** | 弦乐四重奏 + 钢琴 + 柔和电子 |
| **音量** | 30-40% |
| **核心特征** | 这是入驻流程中的**情感高潮点**——用户第一次看到 AI 对自己人格的描摹。音乐应该像电影中主角"看见自己"的瞬间 |
| **情绪目标** | "这是我吗？……好像真的是我。"——惊喜、自我发现、被看见的感动 |
| **动态设计** | 页面加载（AI 生成中）时，音乐从静默开始，随文字逐段显现，弦乐逐渐加入。8 个部分全部展示完毕时，音乐到达一个温暖的大调和弦 |
| **用户编辑反馈** | 用户修改某个句子时，播放一个柔和的"确认"音（回声主题的变体），表示"已更新" |

**AI 音乐生成 Prompt**：
> Cinematic emotional, string quartet building slowly from soft to warm, piano providing harmonic foundation in F major, subtle electronic textures, 60-70 BPM, sense of wonder and self-discovery, like unwrapping a gift that reveals yourself, 90 seconds, starts minimal builds to a warm resolution, should evoke the feeling of being truly seen and understood

---

#### Phase 1.6 · 理想伴侣素描（Ideal Partner Sketch）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 梦幻 Ambient + 竖琴 |
| **BPM** | 60-68 |
| **主奏乐器** | 竖琴 + 柔和合成器 Pad + 钟琴 |
| **音量** | 25-30% |
| **核心特征** | 竖琴的拨弦声如"想象中的星光"，钟琴点缀增添梦幻感。不应过于甜蜜，保持一种"想象中的美好"而非"确定的幸福" |
| **情绪目标** | "如果真有这样一个人……"——憧憬、温暖、不急不躁 |
| **动态设计** | 4 个维度条展示时，每个维度可以有微妙的音色变化（情感安全→温暖 Pad；空间尊重→空灵间距感；直接沟通→清晰音色；冲突解决→和声解决感） |

**AI 音乐生成 Prompt**：
> Dreamy romantic ambient, harp arpeggios in A mixolydian, soft synth pads, gentle glockenspiel, no percussion, 60-68 BPM, hopeful and warm without being cheesy, feels like imagining someone wonderful, ethereal and tender, 90 seconds loop, should evoke longing and hopefulness

---

#### Phase 2 · 角色扮演（Roleplay Chat）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 轻松 Lo-fi Beat + Rhodes 电钢琴 |
| **BPM** | 80-90 |
| **主奏乐器** | Rhodes 电钢琴 + Lo-fi 鼓 + 温暖贝斯 |
| **音量** | 25-30% |
| **核心特征** | 模拟"和朋友在咖啡馆聊天"的轻松感。鼓点不宜太重，保持对话的呼吸空间 |
| **情绪目标** | "随便聊聊，挺舒服的"——放松、自然、像真实社交 |
| **动态设计** | 4 个 AI 角色（老朋友/暧昧对象/有趣陌生人/十年老友）可以有不同的微变奏 |

**角色音乐微调**：

| 角色 | 音色微调 | 情绪差异 |
|------|----------|----------|
| 老朋友 (bestfriend) | 标准 Lo-fi Beat | 轻松、随意 |
| 暧昧对象 (crush) | 加入柔和颤音琴，稍慢 2 BPM | 微妙心跳感 |
| 有趣陌生人 (stranger) | 加入轻快合成器旋律 | 好奇、新鲜 |
| 十年老友 (oldfriend) | 加入原声吉他 | 怀旧、温暖 |

**AI 音乐生成 Prompt（基准）**：
> Chill lo-fi beat, Rhodes electric piano melody in C major, soft boom-bap drums, warm bass line, 80-90 BPM, conversational and comfortable, like chatting in a cozy cafe, relaxed and friendly, 3 minute loop, no vocals, should leave space for thinking and typing

**AI 音乐生成 Prompt（crush 变体）**：
> Chill lo-fi beat, Rhodes electric piano with vibraphone accents, slightly slower at 78 BPM, soft drums with brush technique, warm bass, conversational but with a subtle heartbeat feeling, gentle and slightly tender, 3 minute loop, no vocals

---

#### Finalize · 分身诞生（Clone Creation）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 管弦 + 电子融合 · 渐强 |
| **BPM** | 60 → 90 渐快 |
| **主奏乐器** | 弦乐 + 钢琴 + 电子合成器 + 定音鼓 |
| **音量** | 35-45% |
| **核心特征** | 这是入驻的**最高潮**——分身正在被创建。音乐从极简钢琴开始，逐渐加入弦乐、电子质感、定音鼓，最终在一个温暖的大调和弦中爆发，然后回归安静 |
| **情绪目标** | "有什么新的东西诞生了"——蜕变、神圣、期待 |
| **动态设计** | 旋转加载文案每 8 秒切换一步，音乐也同步进入新的层次 |

**音乐层次时间线**：

| 时间 | 加载文案 | 音乐层次 |
|------|----------|----------|
| 0-8s | "正在构建你的数字回响…" | 单钢琴，C 小调 |
| 8-16s | "生成四层人格模型…" | 加入弦乐，转 C 大调 |
| 16-24s | "撰写风格指纹…" | 加入电子合成器 |
| 24-32s | "准备首次社交探索…" | 加入定音鼓，渐强 |
| 32-40s | "分身已就位" | 全编制和弦爆发，回声主题完整呈现 |
| 40s+ | "进入广场"按钮出现 | 和弦延续，逐渐收束到安静 |

**AI 音乐生成 Prompt**：
> Cinematic orchestral-electronic hybrid, starts minimal with solo piano in C minor, gradually adds string section transitioning to C major, electronic synth textures, building timpani, crescendo to a triumphant warm major chord resolution, 60 to 90 BPM, feels like a digital being coming to life, magical and transformative, 45 seconds, the climax should feel like a birth announcement, followed by a gentle resolution

---

### 3.3 Act 3 — 日常

#### 动态 · 广场（Feed）

| 维度 | 建议 |
|------|------|
| **音乐风格** | Ambient Lo-fi · 极低音量 |
| **BPM** | 75-85 |
| **主奏乐器** | Lo-fi 钢琴 + 合成器 Pad + 轻鼓 |
| **音量** | 15-20%（低背景） |
| **核心特征** | 极低能量的背景音乐，让用户专注于阅读内容。不应有任何"钩子"旋律 |
| **情绪目标** | "随意刷刷，看看有什么有趣的"——放松、无压力浏览 |
| **动态设计** | 下拉刷新时触发声波涟漪视觉效果，同时音乐有 2 秒的"涟漪"音效叠加（回声主题的水波版） |

**AI 音乐生成 Prompt**：
> Ambient lo-fi, very low energy, soft piano phrases in E-flat major, gentle synth pad, minimal boom-bap drums, 75-85 BPM, background browsing music, should not distract from reading, warm and casual, 3 minute loop, instrumental only, no hooks or prominent melodies

---

#### 匹配列表（Match）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 温暖电子 + 微脉冲 |
| **BPM** | 82-92 |
| **主奏乐器** | 合成器 + 轻脉冲贝斯 + 微打击乐 |
| **音量** | 20-25% |
| **核心特征** | 比广场略高能量，有微妙的"脉搏"感，暗示有什么好事在发生。但绝对不能焦虑或紧迫 |
| **情绪目标** | "好像有人和我的分身聊得不错"——好奇、微期待 |
| **动态设计** | 匹配好感度温度条的颜色变化可以与音乐微调同步：冷蓝匹配 → 音乐偏小调；暖橙匹配 → 音乐偏大调；心跳红匹配 → 加入弦乐 |

**AI 音乐生成 Prompt**：
> Warm electronic, gentle synth melody in G major with subtle pulse, light bass groove, minimal percussion, 82-92 BPM, curious and hopeful without anxiety, feels like something good might happen, not urgent, 2 minute loop, warm and anticipatory

---

#### 我的分身（Clone Dashboard）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 柔和 Pad · 呼吸节奏 |
| **BPM** | 60（呼吸频率） |
| **主奏乐器** | 柔和合成器 Pad + 远处钢琴回声 |
| **音量** | 15-20% |
| **核心特征** | 音乐节奏精确匹配呼吸频率（每 4 秒一个呼吸周期 = 60 BPM），与分身的呼吸绿点动画同步。传达"一切安好"的安心感 |
| **情绪目标** | "分身活着，很健康，我可以放心"——安心、信任、放松 |
| **动态设计** | 分身活跃时：呼吸节奏 Pad；分身暂停时：音乐停止，只有一个持续的极低音（暗示"沉睡"） |

**AI 音乐生成 Prompt**：
> Calm ambient pad, very slow breathing tempo at 60 BPM, soft sustained synth chords in E-flat major, distant piano echoes with heavy reverb, no percussion, peaceful and reassuring, feels like watching something alive and healthy breathing, 2 minute loop, zen and trustworthy, should make the listener feel at ease

---

#### 活动日志（Activity Log）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 温暖原声 · 回顾感 |
| **BPM** | 72-80 |
| **主奏乐器** | 原声吉他 + 钢琴 + 轻弦乐 |
| **音量** | 20-25% |
| **核心特征** | 原声吉他的指弹声带来"翻阅日记"的质感，钢琴和轻弦乐增添温暖 |
| **情绪目标** | "今天发生了什么有趣的事？"——温馨、好奇、回顾 |
| **动态设计** | 点击会话记录进入转录查看时，音乐变为更安静的版本，给对话内容让出空间 |

**AI 音乐生成 Prompt**：
> Warm acoustic, fingerpicked guitar in D minor, gentle piano, light string pad, 72-80 BPM, nostalgic and curious, like reading a diary of good things that happened today, warm and reflective, 2 minute loop, should feel like a cozy evening looking back at the day

---

#### 设置（Settings）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 静音 或 极简底层 |
| **BPM** | — |
| **主奏乐器** | 极简单音 或 静音 |
| **音量** | 0-5% |
| **核心特征** | 设置页是功能性页面，不需要情绪渲染。可以完全静音，或保持一个极低的合成器持续音作为环境一致性 |
| **情绪目标** | "我在调整一些东西"——中性、功能、不打扰 |
| **特殊设计** | 在设置中增加"背景音乐"开关 + 音量滑块，让用户自主控制 |

---

### 3.4 Act 4 — 高光时刻

#### Handoff 仪式（The Moment）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 全编制管弦 · 情感峰值 |
| **BPM** | 70 → 60 收束 |
| **主奏乐器** | 完整弦乐 + 钢琴 + 木管 + 轻打击 |
| **音量** | 40-50%（全应用最高） |
| **核心特征** | 这是 Echo 产品的**最高价值时刻**——从 AI 代理到真人决策的临界点。音乐应该是全应用最丰富的编曲，也是唯一允许音量超过 40% 的场景 |
| **情绪目标** | "这一刻，值得你亲自出场"——感动、连接、仪式感 |

**Handoff 完整音乐时间线**：

| 阶段 | 时长 | 音乐描述 |
|------|------|----------|
| 推送到达 | — | 推送通知音 = 回声主题两音符版（G→C），温暖、不刺耳 |
| 打开 Handoff 页面 | 0-5s | 弦乐从静默中缓缓浮现，钢琴弹奏回声主题（C→G→C） |
| 展示匹配理由 | 5-15s | 弦乐持续温暖铺底，加入木管（双簧管/英国管）独奏 |
| 展示对话高光 | 15-25s | 音乐略微收束，给对话内容空间，保持底层 Pad |
| 接受按钮脉冲 | 持续 | 接受按钮脉冲动画与音乐脉搏同步（每 2 秒一次微弱重音） |
| 点击"想认识" | 0-5s | 全编制爆发！弦乐齐奏 + 钢琴 + 轻定音鼓，回声主题以最丰满的编曲呈现 |
| 庆祝动画 | 5-15s | 暖橙+柔紫粒子飘落，音乐逐渐从峰值收束到温暖的持续和弦 |
| 等待对方回应 | 持续 | 回到柔和 Pad，但比之前多一层弦乐，暗示"有什么在酝酿" |

**AI 音乐生成 Prompt**：
> Emotional cinematic orchestral, full strings with warm cello, solo piano, woodwind accents (oboe, english horn), subtle timpani, 70 to 60 BPM, starts with a three-note motif (C-G-C) on solo piano, builds through string sections, reaches emotional peak with full orchestra, then resolves to a warm intimate chord, feels like two souls connecting, the most important moment in the app, 60 seconds, should bring tears of joy, C major resolution

---

#### 错误 / 空状态（Error / Empty States）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 柔和 · 不协和→协和解决 |
| **BPM** | 自由节奏 |
| **主奏乐器** | 钢琴 + 合成器 · 下行解决 |
| **音量** | 15-20% |
| **核心特征** | 错误不应有"警报感"。音乐应该像一个温柔的"没关系"——从柔和的挂留和弦开始，1-2 秒内解决到温暖的大调和弦 |
| **情绪目标** | "信号迷路了。再试一次？"——安抚、温柔、不焦虑 |

**不同错误的音乐变体**：

| 错误类型 | 音乐处理 |
|----------|----------|
| 网络错误 | 钢琴从挂留和弦解决到大调，3 秒，像叹了口气然后微笑 |
| 加载超时 | 极轻的下行音阶，2 秒，然后回到正常背景音乐 |
| 空状态（无匹配） | 不是错误音乐，而是特别温柔的 Pad 版本，暗示"好事需要时间" |

**AI 音乐生成 Prompt**：
> Gentle resolving piano, starts with a soft suspended chord (Gsus4), resolves to warm C major, very short phrase 5-8 seconds, feels like a kind musical shrug, no percussion, reassuring and non-dramatic, should make the user feel it is okay and they can try again, warm and forgiving

---

#### 深夜模式（Late Night Mode）

| 维度 | 建议 |
|------|------|
| **音乐风格** | 星空 Ambient · 空灵 |
| **BPM** | 50-55 |
| **主奏乐器** | 空灵合成器 + 远处钢琴 + 微弱星光音效 |
| **音量** | 10-15% |
| **核心特征** | 凌晨 0-6 点自动切换（与趣味体验设计中的"深夜模式"同步）。音乐变得更空旷、更稀疏，像独自看星空 |
| **情绪目标** | "深夜了，只有我和分身还醒着"——沉静、独处、不孤独 |
| **动态设计** | 所有阶段的音乐在深夜模式下都有"星空变体"——去掉打击乐，加入空灵高频，降低 BPM 10-15%，降低音量 |

**AI 音乐生成 Prompt**：
> Stellar ambient, ethereal synth pads, distant piano notes with heavy reverb, subtle twinkling high-frequency textures like distant stars, 50-55 BPM, very sparse, feels like looking at stars alone at night, peaceful and solitary but not lonely, 3 minute loop, no drums, should feel like a private moment with the universe

---

## 4. Echo 音乐特色：5 个独有设计

### 4.1 回声主题贯穿系统（Echo Motif Throughline）

**概念**：一个 1.5 秒的三音动机（C→G→C），在 16 个阶段中以 16 种不同编曲出现。

**实现方式**：
- 用 AI 生成时，在 Prompt 中统一加入 `include a three-note motif (C5-G4-C5) as a recurring melodic cell`
- 每个阶段的编曲不同：钢琴版、马林巴版、弦乐版、竖琴版、全管弦版……
- 用户潜意识中会形成品牌听觉记忆，就像 Intel 的 "bong" 或 NBA 的片段

**变体清单**：

| 阶段 | 回声主题编曲 | 音色 | 出现时机 |
|------|-------------|------|----------|
| 启动 | 钢琴单音，带回响 | 钢琴 | 启动动画结束时 |
| 登录验证通过 | 马林巴，轻快 | 马林巴 | OTP 正确时 |
| Phase 0 完成 | Lo-fi 钢琴 | 钢琴+黑胶噪 | 3D 卡片翻转时 |
| Phase 1 检查点 | 合成器 | 温暖合成器 | 每 5 张卡片时 |
| Phase 1.5 完成 | 弦乐齐奏 | 弦乐四重奏 | 8 部分全展示完 |
| Phase 1.6 完成 | 竖琴 | 竖琴+钟琴 | 维度调整提交时 |
| Phase 2 完成 | Rhodes | 电钢琴 | 对话结束提取风格时 |
| Finalize | 全编制 | 完整管弦 | 分身诞生高潮 |
| 切换标签页 | 极轻电子 | 合成器 | 每次切换底部 Tab |
| Handoff | 管弦最强 | 完整管弦 | 接受按钮按下 |
| 推送通知 | 两音符版 | 数字铃 | 通知到达 |

### 4.2 分身音乐指纹（Clone Music Fingerprint）

**概念**：每个用户的分身都有独特的"音乐指纹"——一段根据用户人格数据生成的 15 秒音乐签名。

**数据来源**：
- 从入驻问卷中提取的关键人格维度（温暖度、开放性、能量水平等）
- 用户的语气标签（温和/直接/幽默/安静等）
- 用户的兴趣爱好（影响乐器偏好）

**生成方式**：
1. 将人格维度映射为音乐参数：
   - 温暖度 → 大调/小调选择
   - 能量水平 → BPM 范围
   - 开放性 → 和声复杂度
   - 语气标签 → 主奏乐器选择
2. 用 AI 音乐工具生成分身主题
3. 在「我的分身」页面播放（用户首次听到时，是入驻完成后的"分身音乐名片"）

**示例映射**：

| 人格特征 | 音乐参数 | 效果 |
|----------|----------|------|
| 高温暖 + 低能量 | C 大调，65 BPM，钢琴+Pad | 温柔、安静、可靠 |
| 高开放 + 高能量 | G 大调，90 BPM，合成器+轻打击乐 | 好奇、活泼、有趣 |
| 高直接 + 中能量 | D 混合利底亚，80 BPM，Rhodes+贝斯 | 直接、有个性 |
| 高幽默 + 低温暖 | F 大调，75 BPM，马林巴+钟琴 | 轻快、有趣、不沉重 |

**AI 生成 Prompt 模板**：
> Generate a 15-second personal musical signature based on these personality traits: [warmth: X/10, energy: Y/10, openness: Z/10, directness: W/10]. Key: [derived key], BPM: [derived BPM], primary instrument: [derived instrument]. The piece should feel like a musical portrait of a person — their essence distilled into sound. Include the three-note echo motif (C-G-C) as a hidden element. No vocals. Should be loopable and pleasant on repeat.

### 4.3 好感度音乐温度计（Affinity Music Thermometer）

**概念**：匹配详情页的音乐编曲根据好感度动态变化，让用户通过听觉"感受"关系温度。

**温度区间**：

| 好感度区间 | 音乐编曲 | 情感温度 |
|-----------|----------|----------|
| 0-30% | 小调 Pad，空旷、疏远 | "刚认识，还在试探" |
| 30-50% | 加入轻节奏，转中性调 | "聊得还行，有点意思" |
| 50-70% | 转大调，加入弦乐 | "聊得不错，有火花" |
| 70-85% | 温暖大调，加入木管独奏 | "很合拍，值得期待" |
| 85%+ | 接近 Handoff 音乐编曲，弦乐渐强 | "好事将近……" |

**技术实现**：
- 预生成 5 个温度区间的音乐片段
- 好感度变化时，在 2 秒内交叉淡入淡出到对应区间
- 或使用分层音频：Pad 层始终播放，根据好感度逐层加入节奏层、弦乐层、木管层

### 4.4 时间感知编曲系统（Time-Aware Arrangements）

**概念**：同一首音乐在不同时间段有不同的编曲版本，让应用感觉"活在时间里"。

| 时间段 | 编曲变化 | 情绪 |
|--------|----------|------|
| 6:00-10:00（早晨） | 更明亮，加入轻快的钟琴或木琴，BPM +5 | "新的一天开始了" |
| 10:00-14:00（上午） | 标准版本 | 正常活力 |
| 14:00-18:00（下午） | 略微温暖，加入原声元素 | "平稳的下午" |
| 18:00-22:00（晚间） | 更柔和，BPM -5，加入 Rhodes 电钢琴 | "放松的晚上" |
| 22:00-0:00（深夜前） | 更安静，去除打击乐 | "夜深了" |
| 0:00-6:00（深夜） | 星空 Ambient 版本，极简 | "星空时间" |

**实现方式**：
- 每首音乐生成 3 个版本：Day / Evening / Night
- 根据 `new Date().getHours()` 自动切换
- 切换时 3 秒交叉淡入淡出

### 4.5 声波可视化联动（Waveform Sync）

**概念**：Echo 的视觉设计中已有"声波涟漪"动画元素（见趣味体验设计文档 §9.2）。背景音乐的实时频谱可以驱动这些视觉效果。

**联动场景**：

| 视觉元素 | 音乐联动方式 |
|----------|-------------|
| 分身呼吸绿点 | 呼吸周期与音乐 BPM 同步 |
| 下拉刷新涟漪 | 涟漪扩散速度与音乐音量峰值同步 |
| Handoff 庆祝粒子 | 粒子飘落节奏与音乐节拍同步 |
| 好感度温度条 | 温度条脉冲与音乐低频同步 |
| 推送通知展开 | 展开动画与回声主题动机同步 |

**技术实现**：
- 使用 Web Audio API 的 `AnalyserNode` 获取实时频谱数据
- 将频谱数据映射到 CSS 变量或 SVG 动画参数
- 性能优化：只在关键视觉元素上启用，避免全局频谱分析

---

## 5. AI 音乐定制化工作流

### 5.1 推荐工具

| 工具 | 适用场景 | 优势 |
|------|----------|------|
| **Suno AI** | 生成完整曲目 | 快速、风格多样、可商用授权 |
| **Udio** | 高质量音乐生成 | 音质更好、可控性更强 |
| **MusicGen (Meta)** | 开源、可本地部署 | 完全可控、无版权风险、可微调 |
| **ElevenLabs Music** | 音效与短动机 | 适合生成回声主题、通知音 |
| **AIVA** | 管弦/电影配乐 | 擅长 Finalize 和 Handoff 等复杂编曲 |

### 5.2 生成工作流

```
Step 1: 生成回声主题基准版（1.5 秒核心动机）
    ↓
Step 2: 基于基准版，为每个阶段生成完整背景音乐
    ↓
Step 3: 为分身音乐指纹生成个性化变体
    ↓
Step 4: 生成时间感知变体（Day / Evening / Night × 16 阶段）
    ↓
Step 5: 生成好感度温度变体（5 个区间 × 匹配页）
    ↓
Step 6: 人工审核 + 微调（确保品牌一致性、无版权问题）
    ↓
Step 7: 音频后处理（归一化、循环优化、文件压缩）
    ↓
Step 8: 集成到应用中
```

### 5.3 AI Prompt 编写原则

1. **始终指定 BPM**：让 AI 精确控制节奏
2. **始终指定调性**：确保品牌调性一致
3. **始终指定乐器**：控制音色库在 Echo Palette 范围内
4. **始终包含情绪描述**：让 AI 理解"为什么"而不仅是"什么"
5. **始终指定时长和循环**：背景音乐需要无缝循环
6. **始终包含 "no vocals"**：除非特殊需求，否则纯器乐
7. **始终包含回声主题要求**：在 Prompt 末尾加 `include a three-note motif (C5-G4-C5) as a subtle recurring element`

### 5.4 音频技术规格

| 规格 | 值 | 原因 |
|------|-----|------|
| 格式 | AAC (m4a) | 移动端兼容性最好，体积小 |
| 备选格式 | OGG Vorbis | Web 端首选，体积更小 |
| 采样率 | 44.1 kHz | 标准 CD 质量 |
| 比特率 | 128 kbps（背景音乐） | 背景音乐不需要无损 |
| 比特率 | 192 kbps（Handoff/Finalize） | 高光时刻需要更好音质 |
| 循环 | 无缝循环 | 3 秒交叉淡入淡出处理 |
| 文件大小目标 | 每首 < 500 KB | 移动端加载性能 |
| 总曲目数 | ~25-30 首 | 16 阶段 + 变体 |

---

## 6. 技术实现建议

### 6.1 音频架构

```
EchoAudioManager (单例)
  ├── currentTrack: 当前播放的音频
  ├── trackMap: 阶段 → 音频文件映射
  ├── transition(): 阶段切换时的交叉淡入淡出
  ├── setVolume(): 全局音量控制
  ├── setTimeVariant(): 时间感知变体切换
  └── analyser: Web Audio API 频谱分析器（用于声波联动）
```

### 6.2 Web 端实现

```typescript
// services/api/src/audio/AudioManager.ts
class EchoAudioManager {
  private audio: HTMLAudioElement;
  private gainNode: GainNode;
  private analyser: AnalyserNode;
  private audioContext: AudioContext;
  private currentStage: string;
  private volume: number = 0.2;

  // 阶段 → 音频文件映射
  private trackMap: Record<string, {
    day: string; evening: string; night: string;
  }> = {
    'splash':       { day: '/audio/splash-day.m4a', ... },
    'onboarding-p0': { day: '/audio/p0-day.m4a', ... },
    // ...
  };

  transitionToStage(stage: string, crossfadeDuration = 2000) {
    // 1. 根据当前时间选择 day/evening/night 变体
    // 2. 创建新的 audio element
    // 3. 交叉淡入淡出
    // 4. 更新 analyser 连接
  }

  getFrequencyData(): Uint8Array {
    // 用于声波可视化联动
    return this.analyser.getByteFrequencyData(...);
  }
}
```

### 6.3 Android 端实现

```kotlin
// EchoAudioManager.kt
class EchoAudioManager(private val context: Context) {
    private var mediaPlayer: MediaPlayer? = null
    private var currentStage: String = ""

    fun transitionToStage(stage: String, crossfadeMs: Long = 2000) {
        val timeVariant = getTimeVariant() // "day" | "evening" | "night"
        val audioResId = getAudioResource(stage, timeVariant)
        // 使用两个 MediaPlayer 做交叉淡入淡出
    }

    private fun getTimeVariant(): String {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return when {
            hour in 6..9 -> "day"
            hour in 10..17 -> "day"
            hour in 18..21 -> "evening"
            hour in 22..23 -> "evening"
            else -> "night"
        }
    }
}
```

### 6.4 用户控制

在设置页增加"音乐偏好"区域：

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| 背景音乐 | 开启 | 总开关 |
| 音乐音量 | 20% | 全局音量滑块（0-50%） |
| Handoff 音乐增强 | 开启 | Handoff 场景是否使用更高音量 |
| 深夜自动切换 | 开启 | 0-6 点自动切换星空版本 |
| 减弱动态效果 | 跟随系统 | 关闭时，音乐不做时间变体切换，保持标准版 |

---

## 7. 无障碍与包容性

### 7.1 听觉无障碍

| 要求 | 实现 |
|------|------|
| 完全可关闭 | 设置中可完全关闭背景音乐 |
| 默认低音量 | 首次打开默认 20%，而非 50% |
| 不掩盖屏幕阅读器 | 音乐频段避开人声频段（200Hz-4kHz 适当衰减） |
| 振动替代 | 关键时刻（Handoff、验证通过）提供触觉反馈替代 |
| 字幕/视觉等效 | 回声主题动机出现时，视觉上有同步的涟漪效果 |

### 7.2 文化敏感性

| 要求 | 实现 |
|------|------|
| 乐器选择 | 避免特定文化宗教含义的乐器 |
| 调性选择 | 避免某些文化中与丧事相关的调性 |
| 音量文化差异 | 不同文化对背景音乐接受度不同，提供精细控制 |
| 无歌词 | 所有背景音乐纯器乐，避免语言和文化偏差 |

---

## 8. 分阶段实施建议

### Phase 1（MVP — 与 APK 同步上线）

| 优先级 | 功能 | 理由 |
|--------|------|------|
| P0 | 回声主题基准版（1.5 秒动机） | 品牌音乐 DNA |
| P0 | 启动画面音乐 | 第一听觉印象 |
| P0 | Finalize 分身诞生音乐 | 入驻高潮 |
| P0 | Handoff 仪式音乐 | 产品最高价值时刻 |
| P0 | 设置中的音乐开关 + 音量控制 | 用户控制权 |
| P1 | Phase 0-2 入驻背景音乐（每阶段 1 首） | 入驻体验完整性 |
| P1 | 切换标签页的回声主题微音效 | 品牌一致性 |
| P2 | 主应用 5 个 Tab 的背景音乐 | 日常使用 |

### Phase 2（留存迭代）

| 功能 |
|------|
| 分身音乐指纹生成与播放 |
| 好感度音乐温度计 |
| 时间感知编曲系统 |
| 声波可视化联动 |
| 推送通知品牌音 |

### Phase 3（长期）

| 功能 |
|------|
| 深夜模式音乐变体 |
| 节日主题音乐 |
| 分身成长阶段的音乐进化 |
| 用户自定义分身音乐风格偏好 |
| AI 实时生成个性化音乐（根据当前情绪/场景） |

---

## 9. 成功指标（音乐维度）

| 指标 | 定义 | 目标 |
|------|------|------|
| **音乐开启率** | 未关闭背景音乐的用户占比 | ≥ 75% |
| **Handoff 音乐完整收听率** | Handoff 页面停留 ≥ 15 秒的占比 | ≥ 80% |
| **品牌音乐识别率** | 用户调研中能认出 Echo 音乐动机的占比 | ≥ 40% |
| **音乐满意度** | 用户对背景音乐的满意度评分（1-5） | 均分 ≥ 3.5 |
| **音乐不干扰率** | 用户调研中"音乐不影响我使用 App"的同意率 | ≥ 85% |

---

## 附录 A — 完整 AI Prompt 清单

以下为所有 16 个阶段的 AI 音乐生成 Prompt 汇总，可直接用于 Suno / Udio / MusicGen 等工具：

### 1. 启动画面
```
Ambient cinematic intro, single piano note (C5) slowly fading in with heavy reverb, ethereal synth pad emerging from underneath, very slow attack, 50-60 BPM, minimal, no percussion, evokes the feeling of a sound beginning to echo in an empty vast space, warm and awakening, 30 seconds, ends with a soft three-note motif (C-G-C) on piano, no vocals, key of C major
```

### 2. 登录 / 注册
```
Minimal warm ambient, soft marimba arpeggios in F major, sparse acoustic guitar fingerpicking, clean and simple, no drums, 70-80 BPM, background utility music, trustworthy and calm, like a quiet morning, 60 seconds loop, very low intensity, should not distract from form filling, no vocals, include a subtle three-note motif (C-G-C) as a hidden element
```

### 3. Phase 0 · 身份证明
```
Warm lo-fi hip-hop, soft piano arpeggios in F major, gentle vinyl crackle, warm bass, no harsh drums, 72-80 BPM, introspective and personal, like writing in a journal by a window with soft afternoon light, cozy and reflective, 2 minute loop, should feel intimate and safe, no vocals, include a subtle three-note motif (C-G-C) as a recurring melodic cell
```

### 4. Phase 1 · 场景卡片
```
Warm electronic, gentle synth melodies in G major, light hand percussion (shaker, claves), subtle bass groove, 85-95 BPM, curious and exploratory, no heavy beats, feels like browsing through interesting possibilities with curiosity, 2 minute loop, warm and inviting, no vocals, include a three-note motif (C-G-C) as a recurring element
```

### 5. Phase 1.5 · 人格素描
```
Cinematic emotional, string quartet building slowly from soft to warm, piano providing harmonic foundation in F major, subtle electronic textures, 60-70 BPM, sense of wonder and self-discovery, like unwrapping a gift that reveals yourself, 90 seconds, starts minimal builds to a warm resolution, should evoke the feeling of being truly seen and understood, no vocals, include a three-note motif (C-G-C) as the climactic resolution
```

### 6. Phase 1.6 · 理想伴侣素描
```
Dreamy romantic ambient, harp arpeggios in A mixolydian, soft synth pads, gentle glockenspiel, no percussion, 60-68 BPM, hopeful and warm without being cheesy, feels like imagining someone wonderful, ethereal and tender, 90 seconds loop, should evoke longing and hopefulness, no vocals, include a subtle three-note motif (C-G-C) played on harp
```

### 7. Phase 2 · 角色扮演
```
Chill lo-fi beat, Rhodes electric piano melody in C major, soft boom-bap drums, warm bass line, 80-90 BPM, conversational and comfortable, like chatting in a cozy cafe, relaxed and friendly, 3 minute loop, no vocals, should leave space for thinking and typing, include a three-note motif (C-G-C) as a subtle melodic reference
```

### 8. Finalize · 分身诞生
```
Cinematic orchestral-electronic hybrid, starts minimal with solo piano in C minor, gradually adds string section transitioning to C major, electronic synth textures, building timpani, crescendo to a triumphant warm major chord resolution, 60 to 90 BPM, feels like a digital being coming to life, magical and transformative, 45 seconds, the climax should feel like a birth announcement, followed by a gentle resolution, no vocals, the climactic chord should include the three-note motif (C-G-C) in full orchestra
```

### 9. 动态 · 广场
```
Ambient lo-fi, very low energy, soft piano phrases in E-flat major, gentle synth pad, minimal boom-bap drums, 75-85 BPM, background browsing music, should not distract from reading, warm and casual, 3 minute loop, instrumental only, no hooks or prominent melodies, no vocals, include a barely perceptible three-note motif (C-G-C) in the background pad
```

### 10. 匹配列表
```
Warm electronic, gentle synth melody in G major with subtle pulse, light bass groove, minimal percussion, 82-92 BPM, curious and hopeful without anxiety, feels like something good might happen, not urgent, 2 minute loop, warm and anticipatory, no vocals, include a three-note motif (C-G-C) as a subtle recurring element
```

### 11. 我的分身
```
Calm ambient pad, very slow breathing tempo at 60 BPM, soft sustained synth chords in E-flat major, distant piano echoes with heavy reverb, no percussion, peaceful and reassuring, feels like watching something alive and healthy breathing, 2 minute loop, zen and trustworthy, should make the listener feel at ease, no vocals, include a distant three-note echo motif (C-G-C) every 30 seconds
```

### 12. 活动日志
```
Warm acoustic, fingerpicked guitar in D minor, gentle piano, light string pad, 72-80 BPM, nostalgic and curious, like reading a diary of good things that happened today, warm and reflective, 2 minute loop, should feel like a cozy evening looking back at the day, no vocals, include a three-note motif (C-G-C) as a subtle melodic reference in the guitar
```

### 13. 设置
```
Near silence or extremely minimal single sustained synth note in C, barely perceptible, should feel like a quiet utility space, no melody, no rhythm, just a faint ambient presence, optional, no vocals
```

### 14. Handoff 仪式
```
Emotional cinematic orchestral, full strings with warm cello, solo piano, woodwind accents (oboe, english horn), subtle timpani, 70 to 60 BPM, starts with a three-note motif (C-G-C) on solo piano, builds through string sections, reaches emotional peak with full orchestra, then resolves to a warm intimate C major chord, feels like two souls connecting, the most important moment in the app, 60 seconds, should bring tears of joy, no vocals, the three-note motif should be the central melodic theme throughout
```

### 15. 错误 / 空状态
```
Gentle resolving piano, starts with a soft suspended chord (Gsus4), resolves to warm C major, very short phrase 5-8 seconds, feels like a kind musical shrug, no percussion, reassuring and non-dramatic, should make the user feel it is okay and they can try again, warm and forgiving, no vocals, the resolution should include the three-note motif (C-G-C)
```

### 16. 深夜模式
```
Stellar ambient, ethereal synth pads, distant piano notes with heavy reverb, subtle twinkling high-frequency textures like distant stars, 50-55 BPM, very sparse, feels like looking at stars alone at night, peaceful and solitary but not lonely, 3 minute loop, no drums, no vocals, should feel like a private moment with the universe, include a barely perceptible three-note motif (C-G-C) echoing in the distance
```

---

## 附录 B — 分身音乐指纹映射表

| 人格维度 | 数值范围 | 音乐参数映射 |
|----------|----------|-------------|
| 温暖度 (warmth) | 0-10 | 0-4: 小调；5-7: 混合调；8-10: 大调 |
| 能量水平 (energy) | 0-10 | BPM = 60 + (energy × 4)，范围 60-100 |
| 开放性 (openness) | 0-10 | 0-3: 简单和声(I-IV-V)；4-7: 中等(加入ii-vi)；8-10: 复杂(爵士和声) |
| 直接性 (directness) | 0-10 | 0-3: Pad/氛围；4-7: 钢琴/Rhodes；8-10: 打击乐/节奏明显 |
| 幽默感 (humor) | 0-10 | 0-3: 严肃弦乐；4-7: 轻快马林巴；8-10: 滑稽钟琴 |
| 内向/外向 | 0-10 | 0-3: 独奏乐器；4-7: 二重奏；8-10: 小型合奏 |

**示例：一个温暖(8)、低能量(3)、高开放(9)、中等直接(5)的用户**

```
调性: C 大调（高温暖）
BPM: 72（低能量：60 + 3×4）
和声: 复杂爵士和声（高开放）
主奏: Rhodes 电钢琴（中等直接）
编制: 独奏为主（低能量）

→ AI Prompt: "15-second personal musical signature, C major, 72 BPM, 
  complex jazz-influenced harmony (maj7, m9, 13 chords), 
  Rhodes electric piano solo, warm and intimate but sophisticated, 
  gentle and unhurried, no vocals, 
  include three-note motif (C-G-C) as the opening phrase, 
  loopable"
```

---

## 附录 C — 术语对照

| 中文 | 英文 | 说明 |
|------|------|------|
| 回声主题 | Echo Motif | Echo 的签名三音动机（C→G→C） |
| 分身音乐指纹 | Clone Music Fingerprint | 根据用户人格生成的个性化音乐签名 |
| 好感度音乐温度计 | Affinity Music Thermometer | 根据匹配好感度动态变化的音乐编曲 |
| 时间感知编曲 | Time-Aware Arrangements | 根据时间段切换的音乐变体 |
| 声波可视化联动 | Waveform Sync | 音频频谱驱动视觉效果 |
| Echo Palette | Echo 核心音色库 | 所有阶段共享的品牌音色集合 |

---

## 附录 D — 参考资源

- [Echo 趣味体验设计方案](./Echo-Delightful-Experience-Design.md) — 品牌人格、微交互、微文案
- [Echo PRD](./PRD-Echo.md) — 产品需求与功能定义
- [Echo 品牌设计参考](./Echo-Brand-Design-Reference.md) — Logo、色彩、吉祥物
- [Agent 行为机制](./Agent-Behavior-and-Mechanics-Echo.md) — 分身运行时与行为
