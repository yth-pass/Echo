package com.echo.app.data.api

import com.echo.app.data.api.dto.*
import retrofit2.Response
import retrofit2.http.*

/**
 * Echo REST API interface (REQ-04).
 *
 * All endpoints are relative to the base URL configured in BuildConfig.
 */
interface EchoApi {

    // -- Auth --
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponse>

    // -- Onboarding --
    @POST("onboarding/survey")
    suspend fun submitSurvey(@Body body: SurveyRequest): Response<SurveyResponse>

    @POST("onboarding/dialogue/start")
    suspend fun startDialogue(@Body body: DialogueStartRequest): Response<DialogueStartResponse>

    @POST("onboarding/dialogue/turn")
    suspend fun sendDialogueTurn(@Body body: DialogueTurnRequest): Response<DialogueTurnResponse>

    @POST("onboarding/finalize")
    suspend fun finalizeOnboarding(): Response<FinalizeResponse>

    // -- Sessions --
    @GET("sessions")
    suspend fun getSessions(): Response<SessionListResponse>

    @GET("sessions/{sessionId}/messages")
    suspend fun getMessages(@Path("sessionId") sessionId: String): Response<MessageListResponse>

    /** @Mock — aggregated timeline; maps from GET clones/me/activity in repository. */
    @GET("activity")
    suspend fun getActivity(): Response<ActivityListResponse>

    /** Backend canonical path for clone activity feed. */
    @GET("clones/me/activity")
    suspend fun getCloneActivity(): Response<ActivityListResponse>

    // -- Feed --
    @GET("v1/feed")
    suspend fun getFeed(
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 20,
    ): Response<FeedResponse>

    // -- Matches --
    @GET("v1/matches")
    suspend fun getMatches(): Response<MatchListResponse>

    @POST("v1/matches/{matchId}/dismiss")
    suspend fun dismissMatch(@Path("matchId") matchId: String): Response<Unit>

    // -- Clone --
    @GET("v1/clones/me")
    suspend fun getMyClone(): Response<CloneDetailResponse>

    @GET("clones/me")
    suspend fun getCloneMe(): Response<CloneDetailResponse>

    @PUT("clones/me")
    suspend fun updateCloneMe(@Body body: UpdateCloneApiRequest): Response<UpdateCloneResponse>

    // -- Handoff --
    @GET("handoffs/{id}")
    suspend fun getHandoff(@Path("id") id: String): Response<HandoffDetailResponse>

    @POST("handoffs/{id}/respond")
    suspend fun respondHandoff(
        @Path("id") id: String,
        @Body body: HandoffRespondRequest,
    ): Response<HandoffRespondResponse>

    // -- Reports --
    @POST("reports")
    suspend fun submitReport(@Body body: ReportRequest): Response<ReportResponse>

    // -- Push --
    @POST("v1/push/register")
    suspend fun registerPushToken(@Body body: PushRegisterRequest): Response<Unit>
}
