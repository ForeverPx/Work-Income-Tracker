import AppKit
import SwiftUI

private final class WorkPricePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

@MainActor
final class PanelWindowCoordinator: NSObject, NSWindowDelegate {
    private enum Constants {
        static let size = NSSize(width: 340, height: 430)
        static let screenMargin: CGFloat = 18
        static let savedFrameKey = "floatingPanelFrame"
    }

    private let store: WorkStateStore
    private var panel: NSPanel?
    private var settingsWindow: NSWindow?

    init(store: WorkStateStore) {
        self.store = store
        super.init()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenConfigurationChanged),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    func show() {
        let panel = panel ?? makePanel()
        constrainToVisibleScreen(panel)
        panel.orderFrontRegardless()
    }

    func hide() {
        panel?.orderOut(nil)
    }

    func toggleVisibility() {
        if panel?.isVisible == true {
            hide()
        } else {
            show()
        }
    }

    func openSettings() {
        if let settingsWindow {
            settingsWindow.contentView = makeSettingsContentView()
            NSApp.activate(ignoringOtherApps: true)
            settingsWindow.makeKeyAndOrderFront(nil)
            return
        }

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 440),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = "秒薪设置"
        window.isReleasedWhenClosed = false
        window.contentView = makeSettingsContentView()
        window.center()
        window.setFrameAutosaveName("settingsWindow")
        settingsWindow = window

        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }

    private func makeSettingsContentView() -> NSView {
        NSHostingView(
            rootView: SettingsView(
                store: store,
                onClose: { [weak self] in
                    self?.settingsWindow?.orderOut(nil)
                }
            )
        )
    }

    func windowDidMove(_ notification: Notification) {
        guard let panel else { return }
        UserDefaults.standard.set(
            NSStringFromRect(panel.frame),
            forKey: Constants.savedFrameKey
        )
    }

    private func makePanel() -> NSPanel {
        let panel = WorkPricePanel(
            contentRect: NSRect(origin: .zero, size: Constants.size),
            styleMask: [.borderless, .nonactivatingPanel, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        panel.delegate = self
        panel.level = .floating
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isMovableByWindowBackground = true
        panel.collectionBehavior = [
            .canJoinAllSpaces,
            .fullScreenAuxiliary,
            .stationary
        ]
        panel.animationBehavior = .utilityWindow

        panel.contentView = NSHostingView(
            rootView: FloatingDashboardView(
                store: store,
                onHide: { [weak self] in self?.hide() },
                onOpenSettings: { [weak self] in self?.openSettings() }
            )
        )

        if let savedFrame = UserDefaults.standard.string(
            forKey: Constants.savedFrameKey
        ) {
            panel.setFrame(NSRectFromString(savedFrame), display: false)
        } else {
            placeAtBottomRight(panel)
        }

        self.panel = panel
        return panel
    }

    private func placeAtBottomRight(_ panel: NSPanel) {
        guard let screen = NSScreen.main ?? NSScreen.screens.first else { return }
        let visible = screen.visibleFrame
        let origin = NSPoint(
            x: visible.maxX - panel.frame.width - Constants.screenMargin,
            y: visible.minY + Constants.screenMargin
        )
        panel.setFrameOrigin(origin)
    }

    private func constrainToVisibleScreen(_ panel: NSPanel) {
        let screen = panel.screen ?? NSScreen.main ?? NSScreen.screens.first
        guard let visible = screen?.visibleFrame else { return }

        var frame = panel.frame
        frame.origin.x = min(
            max(frame.origin.x, visible.minX + Constants.screenMargin),
            visible.maxX - frame.width - Constants.screenMargin
        )
        frame.origin.y = min(
            max(frame.origin.y, visible.minY + Constants.screenMargin),
            visible.maxY - frame.height - Constants.screenMargin
        )
        panel.setFrame(frame, display: false)
    }

    @objc
    private func screenConfigurationChanged() {
        guard let panel else { return }
        constrainToVisibleScreen(panel)
    }
}
