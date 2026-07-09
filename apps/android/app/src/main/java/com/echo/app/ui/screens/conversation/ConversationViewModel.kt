package com.echo.app.ui.screens.conversation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.echo.app.data.api.dto.MessageDto
import com.echo.app.data.repository.SessionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ConversationViewModel @Inject constructor(
    private val repository: SessionRepository,
) : ViewModel() {

    private val _messages = MutableStateFlow<List<MessageDto>>(emptyList())
    val messages: StateFlow<List<MessageDto>> = _messages.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private var pollingJob: Job? = null
    private var currentSessionId: String? = null

    fun loadMessages(sessionId: String, showLoading: Boolean = true) {
        currentSessionId = sessionId
        viewModelScope.launch {
            if (showLoading) _isLoading.value = true
            _error.value = null
            repository.getMessages(sessionId).fold(
                onSuccess = { items ->
                    _messages.value = items
                    if (showLoading) _isLoading.value = false
                },
                onFailure = { e ->
                    _error.value = e.message ?: "Failed to load messages"
                    if (showLoading) _isLoading.value = false
                },
            )
        }
    }

    fun refreshMessages(sessionId: String) {
        loadMessages(sessionId, showLoading = false)
    }

    fun startPolling(sessionId: String, intervalMs: Long = 5_000L) {
        stopPolling()
        currentSessionId = sessionId
        pollingJob = viewModelScope.launch {
            while (isActive) {
                delay(intervalMs)
                repository.getMessages(sessionId).fold(
                    onSuccess = { _messages.value = it },
                    onFailure = { /* silent on poll */ },
                )
            }
        }
    }

    fun stopPolling() {
        pollingJob?.cancel()
        pollingJob = null
    }

    override fun onCleared() {
        stopPolling()
        super.onCleared()
    }
}
