package com.echo.app.data.mock

import com.echo.app.data.api.dto.ActivityItemDto
import com.echo.app.data.api.dto.CloneDetailResponse
import com.echo.app.data.api.dto.CloneInfo
import com.echo.app.data.api.dto.HandoffDetailResponse
import com.echo.app.data.api.dto.MessageDto
import com.echo.app.data.api.dto.ProfileInfo
import com.echo.app.data.api.dto.ReportResponse
import java.time.Instant

object MockResponses {

    fun mockHandoff(handoffId: String): HandoffDetailResponse = HandoffDetailResponse(
        id = handoffId,
        status = "pending",
        sessionId = "mock-session-1",
        affinityScore = 0.82,
        userAId = "user-a",
        userBId = "user-b",
        contactExchanged = false,
        responses = emptyList(),
    )

    fun mockRecentMessages(sessionId: String): List<MessageDto> = listOf(
        message("m1", sessionId, false, "你好，很高兴认识你。", 0),
        message("m2", sessionId, true, "我也是，最近怎么样？", 1),
        message("m3", sessionId, false, "还不错，周末有空聊聊吗？", 2),
        message("m4", sessionId, true, "可以啊，我也觉得聊得挺投缘的。", 3),
        message("m5", sessionId, false, "那我们要不要试试真人接力？", 4),
    )

    private fun message(
        id: String,
        sessionId: String,
        isSelf: Boolean,
        content: String,
        turn: Int,
    ): MessageDto {
        val now = Instant.now().minusSeconds((5 - turn) * 120L)
        return MessageDto(
            id = id,
            speakerCloneId = if (isSelf) "my-clone" else "peer-clone",
            content = content,
            turnIndex = turn,
            createdAt = now.toString(),
            isSelf = isSelf,
            speakerName = if (isSelf) "我的分身" else "对方",
        )
    }

    fun mockTimeline(): List<ActivityItemDto> {
        val now = Instant.now()
        return listOf(
            ActivityItemDto(
                kind = "match",
                id = "match-1",
                title = "收到匹配推荐",
                description = "系统为你推荐了新的匹配对象",
                createdAt = now.minusSeconds(3600).toString(),
                refId = "match-1",
                refType = "match",
            ),
            ActivityItemDto(
                kind = "session",
                id = "mock-session-1",
                title = "Agent 开始对话",
                description = "与「小雨」的分身开始了新对话",
                createdAt = now.minusSeconds(7200).toString(),
                refId = "mock-session-1",
                refType = "session",
                peerName = "小雨",
            ),
            ActivityItemDto(
                kind = "handoff",
                id = "handoff-mock-1",
                title = "Handoff 通知",
                description = "对方希望开启真人交流",
                createdAt = now.minusSeconds(1800).toString(),
                refId = "handoff-mock-1",
                refType = "handoff",
            ),
            ActivityItemDto(
                kind = "post",
                id = "post-1",
                title = "分身更新",
                description = "你的分身发布了一条新动态",
                createdAt = now.minusSeconds(86400).toString(),
                refId = null,
                refType = "clone",
            ),
            ActivityItemDto(
                kind = "system",
                id = "sys-1",
                title = "系统通知",
                description = "欢迎使用 Echo，你的分身已激活",
                createdAt = now.minusSeconds(172800).toString(),
                refId = null,
                refType = null,
            ),
        )
    }

    fun mockCloneDetail(): CloneDetailResponse = CloneDetailResponse(
        clone = CloneInfo(
            id = "clone-mock-1",
            status = "active",
            personaPrompt = "我是 Echo 用户的数字分身，说话真诚、简洁，喜欢分享日常。",
        ),
        profile = ProfileInfo(
            displayName = "Echo 用户",
            city = "上海",
            styleMd = "真诚简洁，偏轻松口语",
        ),
    )

    fun mockReportResponse(): ReportResponse = ReportResponse(
        id = "report-mock-1",
        status = "received",
    )

    const val MOCK_OTHER_NAME = "小雨"
    const val MOCK_OTHER_CITY = "上海"
}
