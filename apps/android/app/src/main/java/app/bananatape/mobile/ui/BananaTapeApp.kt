package app.bananatape.mobile.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.CallMade
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.Redo
import androidx.compose.material.icons.automirrored.outlined.Undo
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ArrowOutward
import androidx.compose.material.icons.outlined.Brush
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CropFree
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.DragIndicator
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.KeyboardArrowUp
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.PanTool
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Slideshow
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SheetState
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bananatape.mobile.adapters.AdapterError
import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.adapters.ImageMimeType
import app.bananatape.mobile.adapters.InMemoryOpenAiApiKeyStore
import app.bananatape.mobile.adapters.OpenAiApiKeyStore
import app.bananatape.mobile.adapters.AndroidFileProviderOutboundImageShare
import app.bananatape.mobile.adapters.ExportableImage
import app.bananatape.mobile.adapters.ImportedImageRole
import app.bananatape.mobile.adapters.MobileProjectRecord
import app.bananatape.mobile.adapters.NetworkReachability
import app.bananatape.mobile.adapters.ProjectImageImportRequest
import app.bananatape.mobile.editor.AndroidOpenAiImageTransport
import app.bananatape.mobile.editor.AndroidBitmapImageRenderer
import app.bananatape.mobile.editor.AnnotationHistoryStack
import app.bananatape.mobile.editor.CanvasAnnotations
import app.bananatape.mobile.editor.CanvasImage
import app.bananatape.mobile.editor.CanvasTool
import app.bananatape.mobile.editor.ComposerProvider
import app.bananatape.mobile.editor.ComposerReferenceSummary
import app.bananatape.mobile.editor.ComposerState
import app.bananatape.mobile.editor.EditorProvider
import app.bananatape.mobile.editor.FocusedImageLineage
import app.bananatape.mobile.editor.MockImageProvider
import app.bananatape.mobile.editor.MockProviderResult
import app.bananatape.mobile.editor.NativeCanvasState
import app.bananatape.mobile.editor.NativeImageComposer
import app.bananatape.mobile.editor.NativeImageCompositionOutcome
import app.bananatape.mobile.editor.NativeImageCompositionRequest
import app.bananatape.mobile.editor.HistoryEntry
import app.bananatape.mobile.editor.LineageDirection
import app.bananatape.mobile.editor.NativeHistoryBrowserState
import app.bananatape.mobile.editor.OpenAiImageProvider
import app.bananatape.mobile.editor.OpenAiProviderResult
import app.bananatape.mobile.editor.OutputSize
import app.bananatape.mobile.editor.ProviderPipelineState
import app.bananatape.mobile.editor.ProviderRequestCompletion
import app.bananatape.mobile.editor.openingForFocusedImage
import app.bananatape.mobile.editor.resolvedSubmissionMode
import app.bananatape.mobile.editor.startingNewGeneration
import app.bananatape.mobile.editor.withFocusedImageSelection
import app.bananatape.mobile.storage.LocalProjectStorage
import app.bananatape.mobile.storage.defaultAndroidProjectStorageRoot
import java.nio.file.Files
import java.time.Instant
import java.nio.file.Path

data class ProjectListState(
    val title: String = "BananaTape",
    val projects: List<ProjectListItem> = emptyList(),
) {
    val emptyMessage: String = if (projects.isEmpty()) "No projects yet" else "Projects"
}

