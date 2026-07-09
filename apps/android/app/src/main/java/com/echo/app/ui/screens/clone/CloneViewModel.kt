package com.echo.app.ui.screens.clone

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.echo.app.data.api.dto.CloneDetailResponse
import com.echo.app.data.repository.CloneRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CloneUiState(
    val clone: CloneDetailResponse? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class CloneViewModel @Inject constructor(
    private val repo: CloneRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(CloneUiState())
    val state: StateFlow<CloneUiState> = _state.asStateFlow()

    init {
        loadClone()
    }

    fun loadClone() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            repo.getMyClone().fold(
                onSuccess = { clone ->
                    _state.value = _state.value.copy(clone = clone, isLoading = false)
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
}
