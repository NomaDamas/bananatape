package app.bananatape.mobile.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bananatape.mobile.editor.EditorMode
import app.bananatape.mobile.editor.EditorProvider
import app.bananatape.mobile.editor.HistoryBrowserRow
import app.bananatape.mobile.editor.NativeHistoryBrowserState

@Composable
fun HistoryBrowserView(
    state: NativeHistoryBrowserState,
    onSelect: (String) -> Unit,
    onDelete: (String) -> Unit,
    onExport: (app.bananatape.mobile.editor.HistoryEntry) -> Unit = {},
    modifier: Modifier = Modifier,
    onClose: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp, bottomStart = 18.dp, bottomEnd = 18.dp))
            .background(PrototypeColor.Panel)
            .semantics { contentDescription = "History browser" }
            .padding(bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(text = "History", color = PrototypeColor.TextStrong, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                Text(text = "Branch-aware · tap to load", color = PrototypeColor.TextMuted, fontSize = 10.5.sp, fontFamily = FontFamily.Monospace)
            }
            onClose?.let {
                RoundAction(icon = Icons.Outlined.Close, contentDescription = "Close history", onClick = it)
            }
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.rows) { row ->
                HistoryBrowserRowView(row = row, onSelect = onSelect, onDelete = onDelete, onExport = onExport)
            }
        }
    }
}

@Composable
private fun HistoryBrowserRowView(row: HistoryBrowserRow, onSelect: (String) -> Unit, onDelete: (String) -> Unit, onExport: (app.bananatape.mobile.editor.HistoryEntry) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(if (row.isSelected) 14.dp else 0.dp, RoundedCornerShape(16.dp), ambientColor = PrototypeColor.Accent.copy(alpha = 0.18f), spotColor = PrototypeColor.Accent.copy(alpha = 0.18f))
            .clip(RoundedCornerShape(16.dp))
            .background(if (row.isSelected) PrototypeColor.PanelAlt else PrototypeColor.PanelAlt.copy(alpha = 0.86f))
            .border(BorderStroke(1.dp, if (row.isSelected) PrototypeColor.Accent else PrototypeColor.Border), RoundedCornerShape(16.dp))
            .clickable { onSelect(row.id) }
            .semantics { contentDescription = "${row.versionLabel} ${row.branchLabel} history item, ${row.entry.prompt}" }
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(PrototypeColor.ImageShell)
                .border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = row.versionLabel, color = PrototypeColor.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                Badge(text = row.versionLabel, background = PrototypeColor.Workspace, foreground = PrototypeColor.TextPrimary)
                Badge(
                    text = row.branchLabel.uppercase(),
                    background = if (row.entry.mode == EditorMode.GENERATE) PrototypeColor.RootBadge else PrototypeColor.EditBadge,
                    foreground = if (row.entry.mode == EditorMode.GENERATE) PrototypeColor.RootBadgeText else PrototypeColor.EditBadgeText,
                )
                Badge(text = providerLabel(row.entry.provider).uppercase(), background = PrototypeColor.Panel, foreground = PrototypeColor.TextMuted)
            }
            Text(text = row.entry.prompt, color = PrototypeColor.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(text = timestampLabel(row.versionLabel), color = PrototypeColor.TextMuted, fontSize = 11.sp)
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            RoundAction(icon = Icons.Outlined.Download, contentDescription = "Export history entry ${row.id}", size = 30, onClick = { onExport(row.entry) })
            RoundAction(icon = Icons.Outlined.Delete, contentDescription = "Delete history entry ${row.id}", size = 30, tint = PrototypeColor.Destructive, onClick = { onDelete(row.id) })
        }
    }
}

@Composable
private fun Badge(text: String, background: Color, foreground: Color) {
    Text(
        text = text,
        color = foreground,
        fontSize = 9.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.4.sp,
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(background)
            .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.07f)), RoundedCornerShape(999.dp))
            .padding(horizontal = 7.dp, vertical = 4.dp),
    )
}

@Composable
private fun RoundAction(icon: ImageVector, contentDescription: String, size: Int = 36, tint: Color = PrototypeColor.TextSecondary, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .clickable(onClick = onClick)
            .semantics { this.contentDescription = contentDescription; role = Role.Button },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(size.dp)
                .clip(CircleShape)
                .background(PrototypeColor.Panel)
                .border(BorderStroke(1.dp, PrototypeColor.Border), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size((size * 0.52f).dp))
        }
    }
}

private fun providerLabel(provider: EditorProvider): String = when (provider) {
    EditorProvider.OPENAI -> "OpenAI"
    EditorProvider.MOCK -> "Mocked"
    EditorProvider.CODEX -> "Codex"
}

private fun timestampLabel(versionLabel: String): String = when (versionLabel) {
    "v1", "v2" -> "2h ago"
    "v3", "v4" -> "1h ago"
    "v5" -> "40m ago"
    else -> "Just now"
}

@Preview(showBackground = true)
@Composable
private fun HistoryBrowserPreview() {
    HistoryBrowserView(
        state = NativeHistoryBrowserState.FixtureRootWithEditChild,
        onSelect = {},
        onDelete = {},
        modifier = Modifier.height(360.dp).background(PrototypeColor.Workspace).padding(16.dp),
    )
}
