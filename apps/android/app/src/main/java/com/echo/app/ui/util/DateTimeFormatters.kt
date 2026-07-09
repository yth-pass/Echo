package com.echo.app.ui.util

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object DateTimeFormatters {
    private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm")
    private val dateTimeFormatter = DateTimeFormatter.ofPattern("MM-dd HH:mm")

    fun formatMessageTime(isoString: String?): String {
        if (isoString.isNullOrBlank()) return ""
        return try {
            val instant = Instant.parse(isoString)
            val zoned = instant.atZone(ZoneId.systemDefault())
            val today = LocalDate.now(ZoneId.systemDefault())
            if (zoned.toLocalDate() == today) {
                zoned.format(timeFormatter)
            } else {
                zoned.format(dateTimeFormatter)
            }
        } catch (_: Exception) {
            isoString
        }
    }
}
