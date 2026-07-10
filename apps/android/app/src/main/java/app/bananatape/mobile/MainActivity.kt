package app.bananatape.mobile

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
import app.bananatape.mobile.adapters.AndroidInboundIntentAdapter
import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.adapters.AndroidKeystoreEncryptedStore
import app.bananatape.mobile.adapters.EncryptedPreferencesOpenAiApiKeyStore
import app.bananatape.mobile.storage.LocalProjectStorage
import app.bananatape.mobile.storage.defaultAndroidProjectStorageRoot
import app.bananatape.mobile.ui.ProjectListState
import app.bananatape.mobile.ui.ProjectListScreen
import app.bananatape.mobile.ui.ProjectPickerViewModel
import app.bananatape.mobile.ui.importBaseProjectImage

class MainActivity : ComponentActivity() {
    @OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val storage = LocalProjectStorage(defaultAndroidProjectStorageRoot(filesDir))
        consumeInboundImageIntent(intent, storage)
        val viewModel = ProjectPickerViewModel(storage)
        val keyStore = EncryptedPreferencesOpenAiApiKeyStore(AndroidKeystoreEncryptedStore(this))
        setContent {
            var state by remember { mutableStateOf(ProjectListState(projects = viewModel.state.projects)) }
            val windowSizeClass = calculateWindowSizeClass(this)
            ProjectListScreen(
                state = state,
                onCreate = { name ->
                    viewModel.createProject(name)
                    state = ProjectListState(projects = viewModel.state.projects)
                },
                onOpen = { id -> viewModel.openProject(id) },
                onRename = { id, name ->
                    viewModel.renameProject(id, name)
                    state = ProjectListState(projects = viewModel.state.projects)
                },
                onDelete = { id ->
                    viewModel.deleteProject(id)
                    state = ProjectListState(projects = viewModel.state.projects)
                },
                onRefresh = {
                    viewModel.refresh()
                    state = ProjectListState(projects = viewModel.state.projects)
                },
                storage = storage,
                keyStore = keyStore,
                windowSizeClass = windowSizeClass,
            )
        }
    }

    internal fun consumeInboundImageIntent(
        intent: Intent?,
        storage: LocalProjectStorage,
        importer: (android.net.Uri, LocalProjectStorage) -> AdapterResult<*> = { uri, projectStorage ->
            importBaseProjectImage(this, uri, projectStorage)
        },
    ): Boolean {
        if (intent == null) return false
        val adapter = AndroidInboundIntentAdapter()
        val uri = adapter.singleContentUri(intent) ?: return false
        return when (importer(uri, storage)) {
            is AdapterResult.Success -> true
            is AdapterResult.Failure -> false
        }
    }
}