@Composable
fun BananaTapeApp(state: ProjectListState = ProjectListState(), windowSizeClass: WindowSizeClass? = null) {
    var currentState by remember { mutableStateOf(state) }
    ProjectListScreen(
        state = currentState,
        windowSizeClass = windowSizeClass,
        onCreate = { name ->
            val cleanName = name.trim().ifEmpty { "Untitled Project" }
            val id = cleanName.lowercase()
                .map { char -> if (char.isLetterOrDigit() || char == '-') char else '-' }
                .joinToString("")
                .split("-")
                .filter { it.isNotBlank() }
                .joinToString("-")
                .ifBlank { "untitled-project" }
            currentState = ProjectListState(projects = currentState.projects + ProjectListItem(id = id, name = cleanName))
        },
        onOpen = {},
        onDelete = { id -> currentState = ProjectListState(projects = currentState.projects.filterNot { it.id == id }) },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectListScreen(
    state: ProjectListState,
    onCreate: (String) -> Unit,
    onOpen: (String) -> Unit,
    onDelete: (String) -> Unit,
    onRename: (String, String) -> Unit = { _, _ -> },
    onRefresh: () -> Unit = {},
    storage: LocalProjectStorage? = null,
    keyStore: OpenAiApiKeyStore = InMemoryOpenAiApiKeyStore(),
    windowSizeClass: WindowSizeClass? = null,
) {
    val context = LocalContext.current
    val projectStorage = storage ?: remember(context) { LocalProjectStorage(defaultAndroidProjectStorageRoot(context.filesDir)) }
    var selectedProject by remember { mutableStateOf<ProjectListItem?>(null) }
    var composerState by remember { mutableStateOf(ComposerState(selectedProvider = ComposerProvider.OPENAI)) }
    var apiKey by remember { mutableStateOf(keyStore.readApiKey().orEmpty()) }
    var pipelineState by remember { mutableStateOf(ProviderPipelineState()) }
    var canvasState by remember { mutableStateOf(NativeCanvasState(image = NativeCanvasState.EmptyImage)) }
    var historyState by remember { mutableStateOf(NativeHistoryBrowserState(emptyList())) }
    var annotationHistory by remember { mutableStateOf(AnnotationHistoryStack()) }
    var activeSheet by remember { mutableStateOf<EditorSheet?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var newProjectName by remember { mutableStateOf("") }
    val visibleProjects = state.projects
    val isExpandedWidth = windowSizeClass?.widthSizeClass == WindowWidthSizeClass.Expanded
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var pendingReferenceProjectId by remember { mutableStateOf<String?>(null) }
    val referencePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        val projectId = pendingReferenceProjectId
        pendingReferenceProjectId = null
        if (projectId == null || uri == null) return@rememberLauncherForActivityResult
        when (val imported = importReferenceImage(context, projectId, uri, projectStorage)) {
            is AdapterResult.Success -> {
                composerState = composerState.copy(references = composerState.references + imported.value)
                statusMessage = "Reference image imported."
            }
            is AdapterResult.Failure -> statusMessage = imported.error.userMessage
        }
    }
    val projectImagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        when (val imported = importBaseProjectImage(context, uri, projectStorage)) {
            is AdapterResult.Success -> {
                val session = imported.value
                selectedProject = session.project
                composerState = session.composerState
                pipelineState = session.pipelineState
                historyState = session.historyState
                annotationHistory = AnnotationHistoryStack(session.annotations)
                canvasState = NativeCanvasState(image = session.pipelineState.focusedImage ?: NativeCanvasState.EmptyImage, annotations = session.annotations)
                statusMessage = "Image imported."
                onRefresh()
            }
            is AdapterResult.Failure -> statusMessage = imported.error.userMessage
        }
    }

    fun openSession(project: ProjectListItem) {
        when (val result = projectStorage.read(project.id)) {
            is AdapterResult.Success -> {
                val session = loadProjectSession(projectStorage, result.value)
                selectedProject = session.project
                composerState = session.composerState
                pipelineState = session.pipelineState
                historyState = session.historyState
                annotationHistory = AnnotationHistoryStack(session.annotations)
                canvasState = NativeCanvasState(image = session.pipelineState.focusedImage ?: NativeCanvasState.EmptyImage, annotations = session.annotations)
                statusMessage = null
            }
            is AdapterResult.Failure -> statusMessage = result.error.userMessage
        }
    }

    selectedProject?.let { project ->
        val displayedImage = pipelineState.focusedImage ?: NativeCanvasState.EmptyImage
        val updatePipeline: (ProviderPipelineState) -> Unit = {
            pipelineState = it
            historyState = it.historyBrowserState
            annotationHistory = AnnotationHistoryStack(it.focusedAnnotations)
            canvasState = canvasState.copy(image = it.focusedImage ?: NativeCanvasState.EmptyImage, annotations = it.focusedAnnotations)
        }
        val focusImage: (String) -> Unit = { imageId ->
            val next = pipelineState.focusing(imageId)
            val nextComposer = composerState.withFocusedImageSelection(next.focusedImage)
            pipelineState = next
            historyState = next.historyBrowserState
            annotationHistory = AnnotationHistoryStack(next.focusedAnnotations)
            canvasState = canvasState.copy(image = next.focusedImage ?: NativeCanvasState.EmptyImage, annotations = next.focusedAnnotations)
            composerState = nextComposer
            persistProjectSession(projectStorage, project.id, nextComposer, next, next.historyBrowserState, next.focusedAnnotations)
        }
        val navigateLineage: (LineageDirection) -> Unit = { direction ->
            val next = when (direction) {
                LineageDirection.LEFT -> pipelineState.movingFocusLeft()
                LineageDirection.RIGHT -> pipelineState.movingFocusRight()
                LineageDirection.UP -> pipelineState.movingFocusUp()
                LineageDirection.DOWN -> pipelineState.movingFocusDown()
            }
            next.focusedImageId?.let(focusImage)
        }
        val focusHistoryEntry: (String) -> Unit = { entryId ->
            val entry = pipelineState.history.firstOrNull { it.id == entryId }
            pipelineState.images.firstOrNull { image -> image.id == entryId || image.assetId == entry?.assetId }?.id?.let(focusImage)
        }
        val generate = {
            submitGeneration(composerState, keyStore, { pipelineState }, annotationHistory.current, project.id, projectStorage, updatePipeline, { composerState = it }, { statusMessage = it }, { isSubmitting = it }, mainHandler)
        }
        val deleteHistoryEntry: (String) -> Unit = { entryId ->
            val activeRequestId = pipelineState.activeRequestId
            val next = pipelineState.deletingHistoryBranch(entryId)
            val nextComposer = composerState.withFocusedImageSelection(next.focusedImage)
            pipelineState = next
            historyState = next.historyBrowserState
            annotationHistory = AnnotationHistoryStack(next.focusedAnnotations)
            canvasState = canvasState.copy(image = next.focusedImage ?: NativeCanvasState.EmptyImage, annotations = next.focusedAnnotations)
            composerState = nextComposer
            if (activeRequestId != null && next.activeRequestId == null) {
                isSubmitting = false
                statusMessage = null
            }
            persistProjectSession(projectStorage, project.id, nextComposer, next, next.historyBrowserState, next.focusedAnnotations)
        }
        EditorScreen(
            project = project,
            canvasState = canvasState.copy(image = displayedImage, annotations = annotationHistory.current),
            composerState = composerState,
            apiKey = apiKey,
            historyState = historyState,
            isSubmitting = isSubmitting,
            statusMessage = statusMessage ?: pipelineState.userErrorMessage,
            isExpandedWidth = isExpandedWidth,
            onBack = { selectedProject = null },
            onToolSelected = { canvasState = canvasState.copy(tool = it) },
            onOpenComposer = {
                composerState = composerState.openingForFocusedImage(pipelineState.focusedImage)
                activeSheet = EditorSheet.Composer
            },
            onOpenHistory = { activeSheet = EditorSheet.History },
            onOpenMenu = { activeSheet = EditorSheet.Actions },
            onPromptChange = { composerState = composerState.copy(promptText = it) },
            onProviderSelected = { composerState = composerState.copy(selectedProvider = it) },
            onOutputSizeSelected = { composerState = composerState.copy(outputSize = it) },
            onSystemPromptChange = { composerState = composerState.copy(systemPrompt = it) },
            onApiKeyChange = { apiKey = it.trim() },
            onHistorySelect = focusHistoryEntry,
            onHistoryDelete = deleteHistoryEntry,
            onOpenReferences = { activeSheet = EditorSheet.References },
            onExport = { shareCanvasImage(context, projectStorage, project.id, displayedImage) { statusMessage = it } },
            lineage = pipelineState.focusedLineage,
            onLineageNavigate = navigateLineage,
            annotationHistory = annotationHistory,
            onAnnotationsChange = {
                annotationHistory = annotationHistory.apply(it)
                canvasState = canvasState.copy(annotations = it)
                pipelineState = pipelineState.updatingFocusedAnnotations(it)
                composerState = composerState.withFocusedImageSelection(pipelineState.focusedImage)
                persistProjectSession(projectStorage, project.id, composerState, pipelineState, historyState, it)
            },
            onViewportChange = { canvasState = canvasState.copy(viewport = it) },
            onUndo = {
                annotationHistory = annotationHistory.undo()
                canvasState = canvasState.copy(annotations = annotationHistory.current)
                pipelineState = pipelineState.updatingFocusedAnnotations(annotationHistory.current)
                persistProjectSession(projectStorage, project.id, composerState, pipelineState, historyState, annotationHistory.current)
            },
            onRedo = {
                annotationHistory = annotationHistory.redo()
                canvasState = canvasState.copy(annotations = annotationHistory.current)
                pipelineState = pipelineState.updatingFocusedAnnotations(annotationHistory.current)
                persistProjectSession(projectStorage, project.id, composerState, pipelineState, historyState, annotationHistory.current)
            },
            onGenerate = generate,
            onNewGeneration = { composerState = composerState.startingNewGeneration() },
        )
        EditorSheetHost(
            activeSheet = activeSheet,
            sheetState = sheetState,
            projectName = project.name,
            composerState = composerState,
            apiKey = apiKey,
            historyState = historyState,
            isSubmitting = isSubmitting,
            onDismiss = { activeSheet = null },
            onPromptChange = { composerState = composerState.copy(promptText = it) },
            onProviderSelected = { composerState = composerState.copy(selectedProvider = it) },
            onOutputSizeSelected = { composerState = composerState.copy(outputSize = it) },
            onSystemPromptChange = { composerState = composerState.copy(systemPrompt = it) },
            onApiKeyChange = { apiKey = it.trim() },
            onGenerate = generate,
            onNewGeneration = { composerState = composerState.startingNewGeneration() },
            onHistorySelect = focusHistoryEntry,
            onHistoryDelete = deleteHistoryEntry,
            onHistoryExport = { shareHistoryEntry(context, projectStorage, project.id, it) { message -> statusMessage = message } },
            onOpenHistory = { activeSheet = EditorSheet.History },
            onOpenReferences = { activeSheet = EditorSheet.References },
            onReferencesChange = {
                val nextComposer = composerState.copy(references = it)
                composerState = nextComposer
                persistProjectSession(projectStorage, project.id, nextComposer, pipelineState, historyState, annotationHistory.current)
            },
            onAddReference = { pendingReferenceProjectId = project.id; referencePicker.launch("image/*") },
            onProjectSettings = { activeSheet = EditorSheet.ProjectSettings },
            onProviderSettings = { activeSheet = EditorSheet.ProviderSettings },
            onRenameProject = {
                onRename(project.id, it)
                selectedProject = project.copy(name = it)
                persistProjectSession(projectStorage, project.id, composerState, pipelineState, historyState, annotationHistory.current)
                activeSheet = null
            },
            onSaveApiKey = {
                val key = apiKey.trim()
                if (key.isEmpty()) {
                    statusMessage = OpenAiImageProvider.MissingKeyMessage
                } else {
                    keyStore.saveApiKey(key)
                    apiKey = key
                    statusMessage = "OpenAI API key saved."
                    activeSheet = null
                }
            },
            onRemoveApiKey = { keyStore.deleteApiKey(); apiKey = ""; statusMessage = "OpenAI API key removed."; activeSheet = null },
            projectPath = projectStorage.filePath(project.id, "").toString(),
            onDeleteProject = { onDelete(project.id); selectedProject = null; activeSheet = null },
        )
    } ?: ProjectListContent(
        title = state.title,
        projects = visibleProjects,
        isExpandedWidth = isExpandedWidth,
        onOpen = { openSession(it); onOpen(it.id) },
        onMore = { openSession(it); activeSheet = EditorSheet.Actions },
        onCreate = { showCreateDialog = true },
        onImport = { projectImagePicker.launch("image/*") },
    )
    if (showCreateDialog) {
        AlertDialog(
            onDismissRequest = { showCreateDialog = false },
            title = { Text("New Project") },
            text = { BasicTextField(newProjectName, { newProjectName = it }, textStyle = TextStyle(color = PrototypeColor.TextPrimary, fontSize = 16.sp), modifier = Modifier.fillMaxWidth().background(PrototypeColor.Workspace, RoundedCornerShape(12.dp)).padding(12.dp)) },
            confirmButton = { TextButton(onClick = { onCreate(newProjectName); newProjectName = ""; showCreateDialog = false }) { Text("Create") } },
            dismissButton = { TextButton(onClick = { showCreateDialog = false }) { Text("Cancel") } },
            containerColor = PrototypeColor.Panel,
        )
    }
}

@Composable
private fun ProjectListContent(
    title: String,
    projects: List<ProjectListItem>,
    isExpandedWidth: Boolean,
    onOpen: (ProjectListItem) -> Unit,
    onMore: (ProjectListItem) -> Unit,
    onCreate: () -> Unit,
    onImport: () -> Unit,
) {
    Scaffold(
        containerColor = PrototypeColor.Workspace,
        bottomBar = {
            ProjectListBottomBar(onCreate = onCreate, onImport = onImport)
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(PrototypeColor.Workspace)
                .padding(padding)
                .statusBarsPadding()
                .semantics { contentDescription = "BananaTape project list" },
            contentAlignment = Alignment.TopCenter,
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .widthIn(max = if (isExpandedWidth) 520.dp else Dp.Unspecified),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 22.dp, bottom = 112.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item {
                    ProjectListHeader(title = title, onTools = onImport)
                }
                items(projects) { project ->
                    ProjectCard(project = project, onOpen = onOpen, onMore = onMore)
                }
                item {
                    Text(
                        text = "Stored privately on this device".uppercase(),
                        color = PrototypeColor.TextMuted,
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 1.2.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 18.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun ProjectListHeader(title: String, onTools: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 4.dp, end = 4.dp, bottom = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = "Local Projects".uppercase(),
                color = PrototypeColor.TextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.1.sp,
            )
            Text(text = title, color = PrototypeColor.TextStrong, fontSize = 40.sp, fontWeight = FontWeight.Normal, letterSpacing = (-1.4).sp)
        }
        IconButtonShell(icon = Icons.Outlined.FolderOpen, contentDescription = "Local project tools", onClick = onTools)
    }
}

@Composable
private fun ProjectCard(project: ProjectListItem, onOpen: (ProjectListItem) -> Unit, onMore: (ProjectListItem) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(PrototypeColor.Panel)
            .border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(16.dp))
            .clickable { onOpen(project) }
            .semantics { contentDescription = "Open ${project.name}" }
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PrototypeThumbnail(project.id)
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(text = project.name, color = PrototypeColor.TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(text = projectMetadata(project), color = PrototypeColor.TextMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        IconButtonShell(icon = Icons.Outlined.MoreHoriz, contentDescription = "Project actions for ${project.name}", size = 32.dp, onClick = { onMore(project) })
    }
}

@Composable
private fun ProjectListBottomBar(onCreate: () -> Unit, onImport: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            modifier = Modifier
                .widthIn(max = 520.dp)
                .shadow(18.dp, RoundedCornerShape(28.dp), ambientColor = Color.Black.copy(alpha = 0.45f), spotColor = Color.Black.copy(alpha = 0.45f))
                .clip(RoundedCornerShape(28.dp))
                .background(PrototypeColor.Panel)
                .border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(28.dp))
                .padding(6.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            PrototypeButton(label = "New Project", modifier = Modifier.weight(1f).height(52.dp), icon = Icons.Outlined.Add, primary = true, onClick = onCreate)
            PrototypeButton(label = "Import", modifier = Modifier.weight(0.72f).height(52.dp), primary = false, onClick = onImport)
        }
    }
}

@Composable
private fun EditorScreen(
    project: ProjectListItem,
    canvasState: NativeCanvasState,
    composerState: ComposerState,
    apiKey: String,
    historyState: NativeHistoryBrowserState,
    isSubmitting: Boolean,
    statusMessage: String?,
    isExpandedWidth: Boolean,
    onBack: () -> Unit,
    onToolSelected: (CanvasTool) -> Unit,
    onOpenComposer: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenMenu: () -> Unit,
    onPromptChange: (String) -> Unit,
    onProviderSelected: (ComposerProvider) -> Unit,
    onOutputSizeSelected: (OutputSize) -> Unit,
    onSystemPromptChange: (String) -> Unit,
    onApiKeyChange: (String) -> Unit,
    onHistorySelect: (String) -> Unit,
    onHistoryDelete: (String) -> Unit,
    onOpenReferences: () -> Unit,
    onExport: () -> Unit,
    lineage: FocusedImageLineage,
    onLineageNavigate: (LineageDirection) -> Unit,
    annotationHistory: AnnotationHistoryStack,
    onAnnotationsChange: (CanvasAnnotations) -> Unit,
    onViewportChange: (app.bananatape.mobile.editor.CanvasViewport) -> Unit,
    onUndo: () -> Unit,
    onRedo: () -> Unit,
    onGenerate: () -> Unit,
    onNewGeneration: () -> Unit,
) {
    val overlayLayout = editorOverlayLayout(isExpandedWidth)
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PrototypeColor.Workspace)
            .safeDrawingPadding()
            .imePadding(),
        contentAlignment = Alignment.TopCenter,
    ) {
        Box(modifier = Modifier.fillMaxSize().widthIn(max = if (isExpandedWidth) 720.dp else Dp.Unspecified)) {
            CanvasGrid(modifier = Modifier.fillMaxSize())
            NativeCanvasView(
                state = canvasState,
                onAnnotationsChange = onAnnotationsChange,
                onViewportChange = onViewportChange,
                onLineageNavigate = onLineageNavigate,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(horizontal = 54.dp)
                    .fillMaxWidth()
                    .aspectRatio(0.78f),
            )
            LineageNavigator(
                lineage = lineage,
                onNavigate = onLineageNavigate,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(
                        start = overlayLayout.lineageStartPaddingDp.dp,
                        end = overlayLayout.lineageEndPaddingDp.dp,
                    )
                    .fillMaxSize(),
            )
            EditorTopBar(project = project, providerStatus = providerStatus(composerState, apiKey), onBack = onBack, onExport = onExport, onMenu = onOpenMenu)
            FloatingToolBar(activeTool = canvasState.tool, canUndo = annotationHistory.canUndo, canRedo = annotationHistory.canRedo, onToolSelected = onToolSelected, onUndo = onUndo, onRedo = onRedo, modifier = Modifier.align(Alignment.CenterStart).padding(start = 12.dp))
            VersionPill(historyState = historyState, onClick = onOpenHistory, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 104.dp))
            ComposerView(
                state = composerState,
                isSubmitting = isSubmitting,
                statusMessage = statusMessage,
                onPromptChange = onPromptChange,
                onProviderSelected = onProviderSelected,
                onOutputSizeSelected = onOutputSizeSelected,
                onSystemPromptChange = onSystemPromptChange,
                onApiKeyChange = onApiKeyChange,
                onPrimaryAction = onGenerate,
                onNewGeneration = onNewGeneration,
                onExpand = onOpenComposer,
                onManageReferences = onOpenReferences,
                modifier = Modifier.align(Alignment.BottomCenter).padding(horizontal = 16.dp, vertical = 16.dp),
            )
            if (isExpandedWidth) {
                HistoryBrowserView(
                    state = historyState,
                    onSelect = onHistorySelect,
                    onDelete = onHistoryDelete,
                    onExport = { onExport() },
                    modifier = Modifier
                        .align(Alignment.CenterEnd)
                        .padding(end = overlayLayout.historyEndPaddingDp.dp)
                        .width(overlayLayout.historyWidthDp.dp)
                        .fillMaxHeight(0.58f),
                )
            }
        }
    }
}

