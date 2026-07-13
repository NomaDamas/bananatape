package app.bananatape.mobile

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeCanvasViewTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    private val fixture by lazy { EditorOverlayTestFixture(composeRule) }

    @Test
    fun memoEditing_whenAuthoritativeAnnotationsRemoveMemo_disappearsAfterUndo() {
        fixture.seedFocusedProject("Memo Undo")
        composeRule.onNodeWithContentDescription("Open Memo Undo").performClick()
        composeRule.onNodeWithContentDescription("Memo").performClick()

        composeRule.onNodeWithContentDescription("Native annotation canvas")
            .performTouchInput { click(Offset(160f, 160f)) }

        val memo = composeRule.onNode(hasContentDescription("Sticky memo", substring = true))
        memo.assertIsDisplayed().performTextInput("Draft memo")
        composeRule.onNodeWithText("Draft memo").assertIsDisplayed()

        composeRule.onNodeWithContentDescription("Undo").performClick()
        composeRule.onNodeWithContentDescription("Undo").performClick()

        composeRule.onNode(hasContentDescription("Sticky memo", substring = true)).assertDoesNotExist()

        composeRule.onNodeWithContentDescription("Redo").performClick()
        composeRule.onNodeWithContentDescription("Redo").performClick()
        composeRule.onNodeWithText("Draft memo").assertIsDisplayed()
        composeRule.onNode(hasContentDescription("Sticky memo", substring = true).and(hasSetTextAction())).assertDoesNotExist()
    }
}
