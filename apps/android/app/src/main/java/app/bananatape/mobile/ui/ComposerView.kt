package app.bananatape.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bananatape.mobile.editor.ComposerProvider
import app.bananatape.mobile.editor.ComposerState
import app.bananatape.mobile.editor.EditorMode
import app.bananatape.mobile.editor.OutputSize

@Composable
fun ComposerView(
    state: ComposerState,
    onPromptChange: (String) -> Unit,
    onProviderSelected: (ComposerProvider) -> Unit,
    onOutputSizeSelected: (OutputSize) -> Unit,
    modifier: Modifier = Modifier,
    apiKey: String = "",
    onApiKeyChange: (String) -> Unit = {},
    onSystemPromptChange: (String) -> Unit = {},
    isSubmitting: Boolean = false,
    statusMessage: String? = null,
    onPrimaryAction: () -> Unit = {},
    onNewGeneration: () -> Unit = {},
    onExpand: () -> Unit = {},
    onManageReferences: () -> Unit = {},
    onAddKey: () -> Unit = {},
    onClose: () -> Unit = {},
    expanded: Boolean = false,
) {
    if (expanded) {
        ExpandedComposerSheet(
            state = state,
            apiKey = apiKey,
            isSubmitting = isSubmitting,
            onPromptChange = onPromptChange,
            onProviderSelected = onProviderSelected,
            onOutputSizeSelected = onOutputSizeSelected,
            onApiKeyChange = onApiKeyChange,
            onSystemPromptChange = onSystemPromptChange,
            onPrimaryAction = onPrimaryAction,
            onNewGeneration = onNewGeneration,
            onManageReferences = onManageReferences,
            onAddKey = onAddKey,
            onClose = onClose,
            modifier = modifier,
        )
    } else {
        CompactComposerView(
            state = state,
            isSubmitting = isSubmitting,
            statusMessage = statusMessage,
            onPrimaryAction = onPrimaryAction,
            onExpand = onExpand,
            modifier = modifier,
        )
    }
}

@Composable
private fun CompactComposerView(
    state: ComposerState,
    isSubmitting: Boolean,
    statusMessage: String?,
    onPrimaryAction: () -> Unit,
    onExpand: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(PrototypeColor.Panel)
            .border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(18.dp))
            .semantics { contentDescription = "Native bottom composer" }
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .clip(RoundedCornerShape(14.dp))
                .background(PrototypeColor.PanelAlt)
                .clickable(onClick = onExpand)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = state.promptText.ifBlank { "Describe an image..." },
                color = if (state.promptText.isBlank()) PrototypeColor.TextPlaceholder else PrototypeColor.TextPrimary,
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = statusMessage ?: "${state.providerDisplayName} · ${state.outputSize.shortLabel()}",
                color = PrototypeColor.TextMuted,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(PrototypeColor.PanelAlt)
                .border(BorderStroke(1.dp, PrototypeColor.Border), CircleShape)
                .clickable(onClick = onExpand)
                .semantics { contentDescription = "Expand composer"; role = Role.Button },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Outlined.ExpandLess, contentDescription = null, tint = PrototypeColor.TextSecondary, modifier = Modifier.size(19.dp))
        }
        PrimaryComposerButton(
            label = if (isSubmitting) "Working" else state.primaryActionLabel,
            enabled = state.canSubmitPrimaryAction && !isSubmitting,
            onClick = onPrimaryAction,
            modifier = Modifier.width(97.dp).height(40.dp),
        )
    }
}

