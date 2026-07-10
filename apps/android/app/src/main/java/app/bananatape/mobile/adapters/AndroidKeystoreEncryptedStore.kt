package app.bananatape.mobile.adapters

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class AndroidKeystoreEncryptedStore(context: Context) : EncryptedKeyValueStore {
    private val preferences = context.getSharedPreferences("bananatape_secure", Context.MODE_PRIVATE)

    override fun readString(key: String): String? = runCatching {
        val encoded = preferences.getString(key, null) ?: return null
        val payload = Base64.decode(encoded, Base64.NO_WRAP)
        val ivSize = payload.first().toInt()
        val iv = payload.copyOfRange(1, ivSize + 1)
        val encrypted = payload.copyOfRange(ivSize + 1, payload.size)
        val cipher = Cipher.getInstance(Transformation)
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
        String(cipher.doFinal(encrypted), Charsets.UTF_8)
    }.getOrNull()

    override fun writeString(key: String, value: String) {
        val cipher = Cipher.getInstance(Transformation)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val payload = byteArrayOf(cipher.iv.size.toByte()) + cipher.iv + encrypted
        preferences.edit().putString(key, Base64.encodeToString(payload, Base64.NO_WRAP)).apply()
    }

    override fun remove(key: String) {
        preferences.edit().remove(key).apply()
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(KeyAlias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(
                KeyGenParameterSpec.Builder(KeyAlias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build(),
            )
            generateKey()
        }
    }

    private companion object {
        const val KeyAlias = "bananatape-openai-key"
        const val Transformation = "AES/GCM/NoPadding"
    }
}
