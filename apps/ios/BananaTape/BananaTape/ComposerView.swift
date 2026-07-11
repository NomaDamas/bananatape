import SwiftUI

struct ComposerView: View {
    @Binding var state: ComposerState
    var apiKey: Binding<String> = .constant("")
    var isSubmitting = false
    var statusMessage: String?
    var onSubmit: () -> Void = {}
    var onManageReferences: () -> Void = {}
    var onAddKey: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            sheetHeader
            promptField
            submissionModeSection
            missingKeyWarning
            providerSection
            outputSizeSection
            referencesSection
            systemPromptSection

            if let statusMessage {
                Text(statusMessage)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(TossStyle.secondaryText)
            }

            Button(isSubmitting ? "Submitting..." : state.primaryActionLabel) {
                onSubmit()
            }
            .buttonStyle(TossPrimaryButtonStyle())
            .disabled(!state.canSubmitPrimaryAction || isSubmitting)
            .accessibilityIdentifier("composerPrimaryAction")
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 18)
        .background(TossStyle.panel)
        .accessibilityIdentifier("nativeBottomComposer")
    }

    private var sheetHeader: some View {
        HStack {
            Text(state.primaryActionLabel)
                .font(.title3.weight(.semibold))
                .foregroundStyle(TossStyle.primaryText)
            Spacer()
        }
    }

    @ViewBuilder
    private var submissionModeSection: some View {
        if state.hasSelectedImage {
            Picker("Submission mode", selection: $state.mode) {
                Text("Edit focused").tag(EditorMode.edit)
                Text("New generation").tag(EditorMode.generate)
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("composerSubmissionMode")
        }
    }

    private var promptField: some View {
        TextField("Describe an image...", text: $state.promptText, axis: .vertical)
            .textFieldStyle(.plain)
            .lineLimit(4...7)
            .font(.body)
            .foregroundStyle(TossStyle.primaryText)
            .tint(TossStyle.blue)
            .padding(14)
            .frame(minHeight: 110, alignment: .topLeading)
            .background(TossStyle.workspace, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(TossStyle.border))
            .accessibilityIdentifier("composerPromptField")
    }

    @ViewBuilder
    private var missingKeyWarning: some View {
        if state.selectedProvider == .openAI && apiKey.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            HStack(spacing: 10) {
                Image(systemName: "key.fill")
                    .font(.subheadline.weight(.semibold))
                Text("Add your OpenAI API key to generate.")
                    .font(.footnote.weight(.medium))
                Spacer()
                Button("Add key", action: onAddKey)
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(TossStyle.warningButton, in: Capsule())
                    .accessibilityIdentifier("composerAddKeyButton")
            }
            .foregroundStyle(TossStyle.warningText)
            .padding(12)
            .background(TossStyle.warningPanel, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(TossStyle.warningBorder))
            .accessibilityIdentifier("composerMissingKeyWarning")
        }
    }

    private var providerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Provider")
            HStack(spacing: 8) {
                providerButton(.openAI)
                providerButton(.mock)
                disabledProviderButton
            }
            .accessibilityIdentifier("composerProviderPicker")
        }
    }

    private func providerButton(_ provider: ComposerProvider) -> some View {
        Button {
            state.selectedProvider = provider
        } label: {
            Text(provider.displayName)
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .foregroundStyle(state.selectedProvider == provider ? TossStyle.primaryText : TossStyle.secondaryText)
                .background(state.selectedProvider == provider ? TossStyle.selectedGlow : TossStyle.panelAlt, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(state.selectedProvider == provider ? TossStyle.blue : TossStyle.border))
        }
        .buttonStyle(.plain)
    }

    private var disabledProviderButton: some View {
        Text("Codex")
            .font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .foregroundStyle(TossStyle.placeholderText)
            .background(TossStyle.panelAlt.opacity(0.45), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(TossStyle.border.opacity(0.6)))
            .accessibilityLabel("Codex unavailable")
    }

    private var outputSizeSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Output size")
            HStack(spacing: 8) {
                outputSizeButton(.square, title: "Square", caption: "1024²")
                outputSizeButton(.portrait, title: "Portrait", caption: "1024x1536")
                outputSizeButton(.landscape, title: "Landscape", caption: "1536x1024")
            }
            .accessibilityIdentifier("composerOutputSizePicker")
        }
    }

    private func outputSizeButton(_ size: OutputSize, title: String, caption: String) -> some View {
        Button {
            state.outputSize = size
        } label: {
            VStack(spacing: 4) {
                Text(title)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(TossStyle.primaryText)
                Text(caption)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(TossStyle.secondaryText)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(state.outputSize == size ? TossStyle.selectedGlow : TossStyle.panelAlt, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(state.outputSize == size ? TossStyle.blue : TossStyle.border))
        }
        .buttonStyle(.plain)
    }

    private var referencesSection: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                sectionLabel("References")
                Text(state.referenceStripLabel)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(TossStyle.primaryText)
            }
            Spacer()
            Button("Manage") { onManageReferences() }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TossStyle.blue)
                .accessibilityIdentifier("composerManageReferencesButton")
        }
        .padding(14)
        .background(TossStyle.panelAlt, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(TossStyle.border))
        .accessibilityIdentifier("composerReferenceStrip")
    }

    private var systemPromptSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("System prompt · Project context")
            TextField("Cinematic product art director. Prefer soft key light, shallow depth of field, muted palettes.", text: $state.systemPrompt, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(3...5)
                .font(.footnote)
                .foregroundStyle(TossStyle.primaryText)
                .tint(TossStyle.blue)
                .padding(14)
                .frame(minHeight: 88, alignment: .topLeading)
                .background(TossStyle.workspace, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(TossStyle.border))
                .accessibilityIdentifier("composerSystemPromptField")
        }
    }

    private func sectionLabel(_ label: String) -> some View {
        Text(label.uppercased())
            .font(.caption2.weight(.bold))
            .tracking(0.9)
            .foregroundStyle(TossStyle.mutedText)
    }
}

