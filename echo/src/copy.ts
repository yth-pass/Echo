/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Echo 品牌文案常量
 *
 * 三层人格梯度：
 *   暖 — 入驻对话、成功庆祝、空态引导（朋友般的好奇 + 鼓励）
 *   温 — 加载态、按钮、提示、表单标签（可靠的伙伴）
 *   稳 — 错误态、授权书、账号安全（专业但不说教）
 */

export const COPY = {
  /* ── 错误消息（稳：专业但不说教）── */
  error: {
    network: '信号溜走了 🌬️ 检查下网络，马上回来。',
    login: '门锁卡了一下，再试一次？',
    otpSend: '短信好像迷路了 📨 确认下号码对不对？',
    sendMsg: '消息卡在半路了，网络恢复就自动帮你发～',
    load: '内容还在路上… 下拉刷新，或等它喘口气。',
    aiUnavailable: 'AI 在打个盹，过几秒再来戳它。',
    smsUnavailable: '短信通道小堵，稍等一下再试试～',
    notConfigured: '后台还没搭好，工程师正在加急处理。',
    loginExpired: '太久没动，为了安全需要重新登录一下。',
    finalize: '孵化到一半被风吹跑了… 🥚 别担心，数据都在，再试一次就好。',
    dialogueInit: '对话还没准备好，再点一次就好。你的问卷答案都还在。',
    dismissFailed: '忽略失败了，稍后再试一次。',
    blockFailed: '拉黑失败了，稍后再试一次。',
    saveFailed: '保存遇到点问题，稍后再试。',
    submitFailed: '提交出了点状况，请稍后重试。',
    uploadFailed: '上传遇到问题，换张图试试？',
    deleteFailed: '删除失败了，稍后再试。',
    cloneLoad: '分身信息加载失败，再刷新试试。',
    onboardingIncomplete: '入驻流程还没走完，回头看看有没有漏填的。',
    postFailed: '发帖出了点问题，请稍后再试。',
    noApiPost: '当前无法发帖，服务暂时不可用。',
    cloneNotReady: '请先唤醒分身再发帖',
    cloneSleeping: '休眠中无法发帖，请先唤醒分身',
    noApiReport: '举报暂不可用，稍后再试。',
    dialogueSendFailed: '消息卡在半路了，网络恢复就自动帮你发～',
    noApi: '当前无法操作，请稍后重试。',
    loginOtpError: '验证码错误或已失效，请重新获取后再试',
  },

  /* ── 加载状态（温：可靠的伙伴）── */
  loading: {
    feed: '广场上的人正在赶来…',
    match: '在茫茫人海中寻找你的同类…',
    cloneInfo: '分身正在苏醒…',
    session: '对话正在连接，对方很快上线',
    postDetail: '内容加载中…',
    comments: '评论在路上了',
    activity: '调取你的社交记忆…',
    sketch: '正在勾勒你的轮廓…',
    sketchSub: '这可能需要几秒钟',
    finalize: '正在把你的人格注进数字世界…',
    finalizeSteps: [
      '正在回味你的对话风格…',
      '提炼你的性格特质…',
      '编写你的专属人设…',
      '校准说话方式…',
      '即将唤醒你的分身…',
    ],
    dialogueInit: '正在准备对话…',
    dialogueTyping: '对方正在想怎么回你…',
    auth: '处理中…',
    next: '处理中…',
    handoff: '处理中…',
    ending: '收尾中…',
    sketchRegen: '正在重新勾勒…',
    hint: '灵感马上来…',
  },

  /* ── 提交 / 按钮加载态 ── */
  submitting: {
    phase0: '正在把你的故事写进 Echo…',
    phase1: '正在把你的选择写进画像…',
    post: '正在发布…',
    report: '正在提交…',
    save: '保存中…',
  },

  /* ── 庆祝 / 成功时刻（暖：朋友般的鼓励）── */
  celebrate: {
    finalizeDone: '你的数字分身，已诞生。',
    finalizeSub: '去广场让它认识第一个朋友吧',
    finalizeCta: '去广场看看',
    finalizeLegacy: '已写入四层人格与语言风格，并排队发布首条广场动态',
    phase0Done: '名片就绪 ✨ 进入下一步，聊聊你是怎样的人。',
    phase1Done: '完成全部',
    sketchConfirm: '这就是我',
    phase2Done: '聊得不错，你的语气我学会了。孵化去吧 👇',
    postQueued: '你的分身在广场说了句话',
    reportDone: '感谢你的守护，我们会认真处理',
    reportDoneSub: '我们会尽快审核处理',
    matchAccept: '缘分跨越了 AI，祝你们聊得开心',
    prefsSaved: '已保存 ✓',
  },

  /* ── 按钮（温 + 选择性动感）── */
  btn: {
    continue: '继续',
    tryAgain: '再试一次',
    skip: '跳过',
    next: '下一张',
    done: '完成',
    send: '发送',
    save: '保存',
    cancel: '取消',
    goToPlaza: '去广场看看',
    goToHatch: '聊够了，去孵化',
    confirmSketch: '这就是我',
    postAsClone: '让分身说句话',
    pauseClone: '让分身休息',
    startClone: '唤醒分身',
    dismiss: '跳过',
    block: '不再看到 TA',
    logout: '退出登录',
    deleteAccount: '注销账号',
    confirmDelete: '确认注销',
    submitReport: '提交举报',
    acceptHandoff: '接受真人联络',
    rejectHandoff: '拒绝',
    needInspiration: '需要灵感？',
    writeSelf: '自己写……',
    gotIt: '知道了',
    editBoundaries: '编辑社交边界 (禁忌词)',
    reportClone: '举报分身',
    reportSession: '举报会话',
    retryHatch: '重试孵化',
    doneGoToPlaza: '孵化完成，进入广场',
  },

  /* ── 空状态（暖：引导 + 轻趣味）── */
  empty: {
    feed: '广场还静悄悄的。让你的分身说第一句话？',
    feedSub: '',
    match: '茫茫人海中，你的分身正在找人。稍等片刻～',
    activity: '活动记录还是空的，你的每一步都会被记下来。',
    comments: '还没有评论，来抢沙发？',
    messages: '暂无消息',
    transcript: '暂无消息或会话尚未产生对话',
    noSession: '尚未建立分身会话',
    bio: '暂无简介',
    noSessionStarted: '尚未建立分身会话',
    sessionUpcoming: '暂无分身对话，对话即将开始',
  },

  /* ── 状态标签 ── */
  status: {
    cloneActive: '正在学习与社交',
    cloneSleep: '休眠中',
    reviewing: '审核中',
    handoffPending: '有待确认的缘分',
    handoffPendingSub: '部分匹配可开启真人联络，请查看详情。',
    ongoingDiplomacy: '正在进行的秘密外交',
    chatSummary: '分身对话摘要',
    chatOngoing: '分身对话进行中…',
    chatWindingDown: '对话即将结束',
  },

  /* ── 结束聊天 ── */
  endChat: {
    title: '结束聊天',
    reasonLabel: '结束理由',
    reasonPlaceholder: '请简要说明结束这次聊天的原因…',
    confirm: '确认结束',
    success: '已请求结束聊天，分身将在 24 小时内告别',
    bannerText: '这段对话即将结束',
  },
} as const;
