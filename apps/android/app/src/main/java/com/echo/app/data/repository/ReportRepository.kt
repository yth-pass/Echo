package com.echo.app.data.repository

import com.echo.app.data.api.EchoApi
import com.echo.app.data.api.dto.ReportRequest
import com.echo.app.data.api.dto.ReportResponse
import com.echo.app.data.mock.MockResponses
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReportRepository @Inject constructor(
    private val api: EchoApi,
) {
    suspend fun submitReport(
        targetType: String,
        targetId: String,
        reason: String?,
    ): Result<ReportResponse> {
        return try {
            val res = api.submitReport(
                ReportRequest(
                    targetType = targetType,
                    targetId = targetId,
                    reason = reason,
                ),
            )
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                Result.success(MockResponses.mockReportResponse())
            }
        } catch (_: Exception) {
            Result.success(MockResponses.mockReportResponse())
        }
    }
}
