import SwiftUI

struct LineageNavigationControls: View {
    let availability: LineageNavigationAvailability
    let onMoveFocus: (LineageNavigationDirection) -> Void

    var body: some View {
        ZStack {
            if availability.canMoveUp {
                button("chevron.up", direction: .up, identifier: "lineageUpButton")
                    .offset(y: -190)
            }
            if availability.canMoveDown {
                button("chevron.down", direction: .down, identifier: "lineageDownButton")
                    .offset(y: 80)
            }
            if availability.canMoveLeft {
                button("chevron.left", direction: .left, identifier: "lineageLeftButton")
                    .offset(x: -170, y: -55)
            }
            if availability.canMoveRight {
                button("chevron.right", direction: .right, identifier: "lineageRightButton")
                    .offset(x: 170, y: -55)
            }
        }
        .padding(.bottom, 138)
    }

    private func button(_ systemName: String, direction: LineageNavigationDirection, identifier: String) -> some View {
        Button { onMoveFocus(direction) } label: {
            Image(systemName: systemName)
                .font(.caption.weight(.bold))
                .frame(width: 36, height: 36)
                .background(TossStyle.panel, in: Circle())
                .overlay(Circle().stroke(TossStyle.border))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}