@Composable
private fun LineageNavigator(
    lineage: FocusedImageLineage,
    onNavigate: (LineageDirection) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier) {
        LineageButton(LineageDirection.LEFT, Icons.AutoMirrored.Outlined.KeyboardArrowLeft, "Lineage left: previous batch sibling", lineage.canMoveLeft, Modifier.align(Alignment.CenterStart), onNavigate)
        LineageButton(LineageDirection.RIGHT, Icons.AutoMirrored.Outlined.KeyboardArrowRight, "Lineage right: next batch sibling", lineage.canMoveRight, Modifier.align(Alignment.CenterEnd), onNavigate)
        LineageButton(LineageDirection.UP, Icons.Outlined.KeyboardArrowUp, "Lineage up: parent image", lineage.canMoveUp, Modifier.align(Alignment.TopCenter).padding(top = 72.dp), onNavigate)
        LineageButton(LineageDirection.DOWN, Icons.Outlined.KeyboardArrowDown, "Lineage down: first direct child batch", lineage.canMoveDown, Modifier.align(Alignment.BottomCenter).padding(bottom = 72.dp), onNavigate)
    }
}

@Composable
private fun LineageButton(
    direction: LineageDirection,
    icon: ImageVector,
    description: String,
    enabled: Boolean,
    modifier: Modifier,
    onNavigate: (LineageDirection) -> Unit,
) {
    Box(
        modifier = modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(PrototypeColor.Panel.copy(alpha = if (enabled) 0.94f else 0.45f))
            .border(BorderStroke(1.dp, PrototypeColor.Border), CircleShape)
            .clickable(enabled = enabled) { onNavigate(direction) }
            .semantics { contentDescription = description; role = Role.Button },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = PrototypeColor.TextSecondary.copy(alpha = if (enabled) 1f else 0.35f), modifier = Modifier.size(22.dp))
    }
}

