package com.fatorangecat.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fatorangecat.core.TimerLogic
import com.fatorangecat.core.TimerLogic.Phase
import com.fatorangecat.core.TimerLogic.TimerState
import com.fatorangecat.data.CatSettings

data class PermissionFlags(
    val canDrawOverlays: Boolean,
    val canScheduleExactAlarms: Boolean,
    val canPostNotifications: Boolean,
)

data class SettingsScreenCallbacks(
    val onSaveWorkMinutes: (Int) -> Unit,
    val onToggleEnabled: (Boolean) -> Unit,
    val onSummonNow: () -> Unit,
    val onRequestOverlayPermission: () -> Unit,
    val onRequestExactAlarmPermission: () -> Unit,
    val onRequestNotificationPermission: () -> Unit,
)

@Composable
fun SettingsScreen(
    settings: CatSettings,
    state: TimerState,
    nowMs: Long,
    permissions: PermissionFlags,
    callbacks: SettingsScreenCallbacks,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Header()
        if (!permissions.canDrawOverlays) {
            PermissionCard(
                title = "Display over other apps required",
                explainer = "Without this, the cat cannot draw over other apps during a break. He'll only show inside Fat Orange Cat — defeating the point.",
                buttonLabel = "Grant overlay permission",
                onClick = callbacks.onRequestOverlayPermission,
            )
        }
        if (!permissions.canScheduleExactAlarms) {
            PermissionCard(
                title = "Exact alarms required",
                explainer = "Without this, phase boundaries fire when Android decides — not on time. The cat may show up minutes late.",
                buttonLabel = "Grant exact alarms",
                onClick = callbacks.onRequestExactAlarmPermission,
            )
        }
        if (!permissions.canPostNotifications) {
            PermissionCard(
                title = "Notifications recommended",
                explainer = "Used for the 30-second pre-break warning so you can save your work before the cat arrives.",
                buttonLabel = "Allow notifications",
                onClick = callbacks.onRequestNotificationPermission,
            )
        }
        StatusCard(state = state, nowMs = nowMs)
        SettingsCard(
            settings = settings,
            onSave = callbacks.onSaveWorkMinutes,
            onToggleEnabled = callbacks.onToggleEnabled,
        )
        SummonCard(onSummonNow = callbacks.onSummonNow)
    }
}

@Composable
private fun Header() {
    Column {
        Text(
            text = "Fat Orange Cat",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Text(
            text = "He's not sorry.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.secondary,
        )
    }
}

@Composable
private fun PermissionCard(
    title: String,
    explainer: String,
    buttonLabel: String,
    onClick: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        ),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(text = title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(text = explainer, style = MaterialTheme.typography.bodyMedium)
            Button(onClick = onClick) { Text(buttonLabel) }
        }
    }
}

@Composable
private fun StatusCard(state: TimerState, nowMs: Long) {
    val phaseLabel = when (state.phase) {
        Phase.IDLE -> "Off duty"
        Phase.WORK -> "Working"
        Phase.BREAK -> "Break"
    }
    val remaining = TimerLogic.remainingSeconds(state, nowMs)
    val hours = TimerLogic.continuousWorkHours(state.workStreakStartedAt, nowMs)
    val weight = TimerLogic.weightStageForHours(hours)

    Card(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            StatusRow("Phase", phaseLabel)
            StatusRow(
                "Time remaining",
                if (state.phase == Phase.IDLE) "—" else TimerLogic.formatMMSS(remaining),
            )
            HorizontalDivider()
            StatusRow("Weight", weight.label)
            StatusRow("Continuous-work streak", "%.1fh".format(hours))
        }
    }
}

@Composable
private fun StatusRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
        Text(
            text = value,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
            fontFamily = FontFamily.Monospace,
        )
    }
}

@Composable
private fun SettingsCard(
    settings: CatSettings,
    onSave: (Int) -> Unit,
    onToggleEnabled: (Boolean) -> Unit,
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            var workInput by remember(settings.workMinutes) {
                mutableStateOf(settings.workMinutes.toString())
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(text = "Work block (minutes)", style = MaterialTheme.typography.titleMedium)
                OutlinedTextField(
                    value = workInput,
                    onValueChange = { input ->
                        workInput = input.filter { it.isDigit() }.take(3)
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    text = "Range: ${TimerLogic.MIN_WORK_MINUTES}–${TimerLogic.MAX_WORK_MINUTES}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.secondary,
                )
            }
            Button(
                onClick = { onSave(workInput.toIntOrNull() ?: TimerLogic.DEFAULT_WORK_MINUTES) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Save") }

            HorizontalDivider()

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = "Cat is on duty", style = MaterialTheme.typography.titleMedium)
                Switch(checked = settings.enabled, onCheckedChange = onToggleEnabled)
            }
        }
    }
}

@Composable
private fun SummonCard(onSummonNow: () -> Unit) {
    Card(
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(text = "Test the cat", style = MaterialTheme.typography.titleMedium)
            Text(
                text = "Ends the current work block now and triggers a real 5-minute break overlay.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.secondary,
            )
            Spacer(Modifier.height(4.dp))
            OutlinedButton(
                onClick = onSummonNow,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Summon him now") }
        }
    }
}
