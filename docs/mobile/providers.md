# Mobile provider architecture and Codex feasibility gate

## Purpose

This document defines the provider contract for the native iOS and Android apps. It sets the stable mobile baseline, the deterministic mock behavior required for tests, and the exact go or no-go rules for any future Codex provider work.

Mobile must remain usable when only the baseline provider is enabled. Provider work must not assume desktop files, desktop login state, or private backend behavior that cannot be justified for a store-shipped app.

## Product rules

- OpenAI is the stable mobile baseline.
- Mobile provider calls happen through native app code, not through the current Next.js API routes.
- Mobile must stay functional for create, open, prompt, references, annotation-driven edit, history, export, and save even if Codex is unavailable.
- A mocked provider is mandatory for normal tests. Real paid provider calls are optional smoke coverage only.
- Mobile must not assume `~/.codex/auth.json` exists, is readable, or is portable from desktop to phone.
- Mobile must not ship plaintext provider secrets, bearer tokens, auth dumps, or raw request logs.

## Current desktop baseline that mobile must respect

The current desktop product has two provider paths.

- `src/lib/providers/openai-provider.ts` uses `OPENAI_API_KEY` and calls `openai.images.generate` or `openai.images.edit` with `gpt-image-2`.
- `src/lib/providers/god-tibo-provider.ts` reads `~/.codex/auth.json`, extracts `access_token` and `account_id`, then posts to `https://chatgpt.com/backend-api/codex`.
- `src/app/api/generate/route.ts` and `src/app/api/edit/route.ts` route OpenAI and `god-tibo` requests with provider-specific validation and error responses.

That desktop arrangement is the reason mobile needs an explicit gate. The OpenAI path already maps to a user-supplied API key. The current Codex path depends on a desktop auth file and a private backend path that cannot be treated as mobile-safe by default.

## Native mobile provider protocol

The mobile apps should implement one shared provider concept even if the platform code is separate.

### Provider identity and capability shape

Each native provider registration should expose:

- `id`, a stable identifier such as `openai`, `mock`, or `codex`
- `displayName`, plain user-facing name
- `availability`, one of `ready`, `missingKey`, `offline`, `unsupported`, `unavailable`
- `supportsGenerate`, boolean
- `supportsEdit`, boolean
- `supportsCancellation`, boolean
- `supportsReferences`, boolean
- `supportsMaskEdits`, boolean
- `statusMessage`, redacted explanation safe for UI and logs

The registry must allow the app to show a provider in settings even when it is unavailable. That matters for Codex. Users need a clear explanation instead of a disappearing option or a silent failure.

### Operation contract

Each provider must expose two primary operations.

1. `generate(request)`
2. `edit(request)`

Both operations should accept a typed request object that already contains parsed app data, not loosely shaped JSON maps. The request shape should cover:

- prompt
- optional system prompt text if the mobile product chooses to send it through prompt composition
- reference images for generation when supported
- input image list for edits
- optional mask image for edit
- requested output size
- request id for cancellation and history correlation

Both operations should return a typed result shape that includes:

- final image bytes or data URL equivalent for the native pipeline
- provider id
- normalized prompt actually submitted
- request id
- redacted provider metadata safe to persist in history if needed

### Cancellation

Cancellation is part of the protocol, even when a provider cannot guarantee upstream abort.

- The mobile app must be able to cancel its local task and stop updating UI state.
- Providers that support real network cancellation should terminate the request.
- Providers that cannot cancel upstream work must still surface local cancellation and drop late results.
- Late results after cancellation must not overwrite a newer history entry or UI preview.

### Missing key and auth-required states

Providers must fail as typed availability states, not as generic thrown errors.

- `missingKey` means the provider requires user setup before a request can start.
- `unsupported` means the provider is intentionally unavailable on mobile.
- `unavailable` means the provider concept exists, but the current build or policy state does not allow it to run.

OpenAI should use `missingKey` when no user API key is stored.

Codex should use `unsupported` or `unavailable` unless every feasibility gate in this document passes.