@Composable
private fun EditorTopBar(project: ProjectListItem, providerStatus: String, onBack: () -> Unit, onExport: () -> Unit, onMenu: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        IconButtonShell(icon = Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back to projects", onClick = onBack)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(text = project.name, color = PrototypeColor.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(if (providerStatus.contains("NO KEY")) Color(0xFFFFA54A) else PrototypeColor.Accent))
                Text(text = providerStatus, color = PrototypeColor.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.9.sp)
            }
        }
        IconButtonShell(icon = Icons.Outlined.IosShare, contentDescription = "Export focused image", onClick = onExport)
        IconButtonShell(icon = Icons.Outlined.MoreHoriz, contentDescription = "Project menu", onClick = onMenu)
    }
}

@Composable
private fun FloatingToolBar(activeTool: CanvasTool, canUndo: Boolean, canRedo: Boolean, onToolSelected: (CanvasTool) -> Unit, onUndo: () -> Unit, onRedo: () -> Unit, modifier: Modifier = Modifier) {
    val tools = listOf(
        ToolItem("Pan", CanvasTool.PAN, Icons.Outlined.PanTool),
        ToolItem("Select", CanvasTool.SELECT, Icons.Outlined.CropFree),
        ToolItem("Pen", CanvasTool.PEN, Icons.Outlined.Edit),
        ToolItem("Box", CanvasTool.BOX, Icons.Outlined.Slideshow),
        ToolItem("Arrow", CanvasTool.ARROW, Icons.AutoMirrored.Outlined.CallMade),
        ToolItem("Memo", CanvasTool.MEMO, Icons.Outlined.Brush),
    )
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(PrototypeColor.Panel)
            .border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(999.dp))
            .padding(4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        tools.forEach { item -> ToolButton(item = item, active = item.tool == activeTool, onClick = { item.tool?.let(onToolSelected) }) }
        ToolButton(item = ToolItem("Undo", null, Icons.AutoMirrored.Outlined.Undo), active = false, enabled = canUndo, onClick = onUndo)
        ToolButton(item = ToolItem("Redo", null, Icons.AutoMirrored.Outlined.Redo), active = false, enabled = canRedo, onClick = onRedo)
    }
}

