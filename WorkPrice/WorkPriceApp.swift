import AppKit
import SwiftData
import SwiftUI

@main
struct WorkPriceApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        MenuBarExtra("秒薪", systemImage: "yensign.circle.fill") {
            MenuBarContentView(
                store: appDelegate.store,
                showPanel: { appDelegate.panelCoordinator?.show() },
                hidePanel: { appDelegate.panelCoordinator?.hide() },
                openSettings: { appDelegate.panelCoordinator?.openSettings() }
            )
        }

        Settings {
            SettingsView(store: appDelegate.store)
        }
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let modelContainer: ModelContainer
    let store: WorkStateStore
    private(set) var panelCoordinator: PanelWindowCoordinator?

    override init() {
        let schema = Schema([
            AppSettings.self,
            WorkSession.self
        ])
        let container: ModelContainer
        let startupError: String?

        do {
            let configuration = ModelConfiguration(
                "WorkPrice",
                schema: schema
            )
            container = try ModelContainer(
                for: schema,
                configurations: [configuration]
            )
            startupError = nil
        } catch {
            startupError = "本地数据库无法打开，本次运行的数据不会持久保存：\(error.localizedDescription)"
            do {
                let fallback = ModelConfiguration(
                    schema: schema,
                    isStoredInMemoryOnly: true
                )
                container = try ModelContainer(
                    for: schema,
                    configurations: [fallback]
                )
            } catch {
                fatalError("无法初始化数据模型：\(error.localizedDescription)")
            }
        }

        modelContainer = container
        store = WorkStateStore(
            modelContext: container.mainContext,
            persistenceWarning: startupError
        )
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        let coordinator = PanelWindowCoordinator(store: store)
        panelCoordinator = coordinator
        coordinator.show()
    }

    func applicationShouldTerminateAfterLastWindowClosed(
        _ sender: NSApplication
    ) -> Bool {
        false
    }
}

private struct MenuBarContentView: View {
    @ObservedObject var store: WorkStateStore
    let showPanel: () -> Void
    let hidePanel: () -> Void
    let openSettings: () -> Void

    var body: some View {
        Button(store.isWorking ? "暂停休息" : "开始工作") {
            store.toggleWorking()
        }

        Divider()

        Button("显示浮窗", action: showPanel)
        Button("隐藏浮窗", action: hidePanel)

        Button("设置…") {
            openSettings()
        }
        .keyboardShortcut(",")

        Divider()

        Button("退出秒薪") {
            NSApp.terminate(nil)
        }
        .keyboardShortcut("q")
    }
}