### Offline behavior

The provider layer must distinguish offline from other failures.

- If the device is offline before request start, expose `offline` immediately and do not start a network call.
- If connectivity drops mid-request, surface an offline or network failure state that preserves draft prompt, annotations, and current project state.
- Offline behavior must never clear stored provider configuration.
- The mocked provider must also support a deterministic offline failure mode for tests.

### Error handling and redacted logs

Provider logs must be safe to persist in app logs and QA evidence.

- Never log raw API keys.
- Never log bearer tokens.
- Never log auth JSON blobs.
- Never log full request bodies when they contain prompt-plus-image payloads unless the evidence path is explicitly fake-test-only.
- Error messages shown to users should be short, stable, and provider-specific when useful.
- Developer logs may include HTTP status, retry count, request id, latency, and redacted endpoint family.

For example, a mobile error may say `OpenAI request failed with HTTP 401` or `Provider unavailable on this build`, but it must not print a secret or private auth file contents.

## Deterministic mocked provider

The mocked provider is required for unit tests, UI tests, and most integration coverage.

### Why it exists

- Mobile tests must not depend on paid provider availability.
- CI must run without secrets.
- Error states such as offline, cancellation, invalid image count, and delayed completion must be reproducible.

### Required mock behaviors

The mock provider must support deterministic scenarios selected by explicit test input.

- generate success
- edit success
- missing key
- offline
- delayed response
- cancellation before completion
- provider error with stable message

### Deterministic output rules

- The same fixture input must produce the same output bytes every time.
- The returned image may be a bundled fixture or a generated placeholder, but it must be stable.
- The mock must expose latency knobs for loading-state and cancellation tests.
- The mock must never access network, user auth, Keychain, Keystore, or app-private provider secrets.

## OpenAI mobile baseline

OpenAI with `gpt-image-2` is the stable baseline for mobile generate and edit.

### Why OpenAI is the baseline

- The current desktop product already uses `gpt-image-2` for image generation and edit.
- The public OpenAI Image API supports image generation and image editing with API key auth.
- This path does not require a desktop auth file or a private ChatGPT backend.

### Request baseline

Mobile OpenAI support should match the current product intent:

- generate with `gpt-image-2`
- edit with `gpt-image-2`
- one output image per request in MVP
- user-supplied key only, no BananaTape-hosted relay in this task

### BYOK storage rules

OpenAI is BYOK on mobile. The user provides their own API key inside the app.

Storage requirements:

- iOS must store the key in Keychain.
- Android must store the key using EncryptedSharedPreferences backed by Android Keystore.
- Never store the key in plain SharedPreferences, UserDefaults, sqlite rows, JSON project files, logs, screenshots, or fixtures.
- Never export the key with project backups or share flows.

Behavior requirements:

- The app must let the user add, replace, and remove their OpenAI key.
- The app must show whether the key is present without revealing the full value.
- The app may show a masked suffix for confirmation, but never the full secret after save.
- If the stored key becomes invalid, keep the saved setting but surface the request failure normally.

### Network and policy baseline

- OpenAI requests should go to public documented API endpoints.
- The app must not depend on desktop environment variables on phone.
- If the user has not entered a key, the provider should stay visible and report `missingKey`.

## Codex feasibility gate

Codex mobile support is not part of the baseline. It is a gated possibility only.

### Why a gate exists

The current desktop `god-tibo` provider depends on two assumptions that are not acceptable for mobile by default.

- It reads `~/.codex/auth.json` from the desktop home directory.
- It calls a private `chatgpt.com/backend-api/codex` backend path.

Those assumptions may fail technically, contractually, or in store review. Mobile must treat Codex as unsupported unless a separate spike proves an app-safe path.

### Exact pass criteria

Every item below must pass before any mobile Codex provider can move beyond experimental documentation.

1. No desktop auth dependency
   - The mobile path does not depend on `~/.codex/auth.json`.
   - The mobile path does not require copying a desktop auth file onto the device.
   - The mobile path does not require the user to sideload desktop credentials into app files.