@Composable
private fun ToolButton(item: ToolItem, active: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(if (active) PrototypeColor.Accent else PrototypeColor.PanelAlt)
            .clickable(enabled = enabled, onClick = onClick)
            .semantics { contentDescription = item.label; role = Role.Button },
        contentAlignment = Alignment.Center,
    ) {
        Icon(imageVector = item.icon, contentDescription = null, tint = if (!enabled) PrototypeColor.TextMuted.copy(alpha = 0.4f) else if (active) PrototypeColor.TextStrong else PrototypeColor.TextSecondary, modifier = Modifier.size(19.dp))
    }
}

@Composable
private fun VersionPill(historyState: NativeHistoryBrowserState, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val version = historyState.rows.firstOrNull { it.isSelected }?.versionLabel ?: "v1"
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(PrototypeColor.Panel.copy(alpha = 0.92f))
            .border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(999.dp))
            .clickable(onClick = onClick)
            .semantics { contentDescription = "Open history"; role = Role.Button }
            .padding(horizontal = 12.dp, vertical = 7.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.History, contentDescription = null, tint = PrototypeColor.TextSecondary, modifier = Modifier.size(14.dp))
        Text(text = "$version · 1024x1024", color = PrototypeColor.TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun CanvasGrid(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.background(PrototypeColor.Workspace)) {
        val step = 24.dp.toPx()
        val dotColor = Color.White.copy(alpha = 0.045f)
        var x = 0f
        while (x < size.width) {
            var y = 0f
            while (y < size.height) {
                drawCircle(color = dotColor, radius = 1.1f, center = Offset(x, y))
                y += step
            }
            x += step
        }
    }
}

@Composable
private fun IconButtonShell(icon: ImageVector, contentDescription: String, size: Dp = 36.dp, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(PrototypeColor.PanelAlt)
            .border(BorderStroke(1.dp, PrototypeColor.Border), CircleShape)
            .clickable(onClick = onClick)
            .semantics { this.contentDescription = contentDescription; role = Role.Button },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = PrototypeColor.TextSecondary, modifier = Modifier.size(size * 0.52f))
    }
}

