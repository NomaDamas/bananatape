package app.bananatape.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.adapters.MobileProjectRecord
import app.bananatape.mobile.storage.LocalProjectStorage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class MainActivityTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun resetProjectStorage() {
        composeRule.activity.filesDir.resolve("projects").deleteRecursively()
        composeRule.activityRule.scenario.recreate()
        composeRule.waitForIdle()
    }

    @Test
    fun firstLaunch_whenProjectStoreIsEmpty_showsEmptyLocalProjectList() {
        composeRule.onNodeWithText("BananaTape").assertIsDisplayed()
        composeRule.onNodeWithText("Local Projects".uppercase()).assertIsDisplayed()
        composeRule.onNodeWithText("Neon Koi Studies").assertDoesNotExist()
        composeRule.onNodeWithText("Bottle — Product Hero").assertDoesNotExist()
        composeRule.onNodeWithText("Stored privately on this device".uppercase()).assertIsDisplayed()
        composeRule.onNodeWithText("New Project").assertHasClickAction().assertIsDisplayed()
        composeRule.onNodeWithText("Magic Layer").assertDoesNotExist()
    }

    @Test
    fun accessibilitySemantics_whenEditorLaunches_exposesRequiredControlLabels() {
        createFocusedProject("Accessibility Test")

        composeRule.onNodeWithContentDescription("BananaTape project list").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Open Accessibility Test").assertHasClickAction().performClick()
        composeRule.onNodeWithContentDescription("Back to projects").assertHasClickAction().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Project menu").assertHasClickAction().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Pan").assertHasClickAction().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Focused image focused-image").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Lineage left: previous batch sibling").assertIsNotEnabled().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Lineage right: next batch sibling").assertIsNotEnabled().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Lineage up: parent image").assertIsNotEnabled().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Lineage down: first direct child batch").assertIsNotEnabled().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Native bottom composer").assertIsDisplayed()
        composeRule.onNodeWithText("Apply edit").assertIsNotEnabled()
        composeRule.onNodeWithContentDescription("Expand composer").assertHasClickAction().performClick()
        composeRule.onNodeWithContentDescription("Prompt").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("OpenAI").assertHasClickAction().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Mocked").assertHasClickAction().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Codex").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("1024²").assertHasClickAction().assertIsDisplayed()
    }

    @Test
    fun referenceImagesSheet_whenOpenedFromProjectMenu_exposesManageControls() {
        createProject("Reference Test")

        composeRule.onNodeWithContentDescription("Open Reference Test").assertHasClickAction().performClick()
        composeRule.onNodeWithContentDescription("Project menu").assertHasClickAction().performClick()
        composeRule.onNodeWithContentDescription("Reference images").assertHasClickAction().performClick()

        composeRule.onNodeWithContentDescription("Reference images sheet").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Add reference").assertHasClickAction().assertIsDisplayed()
        composeRule.onNodeWithText("0 references").assertIsDisplayed()
        composeRule.onNodeWithText("Use a PNG or JPEG image.").assertDoesNotExist()
    }

    @Test
    fun focusedImageComposer_whenOpened_defaultsToEditAndNewGenerationResetsMode() {
        createFocusedProject("Focused Composer")

        composeRule.onNodeWithContentDescription("Open Focused Composer").performClick()
        composeRule.onNodeWithContentDescription("Expand composer").performClick()

        composeRule.onAllNodesWithText("Apply edit", useUnmergedTree = true).assertCountEquals(3)
        composeRule.onNodeWithContentDescription("New Generation").assertHasClickAction().performClick()
        composeRule.onAllNodesWithText("Generate", useUnmergedTree = true).assertCountEquals(3)
    }

    @Test
    fun editorOverlays_onPixel7Portrait_preserveUsableBounds() {
        createOverlayProject("Overlay Geometry")

        composeRule.onNodeWithContentDescription("Open Overlay Geometry").performClick()
        composeRule.waitForIdle()

        val density = composeRule.activity.resources.displayMetrics.density
        val widthDp = composeRule.activity.resources.displayMetrics.widthPixels / density
        val heightDp = composeRule.activity.resources.displayMetrics.heightPixels / density
        assertTrue("Expected Pixel 7 portrait width, was ${widthDp}dp", widthDp in 400f..420f)
        assertTrue("Expected portrait display, was ${widthDp}x${heightDp}dp", heightDp > widthDp)

        val canvas = boundsForDescription("Focused image focused")
        val imageContent = boundsForDescription("Native annotation canvas")
        val composer = boundsForDescription("Native bottom composer")
        val toolRail = boundsForTag("editor.tool-rail")
        val versionPill = boundsForDescription("Open history")
        val lineage = mapOf(
            "left" to boundsForDescription("Lineage left: previous batch sibling"),
            "right" to boundsForDescription("Lineage right: next batch sibling"),
            "up" to boundsForDescription("Lineage up: parent image"),
            "down" to boundsForDescription("Lineage down: first direct child batch"),
        )
        val editorBounds = buildString {
            appendLine("device=${android.os.Build.MODEL} sdk=${android.os.Build.VERSION.SDK_INT} density=$density viewportDp=${widthDp}x$heightDp")
            appendLine("canvas=$canvas")
            appendLine("imageContent=$imageContent")
            appendLine("composer=$composer")
            appendLine("toolRail=$toolRail")
            appendLine("versionPill=$versionPill")
            lineage.forEach { (direction, bounds) -> appendLine("lineage.$direction=$bounds") }
        }
        writeArtifact("real-overlay-bounds.txt", editorBounds)
        captureScreenshot("real-overlay-editor.png")

        assertTrue("Focused canvas must have nonzero visible bounds: $canvas", canvas.width > 0f && canvas.height > 0f)
        lineage.forEach { (direction, bounds) ->
            assertDisjoint("lineage $direction and compact composer", bounds, composer)
            assertDisjoint("lineage $direction and tool rail", bounds, toolRail)
            val outsideImageContent = !bounds.overlaps(imageContent)
            val clearOfEditorRails = !bounds.overlaps(composer) && !bounds.overlaps(toolRail)
            assertTrue("lineage $direction must be outside image content or clear of editor rails: $bounds", outsideImageContent || clearOfEditorRails)
        }
        assertDisjoint("compact composer and version pill", composer, versionPill)
        assertDisjoint("compact composer and lineage down", composer, lineage.getValue("down"))
        assertDisjoint("version pill and lineage down", versionPill, lineage.getValue("down"))

        composeRule.onNodeWithContentDescription("Open history").performClick()
        composeRule.waitForIdle()
        val historyPanel = boundsForDescription("History browser")
        val historyClose = boundsForDescription("Close history")
        val selectedRow = boundsForDescription("v3 Edit history item, focused prompt")
        assertContains("history panel contains close control", historyPanel, historyClose)
        assertContains("history panel contains selected row", historyPanel, selectedRow)
        assertDisjoint("history close and selected row", historyClose, selectedRow)
        composeRule.onNodeWithContentDescription("v3 Edit history item, focused prompt").assertHasClickAction().performClick()
        captureScreenshot("real-overlay-history.png")
        writeArtifact(
            "real-overlay-bounds.txt",
            editorBounds + "historyPanel=$historyPanel\nhistoryClose=$historyClose\nhistorySelectedRow=$selectedRow\n",
        )
        composeRule.onNodeWithContentDescription("Close history").assertHasClickAction().performClick()
        composeRule.onNodeWithContentDescription("History browser").assertDoesNotExist()
    }

    @Test
    fun manifest_whenOpenAiGenerationIsEnabled_requestsOnlyNetworkPermission() {
        val packageManager = composeRule.activity.packageManager
        val packageName = composeRule.activity.packageName

        val packageInfo = packageManager.getPackageInfo(packageName, PackageManager.GET_PERMISSIONS)
        val requestedPermissions = packageInfo.requestedPermissions?.toSet().orEmpty()

        assertTrue(requestedPermissions.contains(Manifest.permission.INTERNET))
        assertFalse(requestedPermissions.contains(Manifest.permission.READ_MEDIA_IMAGES))
        assertFalse(requestedPermissions.contains(Manifest.permission.READ_EXTERNAL_STORAGE))
        assertFalse(requestedPermissions.contains(Manifest.permission.WRITE_EXTERNAL_STORAGE))
        assertFalse(requestedPermissions.contains("app.bananatape.mobile.permission.PROVIDER"))
    }

    @Test
    fun manifest_whenImageShareOrOpenIsRequested_resolvesBananaTapeActivity() {
        val packageManager = composeRule.activity.packageManager
        val packageName = composeRule.activity.packageName

        val sendPng = Intent(Intent.ACTION_SEND).setType("image/png").setPackage(packageName)
        val sendJpeg = Intent(Intent.ACTION_SEND).setType("image/jpeg").setPackage(packageName)
        val viewPng = Intent(Intent.ACTION_VIEW).setType("image/png").setPackage(packageName)

        assertActivityResolves(packageManager, sendPng)
        assertActivityResolves(packageManager, sendJpeg)
        assertActivityResolves(packageManager, viewPng)
    }

    @Test
    fun inboundImageIntent_importsSharedImageThroughProjectSessionFlow() {
        val sharedUri = Uri.parse("content://app.bananatape.mobile.test/shared.png")
        val intent = Intent(Intent.ACTION_SEND)
            .setType("image/png")
            .putExtra(Intent.EXTRA_STREAM, sharedUri)
        val storage = LocalProjectStorage(composeRule.activity.filesDir.toPath().resolve("inbound-test-projects"))
        var importedUri: Uri? = null

        val handled = composeRule.activity.consumeInboundImageIntent(intent, storage) { uri, _ ->
            importedUri = uri
            AdapterResult.Success(Unit)
        }

        assertTrue(handled)
        assertEquals(sharedUri, importedUri)
    }

    private fun assertActivityResolves(packageManager: PackageManager, intent: Intent) {
        val resolved = packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
        assertFalse(resolved.isEmpty())
    }

    private fun createProject(name: String) {
        composeRule.onNodeWithText("New Project").performClick()
        composeRule.onNode(hasSetTextAction()).performTextInput(name)
        composeRule.onNodeWithText("Create").performClick()
        composeRule.onNodeWithContentDescription("Open $name").assertIsDisplayed()
    }

    private fun createFocusedProject(name: String) {
        val id = "focused-composer"
        val manifest = """{"schemaVersion":1,"id":"$id","name":"$name","createdAt":"1970-01-01T00:00:00.000Z","updatedAt":"1970-01-01T00:00:00.000Z","settings":{"systemPrompt":"","referenceImages":[]}}"""
        val history = """{"schemaVersion":1,"revision":1,"entries":[{"id":"focused-image","type":"generate","provider":"mock","prompt":"focused prompt","assetId":"asset-focused","assetPath":"assets/focused.png","parentId":null,"createdAt":"1970-01-01T00:00:00.000Z","timestamp":1,"generationBatchId":"batch-focused","batchIndex":0}]}"""
        val canvas = """{"schemaVersion":1,"settings":{},"canvas":{"images":{"focused-image":{"id":"focused-image","url":"assets/focused.png","assetId":"asset-focused","size":{"width":1,"height":1},"position":{"x":0,"y":0},"parentId":null,"generationIndex":0,"prompt":"focused prompt","provider":"mock","type":"generate","createdAt":1,"generationBatchId":"batch-focused","batchIndex":0,"paths":[],"boxes":[],"memos":[]}},"imageOrder":["focused-image"],"focusedImageIds":["focused-image"]}}"""
        val storage = LocalProjectStorage(composeRule.activity.filesDir.toPath().resolve("projects"))
        assertEquals(AdapterResult.Success(MobileProjectRecord(id, name, manifest, history, canvas)), storage.create(MobileProjectRecord(id, name, manifest, history, canvas)))
        composeRule.activityRule.scenario.recreate()
        composeRule.waitForIdle()
    }

    private fun createOverlayProject(name: String) {
        val id = "overlay-geometry"
        val imageIds = listOf("root", "left", "focused", "right", "child")
        val parentIds = mapOf("root" to null, "left" to "root", "focused" to "root", "right" to "root", "child" to "focused")
        val batches = mapOf("root" to "root-batch", "left" to "sibling-batch", "focused" to "sibling-batch", "right" to "sibling-batch", "child" to "child-batch")
        val batchIndexes = mapOf("root" to 0, "left" to 0, "focused" to 1, "right" to 2, "child" to 0)
        val manifest = """{"schemaVersion":1,"id":"$id","name":"$name","createdAt":"1970-01-01T00:00:00.000Z","updatedAt":"1970-01-01T00:00:00.000Z","settings":{"systemPrompt":"","referenceImages":[]}}"""
        val historyEntries = imageIds.mapIndexed { index, imageId ->
            """{"id":"$imageId","type":"${if (imageId == "root") "generate" else "edit"}","provider":"mock","prompt":"$imageId prompt","assetId":"asset-$imageId","assetPath":"assets/$imageId.png","parentId":${parentIds.getValue(imageId)?.let { "\"$it\"" } ?: "null"},"createdAt":"1970-01-01T00:0$index:00.000Z","timestamp":${index + 1},"generationBatchId":"${batches.getValue(imageId)}","batchIndex":${batchIndexes.getValue(imageId)}}"""
        }.joinToString(",")
        val canvasImages = imageIds.joinToString(",") { imageId ->
            """"$imageId":{"id":"$imageId","url":"assets/$imageId.png","assetId":"asset-$imageId","size":{"width":304,"height":390},"position":{"x":0,"y":0},"parentId":${parentIds.getValue(imageId)?.let { "\"$it\"" } ?: "null"},"generationIndex":${batchIndexes.getValue(imageId)},"prompt":"$imageId prompt","provider":"mock","type":"${if (imageId == "root") "generate" else "edit"}","createdAt":${imageIds.indexOf(imageId) + 1},"generationBatchId":"${batches.getValue(imageId)}","batchIndex":${batchIndexes.getValue(imageId)},"paths":[],"boxes":[],"memos":[]}"""
        }
        val history = """{"schemaVersion":1,"revision":1,"entries":[$historyEntries]}"""
        val canvas = """{"schemaVersion":1,"settings":{},"canvas":{"images":{$canvasImages},"imageOrder":[${imageIds.joinToString(",") { "\"$it\"" }}],"focusedImageIds":["focused"]}}"""
        val storage = LocalProjectStorage(composeRule.activity.filesDir.toPath().resolve("projects"))
        assertEquals(AdapterResult.Success(MobileProjectRecord(id, name, manifest, history, canvas)), storage.create(MobileProjectRecord(id, name, manifest, history, canvas)))
        imageIds.forEachIndexed { index, imageId ->
            val bitmap = Bitmap.createBitmap(304, 390, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.rgb(28 + index * 16, 54, 82)) }
            storage.filePath(id, "assets/$imageId.png").toFile().outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
        }
        composeRule.activityRule.scenario.recreate()
        composeRule.waitForIdle()
    }

    private fun boundsForTag(tag: String): Rect = composeRule.onNodeWithTag(tag).assertIsDisplayed().fetchSemanticsNode().boundsInRoot

    private fun boundsForDescription(description: String): Rect = composeRule.onNodeWithContentDescription(description).assertIsDisplayed().fetchSemanticsNode().boundsInRoot

    private fun assertDisjoint(label: String, first: Rect, second: Rect) {
        assertTrue("$label overlap incoherently: $first vs $second", !first.overlaps(second))
    }

    private fun assertContains(label: String, container: Rect, content: Rect) {
        assertTrue(
            "$label: $container does not contain $content",
            content.left >= container.left && content.top >= container.top && content.right <= container.right && content.bottom <= container.bottom,
        )
    }

    private fun writeArtifact(name: String, contents: String) {
        artifactFile(name).writeText(contents)
    }

    private fun captureScreenshot(name: String) {
        val screenshot = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
        artifactFile(name).outputStream().use { screenshot.compress(Bitmap.CompressFormat.PNG, 100, it) }
        screenshot.recycle()
    }

    private fun artifactFile(name: String): File = File(composeRule.activity.getExternalFilesDir(null), name)
}
