package com.echo.app.ui.screens.auth

import android.util.Patterns
import com.echo.app.R

enum class PasswordStrength {
    WEAK,
    MEDIUM,
    STRONG,
}

object AuthValidators {
    private val PHONE_REGEX = Regex("^1[3-9]\\d{9}$")

    fun isValidEmail(email: String): Boolean =
        email.isNotBlank() && Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()

    fun isValidPhone(phone: String): Boolean =
        PHONE_REGEX.matches(phone.trim())

    fun isValidIdentifier(identifier: String): Boolean {
        val trimmed = identifier.trim()
        return isValidEmail(trimmed) || isValidPhone(trimmed)
    }

    fun isValidPassword(password: String): Boolean {
        if (password.length < 8) return false
        val hasLetter = password.any { it.isLetter() }
        val hasDigit = password.any { it.isDigit() }
        return hasLetter && hasDigit
    }

    fun passwordStrength(password: String): PasswordStrength {
        if (!isValidPassword(password)) return PasswordStrength.WEAK
        val hasUpper = password.any { it.isUpperCase() }
        val hasLower = password.any { it.isLowerCase() }
        val hasSpecial = password.any { !it.isLetterOrDigit() }
        val score = listOf(hasUpper, hasLower, hasSpecial, password.length >= 12).count { it }
        return when {
            score >= 3 -> PasswordStrength.STRONG
            score >= 1 -> PasswordStrength.MEDIUM
            else -> PasswordStrength.WEAK
        }
    }

    fun passwordStrengthLabelRes(strength: PasswordStrength): Int = when (strength) {
        PasswordStrength.WEAK -> R.string.password_strength_weak
        PasswordStrength.MEDIUM -> R.string.password_strength_medium
        PasswordStrength.STRONG -> R.string.password_strength_strong
    }
}