@Composable
private fun PrototypeButton(label: String, modifier: Modifier = Modifier, icon: ImageVector? = null, primary: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        shape = RoundedCornerShape(999.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (primary) PrototypeColor.Accent else PrototypeColor.Workspace,
            contentColor = PrototypeColor.TextStrong,
            disabledContainerColor = PrototypeColor.PanelAlt,
            disabledContentColor = PrototypeColor.TextMuted,
        ),
        border = if (primary) null else BorderStroke(1.dp, PrototypeColor.Border),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp),
    ) {
        icon?.let { Icon(it, contentDescription = null, modifier = Modifier.size(17.dp)); Spacer(modifier = Modifier.width(5.dp)) }
        Text(label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
private fun PrototypeThumbnail(seed: String, modifier: Modifier = Modifier.size(54.dp)) {
    Canvas(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(PrototypeColor.ImageShell),
    ) {
        drawCircle(color = PrototypeColor.Accent.copy(alpha = 0.78f), radius = size.minDimension * 0.44f, center = Offset(size.width * 0.32f, size.height * 0.38f))
        drawCircle(color = Color(0xFF86EFAC).copy(alpha = 0.55f), radius = size.minDimension * 0.34f, center = Offset(size.width * 0.68f, size.height * 0.62f))
        drawCircle(color = Color(0xFFD8B4FE).copy(alpha = 0.55f), radius = size.minDimension * 0.26f, center = Offset(size.width * (if (seed.length % 2 == 0) 0.55f else 0.42f), size.height * 0.28f))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditorSheetHost(
    activeSheet: EditorSheet?,
    sheetState: SheetState,
    projectName: String,
    composerState: ComposerState,
    apiKey: String,
    historyState: NativeHistoryBrowserState,
    isSubmitting: Boolean,
    onDismiss: () -> Unit,
    onPromptChange: (String) -> Unit,
    onProviderSelected: (ComposerProvider) -> Unit,
    onOutputSizeSelected: (OutputSize) -> Unit,
    onSystemPromptChange: (String) -> Unit,
    onApiKeyChange: (String) -> Unit,
    onGenerate: () -> Unit,
    onNewGeneration: () -> Unit,
    onHistorySelect: (String) -> Unit,
    onHistoryDelete: (String) -> Unit,
    onHistoryExport: (app.bananatape.mobile.editor.HistoryEntry) -> Unit,
    onOpenHistory: () -> Unit,
    onOpenReferences: () -> Unit,
    onReferencesChange: (List<ComposerReferenceSummary>) -> Unit,
    onAddReference: () -> Unit,
    onProjectSettings: () -> Unit,
    onProviderSettings: () -> Unit,
    onRenameProject: (String) -> Unit,
    onSaveApiKey: () -> Unit,
    onRemoveApiKey: () -> Unit,
    projectPath: String,
    onDeleteProject: () -> Unit,
) {
    if (activeSheet == null) return
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PrototypeColor.Panel,
        contentColor = PrototypeColor.TextPrimary,
        dragHandle = { DragHandle() },
    ) {
        when (activeSheet) {
            EditorSheet.Composer -> ComposerView(
                state = composerState,
                onPromptChange = onPromptChange,
                onProviderSelected = onProviderSelected,
                onOutputSizeSelected = onOutputSizeSelected,
                apiKey = apiKey,
                onApiKeyChange = onApiKeyChange,
                onSystemPromptChange = onSystemPromptChange,
                isSubmitting = isSubmitting,
                onPrimaryAction = onGenerate,
                onNewGeneration = onNewGeneration,
                onClose = onDismiss,
                onManageReferences = onOpenReferences,
                onAddKey = onProviderSettings,
                expanded = true,
                modifier = Modifier.navigationBarsPadding(),
            )
            EditorSheet.History -> HistoryBrowserView(
                state = historyState,
                onSelect = onHistorySelect,
                onDelete = onHistoryDelete,
                onExport = onHistoryExport,
                onClose = onDismiss,
                modifier = Modifier.navigationBarsPadding().padding(horizontal = 16.dp, vertical = 4.dp),
            )
            EditorSheet.Actions -> ActionMenuSheet(
                referenceCount = composerState.references.size,
                onHistory = onOpenHistory,
                onReferences = onOpenReferences,
                onProjectSettings = onProjectSettings,
                onProviderSettings = onProviderSettings,
                onDeleteProject = onDeleteProject,
                modifier = Modifier.navigationBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp),
            )
            EditorSheet.References -> ReferenceImagesSheet(
                references = composerState.references,
                onReferencesChange = onReferencesChange,
                onAddReference = onAddReference,
                modifier = Modifier.navigationBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp),
            )
            EditorSheet.ProjectSettings -> ProjectSettingsSheet(
                projectName = projectName,
                systemPrompt = composerState.systemPrompt,
                projectPath = projectPath,
                onSystemPromptChange = onSystemPromptChange,
                onSave = onRenameProject,
                onReferences = onOpenReferences,
                modifier = Modifier.navigationBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp),
            )
            EditorSheet.ProviderSettings -> ProviderSettingsSheet(
                apiKey = apiKey,
                onApiKeyChange = onApiKeyChange,
                onSave = onSaveApiKey,
                onRemove = onRemoveApiKey,
                modifier = Modifier.navigationBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun ActionMenuSheet(
    referenceCount: Int,
    onHistory: () -> Unit,
    onReferences: () -> Unit,
    onProjectSettings: () -> Unit,
    onProviderSettings: () -> Unit,
    onDeleteProject: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        ActionMenuRow(icon = Icons.Outlined.History, label = "History", onClick = onHistory)
        ActionMenuRow(icon = Icons.Outlined.Image, label = "Reference images", trailing = "$referenceCount references", onClick = onReferences)
        ActionMenuRow(icon = Icons.Outlined.Tune, label = "Project settings", onClick = onProjectSettings)
        ActionMenuRow(icon = Icons.Outlined.Settings, label = "Provider settings", onClick = onProviderSettings)
        Spacer(modifier = Modifier.height(8.dp))
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PrototypeColor.Divider))
        Spacer(modifier = Modifier.height(8.dp))
        ActionMenuRow(icon = Icons.Outlined.Delete, label = "Delete project", destructive = true, onClick = onDeleteProject)
        Spacer(modifier = Modifier.height(12.dp))
    }
}

@Composable
private fun ProjectSettingsSheet(
    projectName: String,
    systemPrompt: String,
    projectPath: String,
    onSystemPromptChange: (String) -> Unit,
    onSave: (String) -> Unit,
    onReferences: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var draftName by remember(projectName) { mutableStateOf(projectName) }
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Project settings", color = PrototypeColor.TextStrong, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        SettingsField("Name", draftName, { draftName = it })
        SettingsField("System prompt", systemPrompt, onSystemPromptChange, minHeight = 96)
        PrototypeButton(label = "Manage references", primary = false, onClick = onReferences)
        Text("LOCAL FOLDER", color = PrototypeColor.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp)
        Text(projectPath, color = PrototypeColor.TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
        PrototypeButton(label = "Save", primary = true, onClick = { onSave(draftName.trim().ifEmpty { "Untitled Project" }) })
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun ProviderSettingsSheet(
    apiKey: String,
    onApiKeyChange: (String) -> Unit,
    onSave: () -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("OpenAI provider", color = PrototypeColor.TextStrong, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        BasicTextField(
            value = apiKey,
            onValueChange = onApiKeyChange,
            visualTransformation = PasswordVisualTransformation(),
            textStyle = TextStyle(color = PrototypeColor.TextPrimary, fontSize = 15.sp),
            modifier = Modifier.fillMaxWidth().background(PrototypeColor.Workspace, RoundedCornerShape(12.dp)).border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(12.dp)).padding(12.dp),
        )
        Text(if (apiKey.isBlank()) "No API key saved" else "Key ends in ${apiKey.takeLast(4)}", color = PrototypeColor.TextSecondary, fontSize = 12.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PrototypeButton(label = "Save key", modifier = Modifier.weight(1f), primary = true, onClick = onSave)
            PrototypeButton(label = "Remove", modifier = Modifier.weight(1f), primary = false, onClick = onRemove)
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun SettingsField(label: String, value: String, onValueChange: (String) -> Unit, minHeight: Int = 48) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label.uppercase(), color = PrototypeColor.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp)
        BasicTextField(value, onValueChange, textStyle = TextStyle(color = PrototypeColor.TextPrimary, fontSize = 15.sp), modifier = Modifier.fillMaxWidth().heightIn(min = minHeight.dp).background(PrototypeColor.Workspace, RoundedCornerShape(12.dp)).border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(12.dp)).padding(12.dp))
    }
}

@Composable
private fun ReferenceImagesSheet(
    references: List<ComposerReferenceSummary>,
    onReferencesChange: (List<ComposerReferenceSummary>) -> Unit,
    onAddReference: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var errorMessage by remember { mutableStateOf<String?>(null) }
    Column(
        modifier = modifier
            .fillMaxWidth()
            .semantics { contentDescription = "Reference images sheet" },
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(text = "Reference images", color = PrototypeColor.TextStrong, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        Text(text = "${references.size} references", color = PrototypeColor.TextMuted, fontSize = 12.sp)
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp),
        ) {
            item {
                AddReferenceTile {
                    errorMessage = null
                    onAddReference()
                }
            }
            gridItems(references, key = { it.id }) { reference ->
                ReferenceImageTile(
                    reference = reference,
                    onRemove = {
                        errorMessage = null
                        onReferencesChange(references.filterNot { it.id == reference.id })
                    },
                )
            }
        }
        errorMessage?.let { message ->
            Text(text = message, color = PrototypeColor.Destructive, fontSize = 13.sp, modifier = Modifier.semantics { contentDescription = message })
        }
        Spacer(modifier = Modifier.height(12.dp))
    }
}

@Composable
private fun AddReferenceTile(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(14.dp))
            .background(PrototypeColor.PanelAlt)
            .border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .semantics { contentDescription = "Add reference"; role = Role.Button },
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Outlined.Add, contentDescription = null, tint = PrototypeColor.TextSecondary, modifier = Modifier.size(24.dp))
    }
}

@Composable
private fun ReferenceImageTile(reference: ComposerReferenceSummary, onRemove: () -> Unit) {
    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(14.dp))
            .background(PrototypeColor.PanelAlt)
            .border(BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(14.dp)),
    ) {
        PrototypeThumbnail(reference.id, modifier = Modifier.fillMaxSize().padding(10.dp))
        Text(
            text = reference.label,
            color = PrototypeColor.TextPrimary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .background(PrototypeColor.Panel.copy(alpha = 0.88f))
                .padding(horizontal = 8.dp, vertical = 6.dp),
        )
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(6.dp)
                .size(28.dp)
                .clip(CircleShape)
                .background(PrototypeColor.Workspace)
                .border(BorderStroke(1.dp, PrototypeColor.Border), CircleShape)
                .clickable(onClick = onRemove)
                .semantics { contentDescription = "Remove reference ${reference.label}"; role = Role.Button },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Outlined.Close, contentDescription = null, tint = PrototypeColor.TextSecondary, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun ActionMenuRow(icon: ImageVector, label: String, trailing: String? = null, destructive: Boolean = false, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .semantics { contentDescription = label; role = Role.Button }
            .padding(horizontal = 12.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val color = if (destructive) PrototypeColor.Destructive else PrototypeColor.TextSecondary
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(22.dp))
        Text(text = label, color = if (destructive) PrototypeColor.Destructive else PrototypeColor.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        trailing?.let { Text(text = it, color = PrototypeColor.TextMuted, fontSize = 12.sp) }
    }
}

@Composable
private fun DragHandle() {
    Box(modifier = Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 8.dp), contentAlignment = Alignment.Center) {
        Box(modifier = Modifier.size(width = 42.dp, height = 4.dp).clip(RoundedCornerShape(999.dp)).background(PrototypeColor.TextPlaceholder))
    }
}

