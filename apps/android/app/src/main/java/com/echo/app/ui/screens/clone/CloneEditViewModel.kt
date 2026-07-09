package com.echo.app.ui.screens.clone

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.echo.app.data.repository.CloneRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CloneEditUiState(
    val personaText: String = "",
    val forbiddenWords: List<String> = emptyList(),
    val newForbiddenWord: String = "",
    val selectedTopics: Set<String> = emptySet(),
    val availableTopics: List<String> = DEFAULT_TOPICS,
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val saveSuccess: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class CloneEditViewModel @Inject constructor(
    private val repository: CloneRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(CloneEditUiState())
    val state: StateFlow<CloneEditUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            repository.getMyClone().fold(
                onSuccess = { detail ->
                    _state.value = _state.value.copy(
                        personaText = detail.clone.personaPrompt.orEmpty(),
                        forbiddenWords = listOf("脏话", "辱骂"),
                        selectedTopics = setOf("政治", "宗教"),
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

    fun updatePersona(text: String) {
        _state.value = _state.value.copy(personaText = text)
    }

    fun updateNewForbiddenWord(text: String) {
        _state.value = _state.value.copy(newForbiddenWord = text)
    }

    fun addForbiddenWord() {
        val word = _state.value.newForbiddenWord.trim()
        if (word.isBlank() || _state.value.forbiddenWords.contains(word)) return
        _state.value = _state.value.copy(
            forbiddenWords = _state.value.forbiddenWords + word,
            newForbiddenWord = "",
        )
    }

    fun removeForbiddenWord(word: String) {
        _state.value = _state.value.copy(
            forbiddenWords = _state.value.forbiddenWords.filterNot { it == word },
        )
    }

    fun toggleTopic(topic: String) {
        val current = _state.value.selectedTopics.toMutableSet()
        if (current.contains(topic)) {
            current.remove(topic)
        } else {
            current.add(topic)
        }
        _state.value = _state.value.copy(selectedTopics = current)
    }

    fun save() {
        viewModelScope.launch {
            val current = _state.value
            _state.value = current.copy(isSaving = true, error = null, saveSuccess = false)
            repository.updateClone(
                personaText = current.personaText.trim().ifBlank { null },
                forbiddenWords = current.forbiddenWords,
                topicsToAvoid = current.selectedTopics.toList(),
            ).fold(
                onSuccess = {
                    _state.value = _state.value.copy(isSaving = false, saveSuccess = true)
                },
                onFailure = { e ->
                    _state.value = _state.value.copy(
                        isSaving = false,
                        error = e.message ?: "保存失败",
                    )
                },
            )
        }
    }

    fun clearSaveSuccess() {
        _state.value = _state.value.copy(saveSuccess = false)
    }

    companion object {
        val DEFAULT_TOPICS = listOf("政治", "宗教", "收入", "前任", "其他")
    }
}
