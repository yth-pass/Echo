package com.echo.app.ui.screens.activity

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.echo.app.data.repository.ActivityRepository
import com.echo.app.data.repository.ActivityTimelineItem
import com.echo.app.ui.util.DateTimeFormatters
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ActivityItem(
    val type: String,
    val title: String,
    val description: String,
    val time: String,
    val refId: String?,
    val refType: String?,
    val peerName: String? = null,
)

data class ActivityUiState(
    val items: List<ActivityItem> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ActivityViewModel @Inject constructor(
    private val repository: ActivityRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ActivityUiState())
    val state: StateFlow<ActivityUiState> = _state.asStateFlow()

    init {
        loadTimeline()
    }

    fun loadTimeline() {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            repository.getTimeline().fold(
                onSuccess = { items ->
                    _state.value = _state.value.copy(
                        items = items.map { it.toUiItem() },
                        isLoading = false,
                    )
                },
                onFailure = { e ->
                    _state.value = _state.value.copy(
                        isLoading = false,
                        error = e.message ?: "加载失败",
                    )
                },
            )
        }
    }

    private fun ActivityTimelineItem.toUiItem(): ActivityItem = ActivityItem(
        type = type,
        title = title,
        description = description,
        time = DateTimeFormatters.formatMessageTime(time),
        refId = refId,
        refType = refType,
        peerName = peerName,
    )
}