private fun submitGeneration(
    composerState: ComposerState,
    keyStore: OpenAiApiKeyStore,
    currentPipelineState: () -> ProviderPipelineState,
    annotations: CanvasAnnotations,
    projectId: String,
    storage: LocalProjectStorage,
    onPipelineState: (ProviderPipelineState) -> Unit,
    onComposerState: (ComposerState) -> Unit,
    onStatus: (String?) -> Unit,
    onSubmitting: (Boolean) -> Unit,
    mainHandler: Handler,
) {
    val pipelineState = currentPipelineState()
    val provider = if (composerState.selectedProvider == ComposerProvider.OPENAI) EditorProvider.OPENAI else EditorProvider.MOCK
    val requestId = "generate-${System.currentTimeMillis()}"
    val isEdit = resolvedSubmissionMode(composerState.mode, pipelineState.focusedImage) == app.bananatape.mobile.editor.EditorMode.EDIT
    val pending = if (isEdit) {
        pipelineState.startingEdit(composerState.trimmedPrompt, annotations, requestId, NetworkReachability.ONLINE, provider)
    } else {
        pipelineState.startingGenerate(composerState.trimmedPrompt, requestId, NetworkReachability.ONLINE, provider)
    }
    onPipelineState(pending)
    val completion = ProviderRequestCompletion(currentPipelineState, onPipelineState)
    onStatus("Submitting image request...")
    var inputImagePath: Path? = null
    var maskImagePath: Path? = null
    if (isEdit) {
        val focused = pipelineState.images.firstOrNull { it.id == pipelineState.focusedImageId } ?: return
        val sourcePath = imagePath(storage, projectId, focused) ?: return
        val composition = NativeImageComposer(AndroidBitmapImageRenderer()).compose(NativeImageCompositionRequest(sourcePath, annotations, storage.filePath(projectId, "tmp/$requestId")))
        if (composition !is NativeImageCompositionOutcome.Success) {
            completion.fail(requestId, "This image could not be prepared for export.")
            onStatus("This image could not be prepared for export.")
            return
        }
        inputImagePath = sourcePath
        maskImagePath = composition.result.mask.filePath
    }
    val request = pending.requestForActivePrompt(composerState.outputSize, composerState.references, inputImagePath, maskImagePath) ?: return
    onSubmitting(true)
    fun applyResult(result: app.bananatape.mobile.editor.ProviderImageResult) =
        completion.succeed(
            result = result,
            persist = { persistProviderImage(storage, projectId, it) },
            onApplied = { next ->
                val nextComposer = composerState.withFocusedImageSelection(next.focusedImage)
                onComposerState(nextComposer)
                persistProjectSession(storage, projectId, nextComposer, next, next.historyBrowserState, next.focusedAnnotations)
            },
        )
    if (composerState.selectedProvider == ComposerProvider.MOCK) {
        val result = if (isEdit) MockImageProvider().edit(request) else MockImageProvider().generate(request)
        val outcome = when (result) {
            is MockProviderResult.Success -> applyResult(result.value)
            is MockProviderResult.Failure -> completion.fail(requestId, result.message)
        }
        onSubmitting(false)
        if (outcome.accepted) {
            onStatus(
                when (result) {
                    is MockProviderResult.Success -> "Mock image generated."
                    is MockProviderResult.Failure -> result.message
                },
            )
        }
    } else {
        Thread {
            val result = OpenAiImageProvider(
                keyStore = keyStore,
                transport = AndroidOpenAiImageTransport(),
            ).let { if (isEdit) it.edit(request) else it.generate(request) }
            mainHandler.post {
                val outcome = when (result) {
                    is OpenAiProviderResult.Success -> applyResult(result.value)
                    is OpenAiProviderResult.Failure -> completion.fail(requestId, result.message)
                }
                onSubmitting(false)
                if (outcome.accepted) {
                    onStatus(
                        when (result) {
                            is OpenAiProviderResult.Success -> "Image generated."
                            is OpenAiProviderResult.Failure -> result.message
                        },
                    )
                }
            }
        }.start()
    }
}

