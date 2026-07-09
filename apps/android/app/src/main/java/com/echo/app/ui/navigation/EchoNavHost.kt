package com.echo.app.ui.navigation

import android.net.Uri
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.hilt.navigation.compose.hiltViewModel
import com.echo.app.ui.screens.activity.ActivityScreen
import com.echo.app.ui.screens.auth.AuthViewModel
import com.echo.app.ui.screens.auth.LoginScreen
import com.echo.app.ui.screens.auth.RegisterScreen
import com.echo.app.ui.screens.clone.CloneEditScreen
import com.echo.app.ui.screens.clone.CloneScreen
import com.echo.app.ui.screens.conversation.ConversationDetailScreen
import com.echo.app.ui.screens.conversation.ConversationListScreen
import com.echo.app.ui.screens.feed.FeedScreen
import com.echo.app.ui.screens.handoff.HandoffScreen
import com.echo.app.ui.screens.match.MatchScreen
import com.echo.app.ui.screens.onboarding.OnboardingScreen
import com.echo.app.ui.screens.report.ReportScreen
import com.echo.app.ui.screens.settings.SettingsScreen

object EchoRoutes {
    const val LOGIN = "auth/login"
    const val REGISTER = "auth/register"
    const val ONBOARDING = "onboarding"
    const val MAIN = "main"
}

object AppRoutes {
    const val HANDOFF = "handoff/{handoffId}"
    const val REPORT = "report/{targetType}/{targetId}"
    const val CLONE_EDIT = "clone/edit"

    fun handoff(handoffId: String): String = "handoff/$handoffId"

    fun report(targetType: String, targetId: String): String {
        return "report/${Uri.encode(targetType)}/${Uri.encode(targetId)}"
    }
}

object ConversationRoutes {
    const val LIST = "conversations"
    const val DETAIL = "conversations/{sessionId}?otherUserName={otherUserName}"

    fun detail(sessionId: String, otherUserName: String): String {
        return "conversations/$sessionId?otherUserName=${Uri.encode(otherUserName)}"
    }
}

sealed class EchoTab(
    val route: String,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
) {
    data object Feed : EchoTab("feed", "广场", Icons.Filled.Home, Icons.Outlined.Home)
    data object Match : EchoTab("match", "匹配", Icons.Filled.FavoriteBorder, Icons.Outlined.FavoriteBorder)
    data object Clone : EchoTab("clone", "分身", Icons.Filled.AccountCircle, Icons.Outlined.AccountCircle)
    data object Activity : EchoTab("activity", "动态", Icons.Filled.Notifications, Icons.Outlined.Notifications)
    data object Settings : EchoTab("settings", "设置", Icons.Filled.Settings, Icons.Outlined.Settings)
}

val tabs = listOf(EchoTab.Feed, EchoTab.Match, EchoTab.Clone, EchoTab.Activity, EchoTab.Settings)

private fun shouldHideBottomBar(route: String?): Boolean {
    if (route == null) return false
    return route.startsWith("conversations/") ||
        route.startsWith("handoff/") ||
        route.startsWith("report/") ||
        route == AppRoutes.CLONE_EDIT
}

