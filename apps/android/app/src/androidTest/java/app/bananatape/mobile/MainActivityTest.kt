package app.bananatape.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.bananatape.mobile.adapters.AdapterResult
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
        composeRule.onNodeWithContentDescription("Native canvas").assertIsDisplayed()
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
}