internal fun importReferenceImage(
    context: Context,
    projectId: String,
    uri: Uri,
    storage: LocalProjectStorage = LocalProjectStorage(defaultAndroidProjectStorageRoot(context.filesDir)),
): AdapterResult<ComposerReferenceSummary> {
    val mimeType = when (context.contentResolver.getType(uri)) {
        "image/png" -> ImageMimeType.PNG
        "image/jpeg",
        "image/jpg",
        -> ImageMimeType.JPEG
        "image/webp" -> ImageMimeType.WEBP
        "image/gif" -> ImageMimeType.GIF
        "image/heic" -> ImageMimeType.HEIC
        else -> return AdapterResult.Failure(AdapterError.UnsupportedFileType(ImageMimeType.WEBP))
    }
    ensureProjectExists(storage, projectId)
    val assetId = "reference-${System.currentTimeMillis()}"
    val extension = if (mimeType == ImageMimeType.PNG) "png" else "jpg"
    val source = Files.createTempFile(context.cacheDir.toPath(), assetId, ".$extension")
    return try {
        context.contentResolver.openInputStream(uri)?.use { input ->
            Files.copy(input, source, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
        } ?: return AdapterResult.Failure(AdapterError.CorruptProject(projectId))
        when (val imported = storage.importProjectImage(
            ProjectImageImportRequest(
                projectId = projectId,
                assetId = assetId,
                role = ImportedImageRole.REFERENCE_IMAGE,
                mimeType = mimeType,
                originalFileName = uri.lastPathSegment?.substringAfterLast('/') ?: "$assetId.$extension",
                sourcePath = source,
            ),
        )) {
            is AdapterResult.Success -> AdapterResult.Success(
                ComposerReferenceSummary(
                    id = imported.value.id,
                    label = imported.value.projectRelativePath.substringAfterLast('/'),
                    assetPath = imported.value.projectRelativePath,
                ),
            )
            is AdapterResult.Failure -> imported
        }
    } catch (_: Exception) {
        AdapterResult.Failure(AdapterError.CorruptProject(projectId))
    } finally {
        source.toFile().delete()
    }
}

private fun ensureProjectExists(storage: LocalProjectStorage, projectId: String) {
    if (storage.read(projectId) is AdapterResult.Success) return
    storage.create(
        MobileProjectRecord(
            id = projectId,
            name = projectId.split("-").filter { it.isNotBlank() }.joinToString(" ") { it.replaceFirstChar(Char::uppercase) }.ifBlank { "Untitled Project" },
            manifestJson = minimalManifest(projectId),
            historyJson = MinimalHistory,
            canvasJson = null,
        ),
    )
}

private fun imagePath(storage: LocalProjectStorage, projectId: String, image: CanvasImage): Path? {
    val uri = Uri.parse(image.url)
    if (uri.scheme == "file" && uri.path != null) return java.nio.file.Paths.get(uri.path!!)
    val entry = (storage.read(projectId) as? AdapterResult.Success)?.value?.historyJson
        ?.let { runCatching { app.bananatape.mobile.editor.ProjectHistoryDocument.parse(it).entries }.getOrNull() }
        ?.firstOrNull { it.assetId == image.assetId }
    return entry?.let { storage.filePath(projectId, it.assetPath) }
}

private fun shareCanvasImage(context: Context, storage: LocalProjectStorage, projectId: String, image: CanvasImage, onStatus: (String) -> Unit) {
    val path = imagePath(storage, projectId, image)
    if (path == null || !Files.exists(path)) {
        onStatus("Generate or import an image before exporting.")
        return
    }
    sharePath(context, image.assetId ?: image.id, path, image.size, onStatus)
}

private fun shareHistoryEntry(context: Context, storage: LocalProjectStorage, projectId: String, entry: HistoryEntry, onStatus: (String) -> Unit) {
    val path = storage.filePath(projectId, entry.assetPath)
    sharePath(context, entry.assetId, path, app.bananatape.mobile.editor.EditorSize(1024.0, 1024.0), onStatus)
}

private fun sharePath(context: Context, id: String, path: Path, size: app.bananatape.mobile.editor.EditorSize, onStatus: (String) -> Unit) {
    if (!Files.exists(path)) {
        onStatus("This image could not be found.")
        return
    }
    val mimeType = if (path.fileName.toString().lowercase().endsWith(".jpg")) ImageMimeType.JPEG else ImageMimeType.PNG
    val image = ExportableImage(id, path, mimeType, size.width.toInt(), size.height.toInt(), Files.size(path).toInt(), Instant.now())
    when (val result = AndroidFileProviderOutboundImageShare(context, context.cacheDir.toPath().resolve("BananaTapeShare"), "app.bananatape.mobile.share").prepareShare(image)) {
        is AdapterResult.Success -> {
            val uri = Uri.parse(result.value.contentUri)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType.value
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "Export image"))
            onStatus("Share sheet opened.")
        }
        is AdapterResult.Failure -> onStatus(result.error.userMessage)
    }
}

private fun minimalManifest(id: String): String = """{"schemaVersion":1,"id":"$id","name":"${id.split("-").filter { it.isNotBlank() }.joinToString(" ") { word -> word.replaceFirstChar(Char::uppercase) }.ifBlank { "Untitled Project" }}","createdAt":"1970-01-01T00:00:00.000Z","updatedAt":"1970-01-01T00:00:00.000Z","settings":{"systemPrompt":"","referenceImages":[]}}"""

private const val MinimalHistory = """{"schemaVersion":1,"revision":0,"entries":[]}"""

private fun providerStatus(state: ComposerState, apiKey: String): String = when (state.selectedProvider) {
    ComposerProvider.OPENAI -> if (apiKey.isBlank()) "OPENAI · NO KEY" else "OPENAI · READY"
    ComposerProvider.MOCK -> "MOCKED · READY"
}

private fun projectMetadata(project: ProjectListItem): String = when (project.id) {
    "neon-koi-studies" -> "5 versions · 2h ago · Local"
    "bottle-product-hero" -> "3 versions · Yesterday · Local"
    "brand-poster-drafts" -> "8 versions · 3d ago · Local"
    else -> "1 version · Just now · Local"
}

private data class ToolItem(val label: String, val tool: CanvasTool?, val icon: ImageVector)

private enum class EditorSheet { Composer, History, Actions, References, ProjectSettings, ProviderSettings }

private val PrototypeProjects = listOf(
    ProjectListItem(id = "neon-koi-studies", name = "Neon Koi Studies"),
    ProjectListItem(id = "bottle-product-hero", name = "Bottle — Product Hero"),
    ProjectListItem(id = "brand-poster-drafts", name = "Brand Poster Drafts"),
)

private val PrototypeComposerState = ComposerState(
    promptText = "",
    selectedProvider = ComposerProvider.OPENAI,
    outputSize = OutputSize.SQUARE,
    systemPrompt = "Cinematic product art director. Prefer soft key light, shallow depth of field, muted palettes.",
    references = listOf(
        ComposerReferenceSummary("ref-1", "Koi"),
        ComposerReferenceSummary("ref-2", "Glow"),
    ),
)

private val PrototypeHistoryState = NativeHistoryBrowserState(
    entries = listOf(
        app.bananatape.mobile.editor.HistoryEntry("hist-v1", app.bananatape.mobile.editor.EditorMode.GENERATE, EditorProvider.OPENAI, "koi fish, neon, dark water", "asset-v1", "assets/koi-v1.png", null, "1970-01-01T00:00:00.000Z", 1.0),
        app.bananatape.mobile.editor.HistoryEntry("hist-v2", app.bananatape.mobile.editor.EditorMode.GENERATE, EditorProvider.OPENAI, "koi school, bioluminescent", "asset-v2", "assets/koi-v2.png", null, "1970-01-01T00:02:00.000Z", 2.0),
        app.bananatape.mobile.editor.HistoryEntry("hist-v3", app.bananatape.mobile.editor.EditorMode.EDIT, EditorProvider.OPENAI, "add ripples around the fins", "asset-v3", "assets/koi-v3.png", "hist-v2", "1970-01-01T01:00:00.000Z", 3.0),
        app.bananatape.mobile.editor.HistoryEntry("hist-v4", app.bananatape.mobile.editor.EditorMode.EDIT, EditorProvider.OPENAI, "warmer glow, higher contrast", "asset-v4", "assets/koi-v4.png", "hist-v3", "1970-01-01T01:20:00.000Z", 4.0),
        app.bananatape.mobile.editor.HistoryEntry("hist-v5", app.bananatape.mobile.editor.EditorMode.GENERATE, EditorProvider.MOCK, "single koi, minimal negative space", "asset-v5", "assets/koi-v5.png", null, "1970-01-01T01:40:00.000Z", 5.0),
    ),
    selectedEntryId = "hist-v5",
)

@Preview(showBackground = true)
@Composable
private fun BananaTapeAppPreview() {
    BananaTapeApp(ProjectListState(projects = PrototypeProjects))
}
