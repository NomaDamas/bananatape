package app.bananatape.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
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
        createProject("Accessibility Test")

        composeRule.onNodeWithContentDescription("BananaTape project list").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Open Accessibility Test").assertHasClickAction().performClick()
        composeRule.onNodeWithContentDescription("Back to projects").assertHasClickAction().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Project menu").assertHasClickAction().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Pan").assertHasClickAction().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Focused image empty").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Lineage left: previous batch sibling").assertIsNotEnabled().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Lineage right: next batch sibling").assertIsNotEnabled().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Lineage up: parent image").assertIsNotEnabled().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Lineage down: first direct child batch").assertIsNotEnabled().assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Native bottom composer").assertIsDisplayed()
        composeRule.onNodeWithText("Generate").assertIsNotEnabled()
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

        composeRule.onAllNodesWithText("Apply edit").assertCountEquals(2)
        composeRule.onNodeWithContentDescription("New Generation").assertHasClickAction().performClick()
        composeRule.onAllNodesWithText("Generate").assertCountEquals(2)
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
}