struct TossPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.semibold))
            .foregroundStyle(TossStyle.primaryButtonText)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background((configuration.isPressed ? TossStyle.bluePressed : TossStyle.blue), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct TossCompactButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(TossStyle.primaryButtonText)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background((configuration.isPressed ? TossStyle.bluePressed : TossStyle.blue), in: RoundedRectangle(cornerRadius: 16))
    }
}

enum TossStyle {
    static let workspace = Color(red: 0.118, green: 0.118, blue: 0.118)
    static let panel = Color(red: 0.145, green: 0.145, blue: 0.145)
    static let panelAlt = Color(red: 0.173, green: 0.173, blue: 0.173)
    static let imageShell = Color(red: 0.078, green: 0.078, blue: 0.078)
    static let selectedChip = Color(red: 0.231, green: 0.231, blue: 0.231)
    static let blue = Color(red: 0.051, green: 0.600, blue: 1.000)
    static let bluePressed = Color(red: 0.043, green: 0.522, blue: 0.875)
    static let primaryText = Color(red: 0.961, green: 0.961, blue: 0.961)
    static let secondaryText = Color(red: 0.702, green: 0.702, blue: 0.702)
    static let mutedText = Color(red: 0.502, green: 0.502, blue: 0.502)
    static let placeholderText = Color(red: 0.400, green: 0.400, blue: 0.400)
    static let primaryButtonText = Color.white
    static let border = Color.white.opacity(0.10)
    static let separator = Color.white.opacity(0.12)
    static let selectedGlow = Color(red: 0.051, green: 0.600, blue: 1.000).opacity(0.18)
    static let rootBadge = Color(red: 0.078, green: 0.208, blue: 0.122)
    static let rootBadgeText = Color(red: 0.525, green: 0.937, blue: 0.675)
    static let editBadge = Color(red: 0.231, green: 0.145, blue: 0.337)
    static let editBadgeText = Color(red: 0.859, green: 0.718, blue: 1.000)
    static let destructive = Color(red: 1.000, green: 0.420, blue: 0.420)
    static let warningPanel = Color(red: 0.290, green: 0.070, blue: 0.070)
    static let warningButton = Color(red: 0.470, green: 0.120, blue: 0.120)
    static let warningBorder = Color(red: 1.000, green: 0.420, blue: 0.420).opacity(0.35)
    static let warningText = Color(red: 1.000, green: 0.855, blue: 0.855)

    static let black = primaryText
    static let gray100 = workspace
    static let gray200 = panelAlt
    static let gray600 = secondaryText
    static let gray700 = mutedText
}

#Preview {
    @Previewable @State var state = ComposerState(
        promptText: "single koi, minimal negative space",
        selectedProvider: .openAI,
        systemPrompt: "Cinematic product art director. Prefer soft key light, shallow depth of field, muted palettes.",
        references: [ComposerReferenceSummary(id: "ref-1", label: "koi.png"), ComposerReferenceSummary(id: "ref-2", label: "water.png")]
    )
    ComposerView(state: $state)
        .background(TossStyle.workspace)
}
