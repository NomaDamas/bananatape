package app.bananatape.mobile

import android.accessibilityservice.AccessibilityService
import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.provider.MediaStore
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.storage.LocalProjectStorage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.json.JSONObject
import kotlin.math.abs

@RunWith(AndroidJUnit4::class)
class MainActivityTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    private val fixture by lazy { EditorOverlayTestFixture(composeRule) }

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
    fun newProjectDialog_whenOpened_exposesReadableTitleAndFocusedNameField() {
        composeRule.onNodeWithText("New Project").performClick()

        composeRule.onNodeWithTag("new-project-dialog-title").assertIsDisplayed()
        composeRule.onNodeWithText("Project name", useUnmergedTree = true).assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Project name input").assertIsDisplayed()
        composeRule.onNodeWithTag("new-project-name")
            .assertIsDisplayed()
            .performClick()
            .assertIsFocused()
            .performTextInput("Readable Project")
        composeRule.onNodeWithTag("new-project-name").assertTextContains("Readable Project")

        composeRule.onNodeWithText("Create").performClick()
        composeRule.onNodeWithContentDescription("Open Readable Project").assertIsDisplayed()
    }

    @Test
    fun basePhotoPicker_whenSelectionReturns_importsImageIntoProjectAndEditorState() {
        assertPhotoPickerContract()
        val selectedUri = createPickerImage("selected-base.png")

        composeRule.onNodeWithText("Import").performClick()
        waitForExternalPicker()
        assertTrue(dispatchPickerResult(selectedUri))
        returnFromExternalPicker()

        composeRule.onNodeWithContentDescription("Back to projects").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Native annotation canvas").assertIsDisplayed()

        val storage = LocalProjectStorage(composeRule.activity.filesDir.toPath().resolve("projects"))
        val imported = storage.list().single { it.name == "Imported Image" }
        val record = (storage.read(imported.id) as AdapterResult.Success).value
        val assetPath = JSONObject(record.historyJson)
            .getJSONArray("entries")
            .getJSONObject(0)
            .getString("assetPath")
        assertTrue(storage.filePath(imported.id, assetPath).toFile().exists())
    }

    @Test
    fun referencePhotoPicker_whenSelectionReturns_persistsCopiedImageAndReferenceState() {
        createProject("Photo Picker Reference")
        composeRule.onNodeWithContentDescription("Open Photo Picker Reference").performClick()
        composeRule.onNodeWithContentDescription("Project menu").performClick()
        composeRule.onNodeWithContentDescription("Reference images").performClick()

        assertPhotoPickerContract()
        val selectedUri = createPickerImage("selected-reference.png")
        composeRule.onNodeWithContentDescription("Add reference").performClick()
        waitForExternalPicker()
        assertTrue(dispatchPickerResult(selectedUri))
        returnFromExternalPicker()
        waitForAppWindow()

        composeRule.onNodeWithText("1 references").assertIsDisplayed()

        val storage = LocalProjectStorage(composeRule.activity.filesDir.toPath().resolve("projects"))
        val record = (storage.read("photo-picker-reference") as AdapterResult.Success).value
        val persistedReferences = JSONObject(record.manifestJson)
            .getJSONObject("settings")
            .getJSONArray("referenceImages")
        assertEquals(1, persistedReferences.length())
        val persistedReference = persistedReferences.getJSONObject(0)
        val label = persistedReference.getString("label")
        val assetPath = persistedReference.getString("assetPath")
        assertEquals(assetPath.substringAfterLast('/'), label)
        assertTrue(assetPath.startsWith("references/"))
        val persistedAsset = storage.filePath("photo-picker-reference", assetPath).toFile()
        assertTrue(persistedAsset.exists())

        val referenceDescription = "Reference image $label"
        composeRule.onNodeWithContentDescription(referenceDescription).assertIsDisplayed()
        val attachedBounds = fixture.boundsForDescription(referenceDescription)
        fixture.captureScreenshot("reference-sheet-attached.png")
        val attachedPixel = fixture.sampleScreenshotPixel(referenceDescription)
        fixture.writeArtifact("reference-attached-observation.txt", "bounds=$attachedBounds\npixel=${pixelDescription(attachedPixel)}\n")
        assertMatchesPickerFixtureColor("attached", attachedPixel)

        composeRule.activityRule.scenario.recreate()
        composeRule.waitForIdle()
        composeRule.onNodeWithContentDescription("Open Photo Picker Reference").performClick()
        composeRule.onNodeWithContentDescription("Project menu").performClick()
        composeRule.onNodeWithContentDescription("Reference images").performClick()
        composeRule.onNodeWithContentDescription(referenceDescription).assertIsDisplayed()
        waitForAppWindow()
        val reopenedBounds = fixture.boundsForDescription(referenceDescription)
        fixture.captureScreenshot("reference-sheet-reopened.png")
        val reopenedPixel = fixture.sampleScreenshotPixel(referenceDescription)
        assertMatchesPickerFixtureColor("reopened", reopenedPixel)
        fixture.writeArtifact(
            "reference-asset-state.txt",
            buildString {
                appendLine("projectId=photo-picker-reference")
                appendLine("projectRoot=${storage.filePath("photo-picker-reference", "").toAbsolutePath().normalize()}")
                appendLine("assetPath=$assetPath")
                appendLine("resolvedPath=${persistedAsset.toPath().toAbsolutePath().normalize()}")
                appendLine("exists=${persistedAsset.exists()}")
                appendLine("byteCount=${persistedAsset.length()}")
                appendLine("attachedBounds=$attachedBounds")
                appendLine("attachedPixel=${pixelDescription(attachedPixel)}")
                appendLine("reopenedBounds=$reopenedBounds")
                appendLine("reopenedPixel=${pixelDescription(reopenedPixel)}")
            },
        )
    }

    @Test
    fun annotationToolbar_whenEditorLaunches_isHorizontalAboveCanvasAndKeepsEveryToolReachable() {
        fixture.seedFocusedProject("Toolbar Layout")
        composeRule.onNodeWithContentDescription("Open Toolbar Layout").performClick()

        val canvas = fixture.boundsForDescription("Native annotation canvas")
        val toolbar = fixture.boundsForTag("editor.tool-rail")
        val density = composeRule.activity.resources.displayMetrics.density
        val minTargetPx = 48f * density
        val rootWidth = composeRule.activity.resources.displayMetrics.widthPixels.toFloat()
        val rootHeight = composeRule.activity.resources.displayMetrics.heightPixels.toFloat()
        assertTrue("Annotation toolbar must be wider than tall: $toolbar", toolbar.width > toolbar.height)
        assertTrue("Annotation toolbar must sit above canvas: $toolbar vs $canvas", toolbar.bottom <= canvas.top)
        val toolControls = (listOf("Pan", "Select", "Pen", "Box", "Arrow", "Memo") + listOf("Undo", "Redo"))
            .associateWith { label -> fixture.boundsForDescription(label) }
        toolControls.forEach { (label, bounds) ->
            assertTrue("$label width must be at least 48dp: $bounds", bounds.width >= minTargetPx)
            assertTrue("$label height must be at least 48dp: $bounds", bounds.height >= minTargetPx)
            assertTrue("$label must be fully inside the root: $bounds", bounds.left >= 0f && bounds.top >= 0f && bounds.right <= rootWidth && bounds.bottom <= rootHeight)
        }
        toolControls.values.toList().forEachIndexed { index, first ->
            toolControls.values.toList().drop(index + 1).forEach { second -> fixture.assertDisjoint("tool targets", first, second) }
        }
        listOf("Pan", "Select", "Pen", "Box", "Arrow", "Memo").forEach { label ->
            composeRule.onNodeWithContentDescription(label).assertHasClickAction().assertIsDisplayed()
        }
        listOf("Undo", "Redo").forEach { label ->
            composeRule.onNodeWithContentDescription(label).assertIsDisplayed()
        }
    }

    @Test
    fun accessibilitySemantics_whenEditorLaunches_exposesRequiredControlLabels() {
        fixture.seedFocusedProject("Accessibility Test")

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
        fixture.seedFocusedProject("Focused Composer")

        composeRule.onNodeWithContentDescription("Open Focused Composer").performClick()
        composeRule.onNodeWithContentDescription("Expand composer").performClick()

        composeRule.onAllNodesWithText("Apply edit", useUnmergedTree = true).assertCountEquals(3)
        composeRule.onNodeWithContentDescription("New Generation").assertHasClickAction().performClick()
        composeRule.onAllNodesWithText("Generate", useUnmergedTree = true).assertCountEquals(3)
    }

    @Test
    fun editorOverlays_onPixel7Portrait_preserveUsableBounds() {
        fixture.seedOverlayProject("Overlay Geometry")

        composeRule.onNodeWithContentDescription("Open Overlay Geometry").performClick()
        composeRule.waitForIdle()

        val density = composeRule.activity.resources.displayMetrics.density
        val widthDp = composeRule.activity.resources.displayMetrics.widthPixels / density
        val heightDp = composeRule.activity.resources.displayMetrics.heightPixels / density
        assertTrue("Expected Pixel 7 portrait width, was ${widthDp}dp", widthDp in 400f..420f)
        assertTrue("Expected portrait display, was ${widthDp}x${heightDp}dp", heightDp > widthDp)

        val canvas = fixture.boundsForDescription("Focused image focused")
        val imageContent = fixture.boundsForDescription("Native annotation canvas")
        val composer = fixture.boundsForDescription("Native bottom composer")
        val toolRail = fixture.boundsForTag("editor.tool-rail")
        val versionPill = fixture.boundsForDescription("Open history")
        val lineage = mapOf(
            "left" to fixture.boundsForDescription("Lineage left: previous batch sibling"),
            "right" to fixture.boundsForDescription("Lineage right: next batch sibling"),
            "up" to fixture.boundsForDescription("Lineage up: parent image"),
            "down" to fixture.boundsForDescription("Lineage down: first direct child batch"),
        )
        val minTargetPx = 48f * density
        val rootWidth = composeRule.activity.resources.displayMetrics.widthPixels.toFloat()
        val rootHeight = composeRule.activity.resources.displayMetrics.heightPixels.toFloat()
        lineage.forEach { (direction, bounds) ->
            assertTrue("lineage $direction width must be at least 48dp: $bounds", bounds.width >= minTargetPx)
            assertTrue("lineage $direction height must be at least 48dp: $bounds", bounds.height >= minTargetPx)
            assertTrue("lineage $direction must be fully inside the root: $bounds", bounds.left >= 0f && bounds.top >= 0f && bounds.right <= rootWidth && bounds.bottom <= rootHeight)
        }
        val editorBounds = buildString {
            appendLine("device=${android.os.Build.MODEL} sdk=${android.os.Build.VERSION.SDK_INT} density=$density viewportDp=${widthDp}x$heightDp")
            appendLine("canvas=$canvas")
            appendLine("imageContent=$imageContent")
            appendLine("composer=$composer")
            appendLine("toolRail=$toolRail")
            appendLine("versionPill=$versionPill")
            lineage.forEach { (direction, bounds) -> appendLine("lineage.$direction=$bounds") }
        }
        fixture.writeArtifact("real-overlay-bounds.txt", editorBounds)
        fixture.captureScreenshot("real-overlay-editor.png")

        assertTrue("Focused canvas must have nonzero visible bounds: $canvas", canvas.width > 0f && canvas.height > 0f)
        lineage.forEach { (direction, bounds) ->
            fixture.assertDisjoint("lineage $direction and compact composer", bounds, composer)
            fixture.assertDisjoint("lineage $direction and tool rail", bounds, toolRail)
        }
        fixture.assertDisjoint("compact composer and version pill", composer, versionPill)
        fixture.assertDisjoint("compact composer and lineage down", composer, lineage.getValue("down"))
        fixture.assertDisjoint("version pill and lineage down", versionPill, lineage.getValue("down"))

        composeRule.onNodeWithContentDescription("Open history").performClick()
        composeRule.waitForIdle()
        val historyPanel = fixture.boundsForDescription("History browser")
        val historyClose = fixture.boundsForDescription("Close history")
        val selectedRow = fixture.boundsForDescription("v3 Edit history item, focused prompt")
        fixture.assertContains("history panel contains close control", historyPanel, historyClose)
        fixture.assertContains("history panel contains selected row", historyPanel, selectedRow)
        fixture.assertDisjoint("history close and selected row", historyClose, selectedRow)
        composeRule.onNodeWithContentDescription("v3 Edit history item, focused prompt").assertHasClickAction().performClick()
        fixture.captureScreenshot("real-overlay-history.png")
        fixture.writeArtifact(
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

    private fun assertPhotoPickerContract() {
        val intent = ActivityResultContracts.PickVisualMedia().createIntent(
            composeRule.activity,
            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
        )
        assertPhotoPickerIntent(intent)
    }

    private fun assertPhotoPickerIntent(intent: Intent) {
        assertTrue(
            "Expected selected-access photo picker intent, got ${intent.action}",
            intent.action == MediaStore.ACTION_PICK_IMAGES ||
                intent.action == ActivityResultContracts.PickVisualMedia.ACTION_SYSTEM_FALLBACK_PICK_IMAGES ||
                intent.action == Intent.ACTION_OPEN_DOCUMENT,
        )
        assertFalse("Legacy GET_CONTENT must not be used", intent.action == Intent.ACTION_GET_CONTENT)
        assertEquals("image/*", intent.type)
    }

    @Suppress("UNCHECKED_CAST")
    private fun dispatchPickerResult(uri: Uri): Boolean {
        val registry = composeRule.activity.activityResultRegistry
        val registryType = androidx.activity.result.ActivityResultRegistry::class.java
        val launchedKeysField = registryType.getDeclaredField("launchedKeys").apply { isAccessible = true }
        val keyToRcField = registryType.getDeclaredField("keyToRc").apply { isAccessible = true }
        val launchedKeys = launchedKeysField.get(registry) as List<String>
        val keyToRc = keyToRcField.get(registry) as Map<String, Int>
        val requestCode = keyToRc[launchedKeys.lastOrNull()] ?: return false
        return registry.dispatchResult(requestCode, Activity.RESULT_OK, Intent().setData(uri))
    }

    private fun waitForExternalPicker() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        composeRule.waitUntil(timeoutMillis = 5_000) {
            val activePackage = instrumentation.uiAutomation.rootInActiveWindow?.packageName
            activePackage != null &&
                activePackage != composeRule.activity.packageName
        }
    }

    private fun returnFromExternalPicker() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        if (instrumentation.uiAutomation.rootInActiveWindow?.packageName != composeRule.activity.packageName) {
            assertTrue(instrumentation.uiAutomation.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK))
        }
        instrumentation.waitForIdleSync()
        composeRule.waitUntil(timeoutMillis = 5_000) {
            instrumentation.uiAutomation.rootInActiveWindow?.packageName == composeRule.activity.packageName
        }
        composeRule.waitForIdle()
    }

    private fun waitForAppWindow() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        composeRule.waitUntil(timeoutMillis = 10_000) {
            instrumentation.uiAutomation.rootInActiveWindow?.packageName == composeRule.activity.packageName
        }
        composeRule.waitForIdle()
    }

    private fun createPickerImage(name: String): Uri {
        val shareDirectory = composeRule.activity.cacheDir.resolve("BananaTapeShare").apply { mkdirs() }
        val imageFile = shareDirectory.resolve(name)
        val bitmap = Bitmap.createBitmap(8, 8, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.rgb(36, 108, 166)) }
        imageFile.outputStream().use { output -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, output) }
        bitmap.recycle()
        return FileProvider.getUriForFile(composeRule.activity, "app.bananatape.mobile.share", imageFile)
    }

    private fun createProject(name: String) {
        composeRule.onNodeWithText("New Project").performClick()
        composeRule.onNode(hasSetTextAction()).performTextInput(name)
        composeRule.onNodeWithText("Create").performClick()
        composeRule.onNodeWithContentDescription("Open $name").assertIsDisplayed()
    }

    private fun assertMatchesPickerFixtureColor(stage: String, pixel: Int) {
        val expected = Color.rgb(36, 108, 166)
        assertTrue(
            "$stage reference thumbnail pixel must match the persisted picker fixture: ${pixelDescription(pixel)}",
            abs(Color.red(pixel) - Color.red(expected)) <= 12 &&
                abs(Color.green(pixel) - Color.green(expected)) <= 12 &&
                abs(Color.blue(pixel) - Color.blue(expected)) <= 12,
        )
    }

    private fun pixelDescription(pixel: Int): String =
        "#%02x%02x%02x".format(Color.red(pixel), Color.green(pixel), Color.blue(pixel))

}
