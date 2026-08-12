import AppKit
import SwiftUI

struct FloatingDashboardView: View {
    @ObservedObject var store: WorkStateStore
    let onHide: () -> Void
    let onOpenSettings: () -> Void

    private let accent = Color(red: 1.0, green: 0.72, blue: 0.23)

    var body: some View {
        ZStack {
            VisualEffectBackground(material: .hudWindow)

            VStack(spacing: 18) {
                header
                earnings
                countdown
                metrics
                workButton
            }
            .padding(22)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(.white.opacity(0.12), lineWidth: 1)
        }
        .frame(width: 340, height: 430)
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        HStack(spacing: 9) {
            Circle()
                .fill(store.isWorking ? Color.green : Color.secondary)
                .frame(width: 9, height: 9)
                .accessibilityHidden(true)

            Text(store.isWorking ? "工作中" : "休息中")
                .font(.headline)

            Text(Self.dateFormatter.string(from: store.now))
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Spacer()

            if let warning = store.persistenceWarning {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                    .help(warning)
                    .accessibilityLabel(warning)
            }

            iconButton("gearshape.fill", label: "打开设置", action: onOpenSettings)
            iconButton("xmark", label: "隐藏浮窗", action: onHide)
        }
    }

    private var earnings: some View {
        VStack(spacing: 2) {
            Text("今日已挣")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("¥")
                    .font(.title2.weight(.medium))
                Text(Self.moneyFormatter.string(
                    from: NSDecimalNumber(decimal: store.summary.earned)
                ) ?? "0.00")
                    .font(.system(size: 56, weight: .bold, design: .rounded))
                    .monospacedDigit()
            }
            .foregroundStyle(accent)
            .accessibilityElement(children: .combine)
        }
    }

    private var countdown: some View {
        VStack(spacing: 8) {
            Text(store.summary.countdownDuration > 0 ? "距离下班" : "今日下班时间已到")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)

            Text(Self.clockDuration(store.summary.countdownDuration))
                .font(.system(size: 38, weight: .semibold, design: .rounded))
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 18))
    }

    private var metrics: some View {
        HStack(alignment: .top, spacing: 8) {
            metric(
                title: "秒薪",
                value: "¥\(store.settings.ratePerSecondText)"
            )

            Divider().frame(height: 42)

            metric(
                title: "已工作时长",
                value: Self.shortDuration(store.summary.workedDuration)
            )

            Divider().frame(height: 42)

            metric(
                title: "无偿打工时长",
                value: Self.shortDuration(store.summary.unpaidDuration),
                highlighted: store.summary.unpaidDuration > 0
            )
        }
    }

    private var workButton: some View {
        Button(action: store.toggleWorking) {
            HStack(spacing: 8) {
                Image(systemName: store.isWorking ? "pause.fill" : "play.fill")
                Text(store.isWorking ? "暂停休息" : "开始工作")
            }
            .font(.headline)
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .foregroundStyle(store.isWorking ? Color.primary : Color.black)
            .background(
                store.isWorking ? Color.white.opacity(0.12) : Color.green,
                in: RoundedRectangle(cornerRadius: 14)
            )
        }
        .buttonStyle(.plain)
        .accessibilityHint(store.isWorking ? "停止计时和计薪" : "开始计时和计薪")
    }

    private func metric(
        title: String,
        value: String,
        highlighted: Bool = false
    ) -> some View {
        VStack(spacing: 5) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(.caption, design: .rounded, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(highlighted ? accent : .primary)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .frame(maxWidth: .infinity)
    }

    private func iconButton(
        _ systemName: String,
        label: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .frame(width: 24, height: 24)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(.secondary)
        .accessibilityLabel(label)
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy/MM/dd EEE"
        return formatter
    }()

    private static let moneyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.roundingMode = .halfUp
        return formatter
    }()

    private static func clockDuration(_ duration: TimeInterval) -> String {
        let seconds = max(0, Int(duration.rounded(.down)))
        return String(
            format: "%02d:%02d:%02d",
            seconds / 3600,
            (seconds % 3600) / 60,
            seconds % 60
        )
    }

    private static func shortDuration(_ duration: TimeInterval) -> String {
        let seconds = max(0, Int(duration.rounded(.down)))
        return String(
            format: "%dh %02dm %02ds",
            seconds / 3600,
            (seconds % 3600) / 60,
            seconds % 60
        )
    }
}

private struct VisualEffectBackground: NSViewRepresentable {
    let material: NSVisualEffectView.Material

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = .behindWindow
        view.state = .active
        return view
    }

    func updateNSView(_ view: NSVisualEffectView, context: Context) {
        view.material = material
    }
}
