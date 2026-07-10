package app.bananatape.mobile.storage

import app.bananatape.mobile.adapters.MobileProjectSummary

object ProjectJsonValidation {
    fun manifestSummary(json: String): MobileProjectSummary? {
        if (!looksLikeJsonObject(json)) return null
        if (numberField(json, "schemaVersion") != 1) return null
        val id = stringField(json, "id") ?: return null
        val name = stringField(json, "name") ?: return null
        stringField(json, "createdAt") ?: return null
        stringField(json, "updatedAt") ?: return null
        return MobileProjectSummary(id = id, name = name)
    }

    fun historyIsValid(json: String): Boolean {
        if (!looksLikeJsonObject(json)) return false
        return numberField(json, "schemaVersion") == 1 && numberField(json, "revision") != null && json.contains(Regex("\"entries\"\\s*:\\s*\\["))
    }

    private fun looksLikeJsonObject(json: String): Boolean {
        val trimmed = json.trim()
        return trimmed.startsWith("{") && trimmed.endsWith("}") && !trimmed.contains("{ invalid")
    }

    private fun stringField(json: String, field: String): String? {
        val encoded = Regex("\"${Regex.escape(field)}\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"").find(json)?.groupValues?.get(1) ?: return null
        return decodeJsonString(encoded).takeIf { it.isNotBlank() }
    }

    private fun numberField(json: String, field: String): Int? =
        Regex("\"${Regex.escape(field)}\"\\s*:\\s*(\\d+)").find(json)?.groupValues?.get(1)?.toIntOrNull()

    private fun decodeJsonString(value: String): String = buildString {
        var index = 0
        while (index < value.length) {
            val char = value[index]
            if (char != '\\' || index == value.lastIndex) {
                append(char)
                index += 1
            } else {
                when (val escaped = value[index + 1]) {
                    '"' -> append('"')
                    '\\' -> append('\\')
                    '/' -> append('/')
                    'b' -> append('\b')
                    'f' -> append('\u000C')
                    'n' -> append('\n')
                    'r' -> append('\r')
                    't' -> append('\t')
                    else -> append(escaped)
                }
                index += 2
            }
        }
    }
}
