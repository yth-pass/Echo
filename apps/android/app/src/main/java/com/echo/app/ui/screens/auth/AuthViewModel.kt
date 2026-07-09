package com.echo.app.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.echo.app.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false,
)

data class RegisterUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false,
    val displayNameError: String? = null,
    val emailError: String? = null,
    val phoneError: String? = null,
    val passwordError: String? = null,
    val confirmPasswordError: String? = null,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _loginState = MutableStateFlow(LoginUiState())
    val loginState: StateFlow<LoginUiState> = _loginState.asStateFlow()

    private val _registerState = MutableStateFlow(RegisterUiState())
    val registerState: StateFlow<RegisterUiState> = _registerState.asStateFlow()

    private var loginOnboardingComplete: Boolean? = null

    fun isLoggedIn(): Boolean = authRepository.isLoggedIn()

    fun shouldShowOnboardingAfterLogin(): Boolean = loginOnboardingComplete == false

    fun clearLoginNavigationHint() {
        loginOnboardingComplete = null
    }

    fun login(identifier: String, password: String) {
        if (identifier.isBlank() || password.isBlank()) return
        if (!AuthValidators.isValidIdentifier(identifier)) {
            _loginState.value = LoginUiState(error = "invalid_identifier")
            return
        }
        viewModelScope.launch {
            _loginState.value = LoginUiState(isLoading = true)
            authRepository.login(identifier, password).fold(
                onSuccess = { body ->
                    authRepository.saveToken(body.accessToken)
                    loginOnboardingComplete = body.onboardingComplete
                    _loginState.value = LoginUiState(isSuccess = true)
                },
                onFailure = { e ->
                    _loginState.value = LoginUiState(error = e.message ?: "登录失败")
                },
            )
        }
    }

    fun register(
        displayName: String,
        email: String,
        phone: String,
        password: String,
        confirmPassword: String,
    ) {
        val displayNameError = if (displayName.isBlank()) "required" else null
        val emailError = when {
            email.isBlank() -> "required"
            !AuthValidators.isValidEmail(email) -> "invalid_email"
            else -> null
        }
        val phoneError = when {
            phone.isBlank() -> "required"
            !AuthValidators.isValidPhone(phone) -> "invalid_phone"
            else -> null
        }
        val passwordError = when {
            !AuthValidators.isValidPassword(password) -> "weak_password"
            else -> null
        }
        val confirmPasswordError = when {
            password != confirmPassword -> "mismatch"
            else -> null
        }

        if (
            displayNameError != null ||
            emailError != null ||
            phoneError != null ||
            passwordError != null ||
            confirmPasswordError != null
        ) {
            _registerState.value = RegisterUiState(
                displayNameError = displayNameError,
                emailError = emailError,
                phoneError = phoneError,
                passwordError = passwordError,
                confirmPasswordError = confirmPasswordError,
            )
            return
        }

        viewModelScope.launch {
            _registerState.value = RegisterUiState(isLoading = true)
            authRepository.register(displayName, email, phone, password).fold(
                onSuccess = { body ->
                    authRepository.saveToken(body.accessToken)
                    _registerState.value = RegisterUiState(isSuccess = true)
                },
                onFailure = { e ->
                    _registerState.value = RegisterUiState(error = e.message ?: "注册失败")
                },
            )
        }
    }

    fun clearLoginError() {
        _loginState.value = _loginState.value.copy(error = null)
    }

    fun clearRegisterError() {
        _registerState.value = _registerState.value.copy(error = null)
    }

    fun resetLoginState() {
        _loginState.value = LoginUiState()
    }

    fun resetRegisterState() {
        _registerState.value = RegisterUiState()
    }

    fun logout() {
        authRepository.logout()
    }
}
