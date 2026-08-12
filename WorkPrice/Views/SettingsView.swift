import SwiftUI

struct SettingsView: View {
    @ObservedObject var store: WorkStateStore
    @Environment(\.dismiss) private var dismiss
    private let onClose: (() -> Void)?

    @State private var rateText: String
    @State private var startTime: Date
    @State private var endTime: Date
    @State private var paysAfterWork: Bool

    init(store: WorkStateStore, onClose: (() -> Void)? = nil) {
        self.store = store
        self.onClose = onClose
        _rateText = State(initialValue: store.settings.ratePerSecondText)
        _startTime = State(initialValue: Self.timeDate(
            minutes: store.settings.workStartMinutes
        ))
        _endTime = State(initialValue: Self.timeDate(
            minutes: store.settings.workEndMinutes
        ))
        _paysAfterWork = State(initialValue: store.settings.paysAfterWork)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                Text("秒薪设置")
                    .font(.title2.weight(.semibold))
                Text("配置仅保存在本机；保存后从当前时刻按新规则计费。")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            Form {
                LabeledContent("秒薪") {
                    HStack(spacing: 6) {
                        Text("¥")
                        TextField(
                            "秒薪数值",
                            text: $rateText,
                            prompt: Text("0.0367")
                        )
                            .labelsHidden()
                            .frame(width: 110)
                            .multilineTextAlignment(.trailing)
                        Text("/ 秒")
                            .foregroundStyle(.secondary)
                    }
                }

                if let hourlyRate {
                    LabeledContent("折合时薪") {
                        Text("¥\(hourlyRate) / 小时")
                            .foregroundStyle(.secondary)
                    }
                }

                LabeledContent("上班时间") {
                    DatePicker(
                        "上班时间",
                        selection: $startTime,
                        displayedComponents: .hourAndMinute
                    )
                    .labelsHidden()
                }

                LabeledContent("下班时间") {
                    DatePicker(
                        "下班时间",
                        selection: $endTime,
                        displayedComponents: .hourAndMinute
                    )
                    .labelsHidden()
                }

                Toggle("下班后继续计薪", isOn: $paysAfterWork)

                Text(scheduleHint)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .formStyle(.grouped)

            if let warning = store.persistenceWarning {
                Label(warning, systemImage: "externaldrive.badge.exclamationmark")
                    .font(.callout)
                    .foregroundStyle(.orange)
            }

            if let error = store.lastError {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.callout)
                    .foregroundStyle(.orange)
            }

            HStack {
                Spacer()
                Button("取消") {
                    store.clearError()
                    close()
                }
                .keyboardShortcut(.cancelAction)

                Button("保存") {
                    let saved = store.applySettings(
                        ratePerSecondText: rateText,
                        workStartMinutes: Self.minutes(from: startTime),
                        workEndMinutes: Self.minutes(from: endTime),
                        paysAfterWork: paysAfterWork
                    )
                    if saved {
                        close()
                    }
                }
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(24)
        .frame(width: 460)
        .background(Color(nsColor: .windowBackgroundColor))
        .preferredColorScheme(.dark)
    }

    private func close() {
        if let onClose {
            onClose()
        } else {
            dismiss()
        }
    }

    private var hourlyRate: String? {
        let normalized = rateText.replacingOccurrences(of: ",", with: ".")
        guard
            let rate = Decimal(
                string: normalized,
                locale: Locale(identifier: "en_US_POSIX")
            ),
            rate > 0
        else {
            return nil
        }
        let value = NSDecimalNumber(decimal: rate * 3600)
        return Self.rateFormatter.string(from: value)
    }

    private var scheduleHint: String {
        let start = Self.minutes(from: startTime)
        let end = Self.minutes(from: endTime)
        if start > end {
            return "当前为跨午夜班次，账目归入班次开始日。"
        }
        if start == end {
            return "上班时间和下班时间不能相同。"
        }
        return paysAfterWork
            ? "下班后仍会继续计薪。"
            : "下班后金额停止增长，并累计无偿打工时长。"
    }

    private static let rateFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.roundingMode = .halfUp
        return formatter
    }()

    private static func timeDate(minutes: Int) -> Date {
        Calendar.current.date(
            from: DateComponents(
                year: 2001,
                month: 1,
                day: 1,
                hour: minutes / 60,
                minute: minutes % 60
            )
        ) ?? Date()
    }

    private static func minutes(from date: Date) -> Int {
        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (components.hour ?? 0) * 60 + (components.minute ?? 0)
    }
}