2. User-consented mobile auth path
   - There is a real mobile auth flow or officially allowed token entry path meant for mobile use.
   - The user explicitly consents inside the app before enabling it.
   - The flow can be explained in product copy without asking the user to inspect hidden desktop folders.

3. Secure token storage
   - iOS stores the token in Keychain.
   - Android stores the token in EncryptedSharedPreferences or another Keystore-backed secure container.
   - The app can revoke or clear the token locally.
   - Tokens are never written to project files, logs, screenshots, fixtures, or crash evidence.

4. Allowed terms and policy posture
   - The auth and request path is allowed by the provider's terms and policy posture for a shipped mobile app.
   - The team can document that posture without hand-waving over private or ambiguous usage.
   - If this cannot be confirmed, the gate fails.

5. App Store and Play Store review risk is acceptable
   - The auth and network path does not create obvious review rejection risk.
   - The feature can be described honestly in store review notes.
   - The flow does not depend on hidden desktop setup or behavior that would look like a sideloaded private client.

6. Request reliability is acceptable
   - The mobile path can complete repeated generate requests with acceptable reliability on device and on normal mobile networks.
   - Auth refresh, expired credentials, and offline failure states are understandable.
   - The path does not routinely degrade into unexplained backend failures.

7. No unstable private backend shipping
   - The mobile implementation does not ship against an unstable private backend path whose availability or permission status cannot be trusted.
   - If the only working path still depends on private ChatGPT backend behavior, do not ship.

### Exact fail outcome

If any pass criterion fails, Codex is not shippable for mobile in this release.

Required product behavior:

- The provider registry still includes a Codex entry if product wants discoverability.
- That entry reports `unsupported` or `unavailable` with a plain explanation.
- The app does not prompt the user to browse for `~/.codex/auth.json`.
- The app does not ask the user to paste desktop auth file contents.
- OpenAI remains fully functional as the supported provider.
- Normal mobile QA, CI, and release sign-off must proceed with OpenAI plus mock coverage only.

Recommended user-facing explanation:

`Codex is not available on mobile in this build. BananaTape mobile supports OpenAI with your own API key.`

### Kill criteria

Any one of these is enough to stop mobile Codex implementation work.

- The only working auth path requires `~/.codex/auth.json` or a desktop-exported equivalent.
- The only working request path depends on a private backend that lacks stable, allowed mobile usage.
- Secure storage cannot be paired with a user-consented auth flow.
- Terms or policy status cannot be confirmed as acceptable.
- Store review risk is materially high.
- Reliability remains too weak for a user-facing feature.

If those conditions remain true, do not ship the Codex provider on mobile.

## Unsupported fallback behavior

Mobile needs a clear fallback when a provider is gated off.

### Registry behavior

- `mock` is available in tests and development fixtures.
- `openai` is the supported production baseline.
- `codex` is present only as an explicitly unsupported or unavailable capability until the gate passes.

### UI behavior

- Provider picker may show Codex as unavailable with a short explanation.
- Generate and edit screens must continue to work with OpenAI selected.
- The app must never leave the user without a supported provider path if OpenAI setup is complete.

### Persistence behavior

- If a project imported from desktop references Codex metadata, preserve existing history metadata when feasible.
- Mobile must not rewrite old provider metadata into a false claim that Codex is supported on device.

## Acceptance checklist for implementation tasks

Downstream provider implementation tasks should verify all of the following.

- Native provider protocol covers generate, edit, cancellation, missing key, offline, and redacted logs.
- Mock provider is deterministic and secret-free.
- OpenAI uses `gpt-image-2` as the mobile baseline.
- iOS secret storage uses Keychain.
- Android secret storage uses EncryptedSharedPreferences with Keystore-backed protection.
- Mobile docs and code never describe `~/.codex/auth.json` as portable to mobile.
- Codex remains behind the exact feasibility gate in this document.
- If the gate fails, unsupported fallback remains explicit while OpenAI still works.
