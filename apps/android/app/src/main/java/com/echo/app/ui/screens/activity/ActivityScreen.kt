package com.echo.app.ui.screens.activity

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.echo.app.R
import com.echo.app.data.repository.ActivityRepository

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivityScreen(
    onNavigateMatch: () -> Unit,
    onNavigateSession: (sessionId: String, peerName: String) -> Unit,
    onNavigateHandoff: (handoffId: String) -> Unit,
    onNavigateClone: () -> Unit,
    viewModel: ActivityViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text(stringResource(R.string.tab_activity)) },
            actions = {
                IconButton(onClick = { viewModel.refresh() }) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = stringResource(R.string.btn_refresh),
                    )
                }
            },
        )

        when {
            state.isLoading && state.items.isEmpty() -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            state.error != null && state.items.isEmpty() -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.error ?: stringResource(R.string.state_error))
                        Spacer(modifier = Modifier.height(8.dp))
                        TextButton(onClick = { viewModel.refresh() }) {
                            Text(stringResource(R.string.btn_retry))
                        }
                    }
                }
            }
            state.items.isEmpty() -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(stringResource(R.string.state_empty_activity))
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(vertical = 8.dp),
                ) {
                    items(state.items, key = { "${it.type}-${it.refId}-${it.time}" }) { item ->
                        ActivityTimelineRow(
                            item = item,
                            onClick = {
                                when (item.type) {
                                    ActivityRepository.TYPE_MATCH -> onNavigateMatch()
                                    ActivityRepository.TYPE_AGENT_SESSION -> {
                                        val sessionId = item.refId ?: return@ActivityTimelineRow
                                        onNavigateSession(sessionId, item.peerName ?: "对方")
                                    }
                                    ActivityRepository.TYPE_HANDOFF -> {
                                        val handoffId = item.refId ?: return@ActivityTimelineRow
                                        onNavigateHandoff(handoffId)
                                    }
                                    ActivityRepository.TYPE_CLONE_UPDATE -> onNavigateClone()
                                    ActivityRepository.TYPE_SYSTEM -> Unit
                                }
                            },
                        )
                        HorizontalDivider(modifier = Modifier.padding(start = 72.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun ActivityTimelineRow(
    item: ActivityItem,
    onClick: () -> Unit,
) {
    val icon = activityIcon(item.type)
    val typeLabel = activityTypeLabel(item.type)
    val clickable = item.type != ActivityRepository.TYPE_SYSTEM

    ListItem(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (clickable) Modifier.clickable(onClick = onClick) else Modifier),
        leadingContent = {
            Icon(
                imageVector = icon,
                contentDescription = typeLabel,
                tint = MaterialTheme.colorScheme.primary,
            )
        },
        headlineContent = {
            Text(text = item.title, style = MaterialTheme.typography.titleSmall)
        },
        supportingContent = {
            Column {
                if (item.description.isNotBlank()) {
                    Text(
                        text = item.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = typeLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
        },
        trailingContent = {
            Text(
                text = item.time,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.outline,
            )
        },
    )
}

@Composable
private fun activityTypeLabel(type: String): String = when (type) {
    ActivityRepository.TYPE_MATCH -> stringResource(R.string.activity_type_match)
    ActivityRepository.TYPE_AGENT_SESSION -> stringResource(R.string.activity_type_session)
    ActivityRepository.TYPE_HANDOFF -> stringResource(R.string.activity_type_handoff)
    ActivityRepository.TYPE_CLONE_UPDATE -> stringResource(R.string.activity_type_clone)
    else -> stringResource(R.string.activity_type_system)
}

@Composable
private fun activityIcon(type: String): ImageVector = when (type) {
    ActivityRepository.TYPE_MATCH -> Icons.Default.FavoriteBorder
    ActivityRepository.TYPE_AGENT_SESSION -> Icons.Default.Chat
    ActivityRepository.TYPE_HANDOFF -> Icons.Default.SwapHoriz
    ActivityRepository.TYPE_CLONE_UPDATE -> Icons.Default.AccountCircle
    else -> Icons.Default.Notifications
}
