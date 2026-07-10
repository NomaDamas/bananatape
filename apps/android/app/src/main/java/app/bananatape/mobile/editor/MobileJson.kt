package app.bananatape.mobile.editor

class MobileJson(private val text: String) {
    private var index = 0

    fun parse(): JsonValue {
        skipWhitespace()
        val value = parseValue()
        skipWhitespace()
        if (index != text.length) throw IllegalArgumentException("Unexpected trailing JSON")
        return value
    }

    private fun parseValue(): JsonValue {
        skipWhitespace()
        return when (peek()) {
            '{' -> parseObject()
            '[' -> parseArray()
            '"' -> JsonValue.StringValue(parseString())
            't' -> parseLiteral("true", JsonValue.BooleanValue(true))
            'f' -> parseLiteral("false", JsonValue.BooleanValue(false))
            'n' -> parseLiteral("null", JsonValue.NullValue)
            else -> parseNumber()
        }
    }

    private fun parseObject(): JsonValue.ObjectValue {
        consume('{')
        val values = linkedMapOf<String, JsonValue>()
        skipWhitespace()
        if (peek() == '}') {
            index += 1
            return JsonValue.ObjectValue(values)
        }
        while (true) {
            val key = parseString()
            skipWhitespace()
            consume(':')
            values[key] = parseValue()
            skipWhitespace()
            when (peek()) {
                ',' -> {
                    index += 1
                    skipWhitespace()
                }
                '}' -> {
                    index += 1
                    return JsonValue.ObjectValue(values)
                }
                else -> throw IllegalArgumentException("Expected object separator")
            }
        }
    }

    private fun parseArray(): JsonValue.ArrayValue {
        consume('[')
        val values = mutableListOf<JsonValue>()
        skipWhitespace()
        if (peek() == ']') {
            index += 1
            return JsonValue.ArrayValue(values)
        }
        while (true) {
            values += parseValue()
            skipWhitespace()
            when (peek()) {
                ',' -> index += 1
                ']' -> {
                    index += 1
                    return JsonValue.ArrayValue(values)
                }
                else -> throw IllegalArgumentException("Expected array separator")
            }
        }
    }

    private fun parseString(): String {
        consume('"')
        val result = StringBuilder()
        while (index < text.length) {
            when (val char = text[index]) {
                '"' -> {
                    index += 1
                    return result.toString()
                }
                '\\' -> {
                    index += 1
                    result.append(parseEscape())
                }
                else -> {
                    result.append(char)
                    index += 1
                }
            }
        }
        throw IllegalArgumentException("Unterminated string")
    }

    private fun parseEscape(): Char {
        val escaped = text[index]
        index += 1
        return when (escaped) {
            '"' -> '"'
            '\\' -> '\\'
            '/' -> '/'
            'b' -> '\b'
            'f' -> '\u000C'
            'n' -> '\n'
            'r' -> '\r'
            't' -> '\t'
            else -> escaped
        }
    }

    private fun parseNumber(): JsonValue.NumberValue {
        val start = index
        while (index < text.length && text[index] in "-+0123456789.eE") index += 1
        return JsonValue.NumberValue(text.substring(start, index).toDouble())
    }

    private fun parseLiteral(literal: String, value: JsonValue): JsonValue {
        if (!text.startsWith(literal, index)) throw IllegalArgumentException("Expected $literal")
        index += literal.length
        return value
    }

    private fun consume(expected: Char) {
        skipWhitespace()
        if (peek() != expected) throw IllegalArgumentException("Expected $expected")
        index += 1
    }

    private fun peek(): Char = text.getOrElse(index) { '\u0000' }

    private fun skipWhitespace() {
        while (index < text.length && text[index].isWhitespace()) index += 1
    }
}

sealed interface JsonValue {
    data class ObjectValue(val values: Map<String, JsonValue>) : JsonValue
    data class ArrayValue(val values: List<JsonValue>) : JsonValue
    data class StringValue(val value: String) : JsonValue
    data class NumberValue(val value: Double) : JsonValue
    data class BooleanValue(val value: Boolean) : JsonValue
    data object NullValue : JsonValue
}

fun JsonValue.obj(): Map<String, JsonValue> = (this as JsonValue.ObjectValue).values
fun JsonValue.array(): List<JsonValue> = (this as JsonValue.ArrayValue).values
fun JsonValue.stringOrNull(): String? = (this as? JsonValue.StringValue)?.value
fun JsonValue.numberOrZero(): Double = (this as? JsonValue.NumberValue)?.value ?: 0.0
