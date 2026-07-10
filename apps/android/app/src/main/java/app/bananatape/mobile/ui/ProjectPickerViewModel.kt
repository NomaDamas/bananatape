package app.bananatape.mobile.ui

import app.bananatape.mobile.adapters.AdapterError
import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.adapters.MobileProjectRecord
import app.bananatape.mobile.adapters.ProjectStorage

data class ProjectListItem(
    val id: String,
    val name: String,
)

data class ProjectPickerState(
    val projects: List<ProjectListItem> = emptyList(),
    val openedProject: MobileProjectRecord? = null,
    val lastError: AdapterError? = null,
) {
    val isEmpty: Boolean = projects.isEmpty()
}

class ProjectPickerViewModel(
    private val storage: ProjectStorage,
    private val nowIso: () -> String = { "1970-01-01T00:00:00.000Z" },
) {
    var state: ProjectPickerState = ProjectPickerState()
        private set

    init {
        refresh()
    }

    fun refresh() {
        state = state.copy(projects = storage.list().map { ProjectListItem(id = it.id, name = it.name) })
    }

    fun createProject(name: String) {
        val cleanName = name.trim().ifEmpty { "Untitled Project" }
        val id = slug(cleanName)
        val timestamp = nowIso()
        val project = MobileProjectRecord(
            id = id,
            name = cleanName,
            manifestJson = manifestJson(id = id, name = cleanName, timestamp = timestamp),
            historyJson = emptyHistoryJson,
            canvasJson = null,
        )
        apply(storage.create(project))
        refresh()
    }

    fun openProject(id: String) {
        apply(storage.read(id))
    }

    fun deleteProject(id: String) {
        state = when (val result = storage.delete(id)) {
            is AdapterResult.Success -> state.copy(lastError = null)
            is AdapterResult.Failure -> state.copy(lastError = result.error)
        }
        refresh()
    }

    fun renameProject(id: String, name: String) {
        apply(storage.rename(id, name.trim().ifEmpty { "Untitled Project" }))
        refresh()
    }

    private fun apply(result: AdapterResult<MobileProjectRecord>) {
        state = when (result) {
            is AdapterResult.Success -> state.copy(openedProject = result.value, lastError = null)
            is AdapterResult.Failure -> state.copy(lastError = result.error)
        }
    }

    private fun slug(name: String): String {
        val collapsed = name.lowercase()
            .map { char -> if (char.isLetterOrDigit() || char == '-') char else '-' }
            .joinToString("")
            .split("-")
            .filter { it.isNotBlank() }
            .joinToString("-")
        return collapsed.ifBlank { "untitled-project" }
    }

    private fun manifestJson(id: String, name: String, timestamp: String): String = """
        {
          "schemaVersion": 1,
          "id": ${jsonString(id)},
          "name": ${jsonString(name)},
          "createdAt": ${jsonString(timestamp)},
          "updatedAt": ${jsonString(timestamp)},
          "settings": {
            "systemPrompt": "",
            "referenceImages": []
          }
        }
    """.trimIndent()

    private fun jsonString(value: String): String = buildString {
        append('"')
        value.forEach { char ->
            when (char) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> append(char)
            }
        }
        append('"')
    }

    private val emptyHistoryJson: String = """
        {
          "schemaVersion": 1,
          "revision": 0,
          "entries": []
        }
    """.trimIndent()
}
