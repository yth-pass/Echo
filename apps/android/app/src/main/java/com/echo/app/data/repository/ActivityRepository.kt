package com.echo.app.data.repository

import com.echo.app.data.api.EchoApi
import com.echo.app.data.api.dto.ActivityItemDto
import com.echo.app.data.mock.MockResponses
import javax.inject.Inject
import javax.inject.Singleton

data class ActivityTimelineItem(
    val type: String,
    val title: String,
    val description: String,
    val time: String,
    val refId: String?,
    val refType: String?,
    val peerName: String? = null,
)

@Singleton
class ActivityRepository @Inject constructor(
    private val api: EchoApi,
) {
    suspend fun getTimeline(): Result<List<ActivityTimelineItem>> {
        val dtos = fetchActivityDtos()
        val mapped = dtos.map { mapDto(it) }.toMutableList()
        ensureMockKinds(mapped)
        return Result.success(mapped.sortedByDescending { it.time })
    }

    private suspend fun fetchActivityDtos(): List<ActivityItemDto> {
        return try {
            val res = api.getCloneActivity()
            if (res.isSuccessful && res.body() != null) {
                res.body()!!.items
            } else {
                fetchActivityFallback()
            }
        } catch (_: Exception) {
            fetchActivityFallback()
        }
    }

    private suspend fun fetchActivityFallback(): List<ActivityItemDto> {
        return try {
            val res = api.getActivity()
            if (res.isSuccessful && res.body() != null) {
                res.body()!!.items
            } else {
                MockResponses.mockTimeline()
            }
        } catch (_: Exception) {
            MockResponses.mockTimeline()
        }
    }

    private fun mapDto(dto: ActivityItemDto): ActivityTimelineItem {
        val type = when (dto.kind) {
            "session" -> TYPE_AGENT_SESSION
            "post", "like", "comment" -> TYPE_CLONE_UPDATE
            "match" -> TYPE_MATCH
            "handoff" -> TYPE_HANDOFF
            "system" -> TYPE_SYSTEM
            else -> TYPE_SYSTEM
        }
        val title = dto.title.ifBlank {
            when (dto.kind) {
                "session" -> "Agent 对话"
                "post" -> "分身动态"
                "like" -> "收到点赞"
                "comment" -> "收到评论"
                else -> dto.kind
            }
        }
        val description = dto.description.ifBlank { dto.summaryZh.orEmpty() }
        val refId = when (type) {
            TYPE_AGENT_SESSION -> dto.sessionId ?: dto.refId ?: dto.id
            TYPE_HANDOFF -> dto.refId ?: dto.id
            TYPE_MATCH -> dto.refId ?: dto.id
            else -> dto.refId
        }
        val refType = dto.refType ?: when (type) {
            TYPE_AGENT_SESSION -> "session"
            TYPE_HANDOFF -> "handoff"
            TYPE_MATCH -> "match"
            TYPE_CLONE_UPDATE -> "clone"
            else -> null
        }
        return ActivityTimelineItem(
            type = type,
            title = title,
            description = description,
            time = dto.createdAt,
            refId = refId,
            refType = refType,
            peerName = dto.peerName,
        )
    }

    private fun ensureMockKinds(items: MutableList<ActivityTimelineItem>) {
        val hasMatch = items.any { it.type == TYPE_MATCH }
        val hasHandoff = items.any { it.type == TYPE_HANDOFF }
        val mockItems = MockResponses.mockTimeline().map { mapDto(it) }
        if (!hasMatch) {
            mockItems.firstOrNull { it.type == TYPE_MATCH }?.let { items.add(it) }
        }
        if (!hasHandoff) {
            mockItems.firstOrNull { it.type == TYPE_HANDOFF }?.let { items.add(it) }
        }
    }

    companion object {
        const val TYPE_MATCH = "match_push"
        const val TYPE_AGENT_SESSION = "agent_session"
        const val TYPE_HANDOFF = "handoff"
        const val TYPE_CLONE_UPDATE = "clone_update"
        const val TYPE_SYSTEM = "system"
    }
}
