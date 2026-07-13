package app.bananatape.mobile

import android.graphics.Bitmap
import android.graphics.Color
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.AndroidComposeTestRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.platform.app.InstrumentationRegistry
import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.adapters.MobileProjectRecord
import app.bananatape.mobile.storage.LocalProjectStorage
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import java.io.File

internal class EditorOverlayTestFixture(
    private val composeRule: AndroidComposeTestRule<ActivityScenarioRule<MainActivity>, MainActivity>,
) {
    fun seedFocusedProject(name: String) {
        seedProject(
            id = "focused-composer",
            name = name,
            images = listOf(
                FixtureImage(
                    id = "focused-image",
                    parentId = null,
                    batchId = "batch-focused",
                    batchIndex = 0,
                    type = "generate",
                    width = 1,
                    height = 1,
                ),
            ),
            focusedImageId = "focused-image",
            writeAssets = false,
        )
    }

    fun seedOverlayProject(name: String) {
        seedProject(
            id = "overlay-geometry",
            name = name,
            images = listOf(
                FixtureImage("root", null, "root-batch", 0, "generate"),
                FixtureImage("left", "root", "sibling-batch", 0, "edit"),
                FixtureImage("focused", "root", "sibling-batch", 1, "edit"),
                FixtureImage("right", "root", "sibling-batch", 2, "edit"),
                FixtureImage("child", "focused", "child-batch", 0, "edit"),
            ),
            focusedImageId = "focused",
            writeAssets = true,
        )
    }

    fun boundsForTag(tag: String): Rect =
        composeRule.onNodeWithTag(tag).assertIsDisplayed().fetchSemanticsNode().boundsInRoot

    fun boundsForDescription(description: String): Rect =
        composeRule.onNodeWithContentDescription(description).assertIsDisplayed().fetchSemanticsNode().boundsInRoot

    fun assertDisjoint(label: String, first: Rect, second: Rect) {
        assertTrue("$label overlap incoherently: $first vs $second", !first.overlaps(second))
    }

    fun assertContains(label: String, container: Rect, content: Rect) {
        assertTrue(
            "$label: $container does not contain $content",
            content.left >= container.left && content.top >= container.top &&
                content.right <= container.right && content.bottom <= container.bottom,
        )
    }

    fun writeArtifact(name: String, contents: String) {
        artifactFile(name).writeText(contents)
    }

    fun captureScreenshot(name: String) {
        composeRule.waitForIdle()
        val transitionFrame = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
        transitionFrame.recycle()
        val screenshot = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
        artifactFile(name).outputStream().use { screenshot.compress(Bitmap.CompressFormat.PNG, 100, it) }
        screenshot.recycle()
    }

    fun sampleScreenshotPixel(description: String): Int {
        val bounds = boundsForDescription(description)
        val screenshot = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
        return try {
            val x = ((bounds.left + bounds.right) / 2f).toInt().coerceIn(0, screenshot.width - 1)
            val y = (bounds.top + bounds.height * 0.32f).toInt().coerceIn(0, screenshot.height - 1)
            screenshot.getPixel(x, y)
        } finally {
            screenshot.recycle()
        }
    }

    private fun seedProject(
        id: String,
        name: String,
        images: List<FixtureImage>,
        focusedImageId: String,
        writeAssets: Boolean,
    ) {
        val record = MobileProjectRecord(
            id = id,
            name = name,
            manifestJson = manifestJson(id, name).toString(),
            historyJson = historyJson(images).toString(),
            canvasJson = canvasJson(images, focusedImageId).toString(),
        )
        val storage = LocalProjectStorage(composeRule.activity.filesDir.toPath().resolve("projects"))
        assertEquals(AdapterResult.Success(record), storage.create(record))
        if (writeAssets) writeAssets(storage, id, images)
        composeRule.activityRule.scenario.recreate()
        composeRule.waitForIdle()
    }

    private fun manifestJson(id: String, name: String) = JSONObject()
        .put("schemaVersion", 1)
        .put("id", id)
        .put("name", name)
        .put("createdAt", Epoch)
        .put("updatedAt", Epoch)
        .put(
            "settings",
            JSONObject()
                .put("systemPrompt", "")
                .put("referenceImages", JSONArray()),
        )

    private fun historyJson(images: List<FixtureImage>) = JSONObject()
        .put("schemaVersion", 1)
        .put("revision", 1)
        .put(
            "entries",
            JSONArray().apply {
                images.forEachIndexed { index, image -> put(historyEntryJson(image, index)) }
            },
        )

    private fun historyEntryJson(image: FixtureImage, index: Int) = JSONObject()
        .put("id", image.id)
        .put("type", image.type)
        .put("provider", "mock")
        .put("prompt", "${image.id} prompt")
        .put("assetId", "asset-${image.id}")
        .put("assetPath", "assets/${image.id}.png")
        .put("parentId", image.parentId ?: JSONObject.NULL)
        .put("createdAt", "1970-01-01T00:0$index:00.000Z")
        .put("timestamp", index + 1)
        .put("generationBatchId", image.batchId)
        .put("batchIndex", image.batchIndex)

    private fun canvasJson(images: List<FixtureImage>, focusedImageId: String) = JSONObject()
        .put("schemaVersion", 1)
        .put("settings", JSONObject())
        .put(
            "canvas",
            JSONObject()
                .put(
                    "images",
                    JSONObject().apply {
                        images.forEachIndexed { index, image -> put(image.id, canvasImageJson(image, index)) }
                    },
                )
                .put("imageOrder", JSONArray().apply { images.forEach { put(it.id) } })
                .put("focusedImageIds", JSONArray().put(focusedImageId)),
        )

    private fun canvasImageJson(image: FixtureImage, index: Int) = JSONObject()
        .put("id", image.id)
        .put("url", "assets/${image.id}.png")
        .put("assetId", "asset-${image.id}")
        .put("size", JSONObject().put("width", image.width).put("height", image.height))
        .put("position", JSONObject().put("x", 0).put("y", 0))
        .put("parentId", image.parentId ?: JSONObject.NULL)
        .put("generationIndex", image.batchIndex)
        .put("prompt", "${image.id} prompt")
        .put("provider", "mock")
        .put("type", image.type)
        .put("createdAt", index + 1)
        .put("generationBatchId", image.batchId)
        .put("batchIndex", image.batchIndex)
        .put("paths", JSONArray())
        .put("boxes", JSONArray())
        .put("memos", JSONArray())

    private fun writeAssets(storage: LocalProjectStorage, projectId: String, images: List<FixtureImage>) {
        images.forEachIndexed { index, image ->
            val bitmap = Bitmap.createBitmap(image.width, image.height, Bitmap.Config.ARGB_8888).apply {
                eraseColor(Color.rgb(28 + index * 16, 54, 82))
            }
            storage.filePath(projectId, "assets/${image.id}.png").toFile().outputStream().use {
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
            }
            bitmap.recycle()
        }
    }

    private fun artifactFile(name: String): File =
        File(requireNotNull(composeRule.activity.getExternalFilesDir(null)), name)

    private data class FixtureImage(
        val id: String,
        val parentId: String?,
        val batchId: String,
        val batchIndex: Int,
        val type: String,
        val width: Int = 304,
        val height: Int = 390,
    )

    private companion object {
        const val Epoch = "1970-01-01T00:00:00.000Z"
    }
}