@Composable
fun EchoNavHost(
    authViewModel: AuthViewModel = hiltViewModel(),
) {
    val navController = rememberNavController()
    val startDestination = remember {
        if (authViewModel.isLoggedIn()) EchoRoutes.MAIN else EchoRoutes.LOGIN
    }

    NavHost(
        navController = navController,
        startDestination = startDestination,
    ) {
        composable(EchoRoutes.LOGIN) {
            LoginScreen(
                viewModel = authViewModel,
                onNavigateToRegister = {
                    navController.navigate(EchoRoutes.REGISTER)
                },
                onLoginSuccess = {
                    val destination = if (authViewModel.shouldShowOnboardingAfterLogin()) {
                        EchoRoutes.ONBOARDING
                    } else {
                        EchoRoutes.MAIN
                    }
                    authViewModel.clearLoginNavigationHint()
                    navController.navigate(destination) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
        composable(EchoRoutes.REGISTER) {
            RegisterScreen(
                viewModel = authViewModel,
                onNavigateToLogin = {
                    navController.popBackStack()
                },
                onRegisterSuccess = {
                    navController.navigate(EchoRoutes.ONBOARDING) {
                        popUpTo(EchoRoutes.REGISTER) { inclusive = true }
                    }
                },
            )
        }
        composable(EchoRoutes.ONBOARDING) {
            OnboardingScreen(
                onComplete = {
                    navController.navigate(EchoRoutes.MAIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
        composable(EchoRoutes.MAIN) {
            MainTabScaffold(
                onLogout = {
                    authViewModel.logout()
                    navController.navigate(EchoRoutes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainTabScaffold(
    onLogout: () -> Unit,
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination
    val currentRoute = currentDestination?.route
    val showBottomBar = !shouldHideBottomBar(currentRoute)

    val conversationList: @Composable () -> Unit = {
        ConversationListScreen(
            onSessionClick = { sessionId, otherUserName ->
                navController.navigate(ConversationRoutes.detail(sessionId, otherUserName))
            },
            onNavigateToFeed = {
                navController.navigate(EchoTab.Feed.route) {
                    popUpTo(navController.graph.findStartDestination().id) {
                        saveState = true
                    }
                    launchSingleTop = true
                    restoreState = true
                }
            },
        )
    }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    tabs.forEach { tab ->
                        val selected = currentDestination?.hierarchy?.any { it.route == tab.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                Icon(
                                    imageVector = if (selected) tab.selectedIcon else tab.unselectedIcon,
                                    contentDescription = tab.label,
                                )
                            },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = EchoTab.Feed.route,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(EchoTab.Feed.route) { FeedScreen() }
            composable(EchoTab.Match.route) { MatchScreen() }
            composable(EchoTab.Clone.route) {
                CloneScreen(
                    onNavigateEdit = {
                        navController.navigate(AppRoutes.CLONE_EDIT)
                    },
                )
            }
            composable(EchoTab.Activity.route) {
                ActivityScreen(
                    onNavigateMatch = {
                        navController.navigate(EchoTab.Match.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onNavigateSession = { sessionId, peerName ->
                        navController.navigate(ConversationRoutes.detail(sessionId, peerName))
                    },
                    onNavigateHandoff = { handoffId ->
                        navController.navigate(AppRoutes.handoff(handoffId))
                    },
                    onNavigateClone = {
                        navController.navigate(EchoTab.Clone.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
            composable(ConversationRoutes.LIST) { conversationList() }
            composable(
                route = ConversationRoutes.DETAIL,
                arguments = listOf(
                    navArgument("sessionId") { type = NavType.StringType },
                    navArgument("otherUserName") {
                        type = NavType.StringType
                        defaultValue = "对方"
                    },
                ),
            ) { backStackEntry ->
                val sessionId = backStackEntry.arguments?.getString("sessionId").orEmpty()
                val otherUserName = backStackEntry.arguments?.getString("otherUserName") ?: "对方"
                ConversationDetailScreen(
                    sessionId = sessionId,
                    otherUserName = otherUserName,
                    onBack = { navController.popBackStack() },
                    onNavigateReport = { targetType, targetId ->
                        navController.navigate(AppRoutes.report(targetType, targetId))
                    },
                )
            }
            composable(
                route = AppRoutes.HANDOFF,
                arguments = listOf(
                    navArgument("handoffId") { type = NavType.StringType },
                ),
            ) { backStackEntry ->
                val handoffId = backStackEntry.arguments?.getString("handoffId").orEmpty()
                HandoffScreen(
                    handoffId = handoffId,
                    onBack = { navController.popBackStack() },
                    onAccepted = { sessionId, otherName ->
                        navController.navigate(ConversationRoutes.detail(sessionId, otherName)) {
                            popUpTo(AppRoutes.handoff(handoffId)) { inclusive = true }
                        }
                    },
                    onDeclined = {
                        navController.popBackStack()
                    },
                )
            }
            composable(
                route = AppRoutes.REPORT,
                arguments = listOf(
                    navArgument("targetType") { type = NavType.StringType },
                    navArgument("targetId") { type = NavType.StringType },
                ),
            ) {
                ReportScreen(
                    onBack = { navController.popBackStack() },
                )
            }
            composable(AppRoutes.CLONE_EDIT) {
                CloneEditScreen(
                    onBack = { navController.popBackStack() },
                )
            }
            composable(EchoTab.Settings.route) { SettingsScreen(onLogout = onLogout) }
        }
    }
}
