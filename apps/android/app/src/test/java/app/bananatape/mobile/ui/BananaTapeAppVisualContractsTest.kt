package app.bananatape.mobile.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.nio.file.Paths

class BananaTapeAppVisualContractsTest {
    @Test
    fun referenceAssetPath_resolvesProjectRelativeAssetAgainstProjectRoot() {
        val projectRoot = Paths.get("/tmp/bananatape/projects/photo-picker-reference")

        assertEquals(
            projectRoot.resolve("references/selected-reference.png").normalize(),
            resolveReferenceAssetPath(projectRoot.toString(), "references/selected-reference.png"),
        )
    }

    @Test
    fun referenceAssetPath_rejectsAbsoluteAndEscapingPaths() {
        val projectRoot = Paths.get("/tmp/bananatape/projects/photo-picker-reference")

        assertNull(resolveReferenceAssetPath(projectRoot.toString(), "/tmp/other-project/reference.png"))
        assertNull(resolveReferenceAssetPath(projectRoot.toString(), "../other-project/reference.png"))
    }

    @Test
    fun annotationControls_useTheMinimumFingerTarget() {
        assertEquals(48, AnnotationControlMinSizeDp)
    }
}
