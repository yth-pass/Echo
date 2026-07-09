package com.echo.app.ui.screens.match

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.echo.app.data.api.dto.MatchPushItem
import com.echo.app.data.repository.MatchRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MatchUiState(
    val matches: List<MatchPushItem> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class MatchViewModel @Inject constructor(
    private val repo: MatchRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(MatchUiState())
    val state: StateFlow<MatchUiState> = _state.asStateFlow()

    init {
        loadMatches()
    }

    fun loadMatches() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = _state.value.matches.isEmpty(), error = null)
            repo.getMatches().fold(
                onSuccess = { matches ->
                    _state.value = _state.value.copy(
                        matches = matches,
                        isLoading = false,
                        isRefreshing = false,
                    )
                },
                onFailure = { e ->
                    _state.value = _state.value.copy(
                        isLoading = false,
                        isRefreshing = false,
                        error = e.message ?: "加载失败",
                    )
                },
            )
        }
    }

    fun refresh() {
        _state.value = _state.value.copy(isRefreshing = true)
        loadMatches()
    }

    fun dismissMatch(matchId: String) {
        viewModelScope.launch {
            repo.dismissMatch(matchId).fold(
                onSuccess = {
                    _state.value = _state.value.copy(
                        matches = _state.value.matches.filter { it.id != matchId },
                    )
                },
                onFailure = { /* silently ignore */ },
            )
        }
    }
}
