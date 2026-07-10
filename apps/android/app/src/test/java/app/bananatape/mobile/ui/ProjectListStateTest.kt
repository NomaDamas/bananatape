package app.bananatape.mobile.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class ProjectListStateTest {
    @Test
    fun emptyMessage_whenNoProjects_returnsNoProjectsYet() {
        val state = ProjectListState(projects = emptyList())

        val message = state.emptyMessage

        assertEquals("No projects yet", message)
    }

    @Test
    fun emptyMessage_whenProjectsExist_returnsProjectsLabel() {
        val state = ProjectListState(projects = listOf(ProjectListItem(id = "mobile-smoke-project", name = "Mobile Smoke")))

        val message = state.emptyMessage

        assertEquals("Projects", message)
    }
}
