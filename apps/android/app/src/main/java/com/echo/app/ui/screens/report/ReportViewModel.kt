package com.echo.app.ui.screens.report

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.echo.app.data.repository.ReportRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReportUiState(
    val targetType: String = "",
    val targetId: String = "",
    val selectedReason: String? = null,
    val description: String = "",
    val isSubmitting: Boolean = false,
    val submitSuccess: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ReportViewModel @Inject constructor(
    private val repository: ReportRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val _state = MutableStateFlow(
        ReportUiState(
            targetType = savedStateHandle.get<String>("targetType").orEmpty(),
            targetId = savedStateHandle.get<String>("targetId").orEmpty(),
        ),
    )
    val state: StateFlow<ReportUiState> = _state.asStateFlow()

    fun selectReason(reason: String) {
        _state.value = _state.value.copy(selectedReason = reason, error = null)
    }

    fun updateDescription(text: String) {
        _state.value = _state.value.copy(description = text)
    }

    fun submit() {
        val current = _state.value
        val reason = buildReason(current.selectedReason, current.description)
        if (reason.isBlank()) {
            _state.value = current.copy(error = "请选择举报原因")
            return
        }
        viewModelScope.launch {
            _state.value = current.copy(isSubmitting = true, error = null, submitSuccess = false)
            repository.submitReport(
                targetType = current.targetType,
                targetId = current.targetId,
                reason = reason,
            ).fold(
                onSuccess = {
                    _state.value = _state.value.copy(isSubmitting = false, submitSuccess = true)
                },
                onFailure = { e ->
                    _state.value = _state.value.copy(
                        isSubmitting = false,
                        error = e.message ?: "提交失败",
                    )
                },
            )
        }
    }

    fun clearSubmitSuccess() {
        _state.value = _state.value.copy(submitSuccess = false)
    }

    private fun buildReason(selectedReason: String?, description: String): String {
        val parts = listOfNotNull(
            selectedReason?.takeIf { it.isNotBlank() },
            description.trim().takeIf { it.isNotBlank() },
        )
        return parts.joinToString(" — ")
    }
}
