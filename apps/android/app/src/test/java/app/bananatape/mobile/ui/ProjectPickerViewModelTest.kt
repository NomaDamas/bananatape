package app.bananatape.mobile.ui

import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.storage.LocalProjectStorage
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ProjectPickerViewModelTest {
    @Test
    fun projectPicker_whenCreateOpenAndDelete_updatesLocalProjectState() {
        val viewModel = ProjectPickerViewModel(
            storage = LocalProjectStorage(Files.createTempDirectory("bananatape-picker")),
            nowIso = { "1970-01-01T00:00:00.000Z" },
        )

        viewModel.createProject("Mobile Smoke Project")
        viewModel.openProject("mobile-smoke-project")
        viewModel.deleteProject("mobile-smoke-project")

        assertEquals(emptyList<ProjectListItem>(), viewModel.state.projects)
        assertEquals("mobile-smoke-project", viewModel.state.openedProject?.id)
        assertNull(viewModel.state.lastError)
    }

    @Test
    fun projectPicker_whenProjectNameContainsJsonSpecialCharacters_createsReadableProject() {
        val root = Files.createTempDirectory("bananatape-picker")
        val storage = LocalProjectStorage(root)
        val viewModel = ProjectPickerViewModel(
            storage = storage,
            nowIso = { "1970-01-01T00:00:00.000Z" },
        )
        val projectName = "Quote \" Banana \\ Project\nLine"

        viewModel.createProject(projectName)
        viewModel.openProject("quote-banana-project-line")
        val restartedProject = LocalProjectStorage(root).read("quote-banana-project-line")

        assertNull(viewModel.state.lastError)
        assertEquals(projectName, viewModel.state.openedProject?.name)
        assertEquals(projectName, (restartedProject as AdapterResult.Success).value.name)
        assertEquals(listOf(ProjectListItem(id = "quote-banana-project-line", name = projectName)), viewModel.state.projects)
    }
}
