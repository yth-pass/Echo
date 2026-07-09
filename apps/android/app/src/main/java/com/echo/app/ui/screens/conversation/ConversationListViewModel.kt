package com.echo.app.ui.screens.conversation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.echo.app.data.api.dto.SessionDto
import com.echo.app.data.repository.SessionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ConversationListUiState(
    val sessions: List<SessionDto> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ConversationListViewModel @Inject constructor(
    private val repository: SessionRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ConversationListUiState())
    val state: StateFlow<ConversationListUiState> = _state.asStateFlow()

    init {
        loadSessions()
    }

    fun loadSessions() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            repository.getSessions().fold(
                onSuccess = { items ->
                    val active = items.filter { it.status.equals("active", ignoreCase = true) }
                    _state.value = ConversationListUiState(
                        sessions = if (active.isNotEmpty()) active else items,
                        isLoading = false,
                    )
                },
                onFailure = { e ->
                    _state.value = _state.value.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load sessions",
                    )
                },
            )
        }
    }

    fun refresh() = loadSessions()
}
