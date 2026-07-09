package com.echo.app.ui.screens.handoff

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.echo.app.data.api.dto.MessageDto
import com.echo.app.data.mock.MockResponses
import com.echo.app.data.repository.HandoffRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface HandoffAction {
    data class Accepted(val sessionId: String) : HandoffAction
    data object Declined : HandoffAction
}

data class HandoffUiState(
    val otherName: String = "",
    val city: String = "",
    val affinityPercent: Int = 0,
    val messages: List<MessageDto> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val actionInProgress: Boolean = false,
    val actionComplete: HandoffAction? = null,
)

@HiltViewModel
class HandoffViewModel @Inject constructor(
    private val repository: HandoffRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val handoffId: String = savedStateHandle.get<String>("handoffId").orEmpty()

    private val _state = MutableStateFlow(HandoffUiState())
    val state: StateFlow<HandoffUiState> = _state.asStateFlow()

    init {
        if (handoffId.isNotBlank()) {
            load(handoffId)
        }
    }

    fun load(handoffId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, actionComplete = null)
            repository.getHandoff(handoffId).fold(
                onSuccess = { handoff ->
                    val affinity = ((handoff.affinityScore ?: 0.0) * 100).toInt()
                    repository.getRecentMessages(handoff.sessionId).fold(
                        onSuccess = { messages ->
                            _state.value = _state.value.copy(
                                otherName = MockResponses.MOCK_OTHER_NAME,
                                city = MockResponses.MOCK_OTHER_CITY,
                                affinityPercent = affinity,
                                messages = messages,
                                isLoading = false,
                            )
                        },
                        onFailure = { e ->
                            _state.value = _state.value.copy(
                                isLoading = false,
                                error = e.message,
                            )
                        },
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

    fun accept(handoffId: String) {
        respond(handoffId, accept = true)
    }

    fun decline(handoffId: String) {
        respond(handoffId, accept = false)
    }

    private fun respond(handoffId: String, accept: Boolean) {
        viewModelScope.launch {
            _state.value = _state.value.copy(actionInProgress = true, error = null)
            repository.getHandoff(handoffId).fold(
                onSuccess = { handoff ->
                    repository.respond(handoffId, accept).fold(
                        onSuccess = {
                            _state.value = _state.value.copy(
                                actionInProgress = false,
                                actionComplete = if (accept) {
                                    HandoffAction.Accepted(handoff.sessionId)
                                } else {
                                    HandoffAction.Declined
                                },
                            )
                        },
                        onFailure = { e ->
                            _state.value = _state.value.copy(
                                actionInProgress = false,
                                error = e.message,
                            )
                        },
                    )
                },
                onFailure = { e ->
                    _state.value = _state.value.copy(
                        actionInProgress = false,
                        error = e.message,
                    )
                },
            )
        }
    }

    fun clearActionComplete() {
        _state.value = _state.value.copy(actionComplete = null)
    }
}
