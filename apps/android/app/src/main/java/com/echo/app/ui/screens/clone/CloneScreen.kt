package com.echo.app.ui.screens.clone

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.echo.app.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CloneScreen(
    onNavigateEdit: () -> Unit = {},
    viewModel: CloneViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text(stringResource(R.string.tab_clone)) },
            actions = {
                IconButton(onClick = { viewModel.loadClone() }) {
                    Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.btn_refresh))
                }
            },
        )

        when {
            state.isLoading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            state.error != null -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.error ?: stringResource(R.string.state_error))
                        Spacer(modifier = Modifier.height(8.dp))
                        IconButton(onClick = { viewModel.loadClone() }) {
                            Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.btn_retry))
                        }
                    }
                }
            }
            state.clone == null -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        stringResource(R.string.state_no_clone),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
            else -> {
                val clone = state.clone!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                ) {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                stringResource(R.string.label_clone_info),
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("${stringResource(R.string.label_clone_status)}: ${clone.clone.status}")
                            clone.profile?.displayName?.let {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("${stringResource(R.string.label_display_name)}: $it")
                            }
                            clone.profile?.city?.let {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("${stringResource(R.string.label_city)}: $it")
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    clone.clone.personaPrompt?.let { prompt ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    stringResource(R.string.label_persona),
                                    style = MaterialTheme.typography.titleMedium,
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = prompt,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    clone.profile?.styleMd?.let { style ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    stringResource(R.string.label_style),
                                    style = MaterialTheme.typography.titleMedium,
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = style,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Button(
                        onClick = onNavigateEdit,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(stringResource(R.string.btn_edit_clone))
                    }
                }
            }
        }
    }
}
