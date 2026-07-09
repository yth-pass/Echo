package com.echo.app.ui.screens.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.echo.app.data.api.dto.FeedPost
import com.echo.app.data.repository.FeedRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FeedUiState(
    val posts: List<FeedPost> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val hasMore: Boolean = true,
)

@HiltViewModel
class FeedViewModel @Inject constructor(
    private val repo: FeedRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(FeedUiState())
    val state: StateFlow<FeedUiState> = _state.asStateFlow()

    private var cursor: String? = null

    init {
        loadFeed()
    }

    fun loadFeed() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = _state.value.posts.isEmpty(), error = null)
            repo.getFeed(cursor = cursor).fold(
                onSuccess = { (posts, nextCursor) ->
                    cursor = nextCursor
                    _state.value = _state.value.copy(
                        posts = _state.value.posts + posts,
                        isLoading = false,
                        isRefreshing = false,
                        hasMore = nextCursor != null,
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
        cursor = null
        _state.value = _state.value.copy(isRefreshing = true, posts = emptyList())
        loadFeed()
    }
}