@Composable
private fun ExpandedComposerSheet(
    state: ComposerState,
    apiKey: String,
    isSubmitting: Boolean,
    onPromptChange: (String) -> Unit,
    onProviderSelected: (ComposerProvider) -> Unit,
    onOutputSizeSelected: (OutputSize) -> Unit,
    onApiKeyChange: (String) -> Unit,
    onSystemPromptChange: (String) -> Unit,
    onPrimaryAction: () -> Unit,
    onNewGeneration: () -> Unit,
    onManageReferences: () -> Unit,
    onAddKey: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(PrototypeColor.Panel)
            .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text = state.primaryActionLabel, color = PrototypeColor.TextStrong, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            if (state.hasSelectedImage && state.mode == EditorMode.EDIT) {
                TextButton(
                    onClick = onNewGeneration,
                    modifier = Modifier.semantics { contentDescription = "New Generation"; role = Role.Button },
                ) {
                    Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("New Generation", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(PrototypeColor.PanelAlt)
                    .clickable(onClick = onClose)
                    .semantics { contentDescription = "Close composer"; role = Role.Button },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Close, contentDescription = null, tint = PrototypeColor.TextSecondary, modifier = Modifier.size(19.dp))
            }
        }
        DarkTextArea(
            value = state.promptText,
            placeholder = "Describe an image...",
            minHeight = 104,
            contentDescription = "Prompt",
            onValueChange = onPromptChange,
        )
        if (state.selectedProvider == ComposerProvider.OPENAI && apiKey.isBlank()) {
            MissingKeyWarning(onAddKey = onAddKey)
        }
        LabeledSection(label = "Provider") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                ProviderCard("OpenAI", selected = state.selectedProvider == ComposerProvider.OPENAI, enabled = true, modifier = Modifier.weight(1f)) { onProviderSelected(ComposerProvider.OPENAI) }
                ProviderCard("Mocked", selected = state.selectedProvider == ComposerProvider.MOCK, enabled = true, modifier = Modifier.weight(1f)) { onProviderSelected(ComposerProvider.MOCK) }
                ProviderCard("Codex", selected = false, enabled = false, modifier = Modifier.weight(1f)) {}
            }
        }
        LabeledSection(label = "Output Size") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                SizeCard("Square", "1024²", selected = state.outputSize == OutputSize.SQUARE, modifier = Modifier.weight(1f)) { onOutputSizeSelected(OutputSize.SQUARE) }
                SizeCard("Portrait", "1024×1536", selected = state.outputSize == OutputSize.PORTRAIT, modifier = Modifier.weight(1f)) { onOutputSizeSelected(OutputSize.PORTRAIT) }
                SizeCard("Landscape", "1536×1024", selected = state.outputSize == OutputSize.LANDSCAPE, modifier = Modifier.weight(1f)) { onOutputSizeSelected(OutputSize.LANDSCAPE) }
            }
        }
        LabeledSection(label = "References · ${state.references.size} references") {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                state.references.forEach { reference -> ReferenceChip(reference.label) }
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(14.dp))
                        .clickable(onClick = onManageReferences)
                        .semantics { contentDescription = "Manage references"; role = Role.Button },
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Outlined.Add, contentDescription = null, tint = PrototypeColor.TextMuted, modifier = Modifier.size(19.dp)) }
                Text(
                    text = "Manage",
                    color = PrototypeColor.Accent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .clickable(onClick = onManageReferences)
                        .semantics { contentDescription = "Manage references"; role = Role.Button }
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                )
            }
        }
        LabeledSection(label = "System prompt · Project context") {
            DarkTextArea(
                value = state.systemPrompt,
                placeholder = "Cinematic product art director. Prefer soft key light, shallow depth of field, muted palettes.",
                minHeight = 88,
                contentDescription = "System prompt",
                onValueChange = onSystemPromptChange,
            )
        }
        PrimaryComposerButton(
            label = if (isSubmitting) "Working..." else state.primaryActionLabel,
            enabled = state.canSubmitPrimaryAction && !isSubmitting,
            onClick = onPrimaryAction,
            modifier = Modifier.fillMaxWidth().height(52.dp),
        )
    }
}

@Composable
private fun MissingKeyWarning(onAddKey: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(PrototypeColor.Warning)
            .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)), RoundedCornerShape(16.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.Outlined.Key, contentDescription = null, tint = PrototypeColor.WarningText, modifier = Modifier.size(18.dp))
        Text(text = "Add your OpenAI API key to generate.", color = PrototypeColor.WarningText, fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(
            text = "Add key",
            color = PrototypeColor.TextStrong,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(PrototypeColor.WarningAction)
                .clickable(onClick = onAddKey)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
}

@Composable
private fun LabeledSection(label: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(text = label.uppercase(), color = PrototypeColor.TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.9.sp, fontFamily = FontFamily.Monospace)
        content()
    }
}

@Composable
private fun DarkTextArea(value: String, placeholder: String, minHeight: Int, contentDescription: String, onValueChange: (String) -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = minHeight.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(PrototypeColor.Workspace)
            .border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(16.dp))
            .padding(14.dp),
    ) {
        if (value.isBlank()) {
            Text(text = placeholder, color = PrototypeColor.TextPlaceholder, fontSize = 15.sp)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(color = PrototypeColor.TextPrimary, fontSize = 15.sp, lineHeight = 20.sp),
            modifier = Modifier.fillMaxWidth().heightIn(min = minHeight.dp).semantics { this.contentDescription = contentDescription },
        )
    }
}

@Composable
private fun ProviderCard(label: String, selected: Boolean, enabled: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val border = when {
        selected -> PrototypeColor.Accent
        else -> PrototypeColor.Border
    }
    Box(
        modifier = modifier
            .height(44.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) PrototypeColor.Accent.copy(alpha = 0.12f) else PrototypeColor.PanelAlt)
            .border(BorderStroke(1.dp, border), RoundedCornerShape(12.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .semantics {
                contentDescription = label
                role = Role.Button
                if (!enabled) disabled()
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(text = label, color = if (!enabled) PrototypeColor.TextPlaceholder else PrototypeColor.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun SizeCard(label: String, caption: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(PrototypeColor.PanelAlt)
            .border(BorderStroke(1.dp, if (selected) PrototypeColor.Accent else PrototypeColor.Border), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .semantics { contentDescription = caption }
            .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(text = label, color = PrototypeColor.TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        Text(text = caption, color = PrototypeColor.TextMuted, fontSize = 10.sp, maxLines = 1)
    }
}

@Composable
private fun ReferenceChip(label: String) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(PrototypeColor.ImageShell)
            .border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(14.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = label.take(2).uppercase(), color = PrototypeColor.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun PrimaryComposerButton(label: String, enabled: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        shape = RoundedCornerShape(999.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = PrototypeColor.Accent,
            contentColor = PrototypeColor.TextStrong,
            disabledContainerColor = PrototypeColor.PanelAlt,
            disabledContentColor = PrototypeColor.TextMuted,
        ),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 0.dp),
    ) {
        Text(text = label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

private fun OutputSize.shortLabel(): String = when (this) {
    OutputSize.SQUARE -> "Square"
    OutputSize.PORTRAIT -> "Portrait"
    OutputSize.LANDSCAPE -> "Landscape"
}
