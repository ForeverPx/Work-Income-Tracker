import Combine
import Foundation
import SwiftData

@MainActor
final class WorkStateStore: ObservableObject {
    @Published private(set) var settings: AppSettings
    @Published private(set) var sessions: [WorkSession]
    @Published private(set) var now: Date
    @Published private(set) var lastError: String?
    @Published private(set) var persistenceWarning: String?

    private let modelContext: ModelContext
    private let scheduleResolver: ScheduleResolver
    private let payCalculator = PayCalculator()
    private var timerCancellable: AnyCancellable?

    init(
        modelContext: ModelContext,
        now: Date = Date(),
        startsTimer: Bool = true,
        calendar: Calendar = .current,
        initialError: String? = nil,
        persistenceWarning: String? = nil
    ) {
        self.modelContext = modelContext
        self.now = now
        self.scheduleResolver = ScheduleResolver(calendar: calendar)
        self.persistenceWarning = persistenceWarning
        var loadingError = initialError

        do {
            let storedSettings = try modelContext.fetch(FetchDescriptor<AppSettings>())
            if let existing = storedSettings.first(where: {
                $0.id == "singleton"
            }) ?? storedSettings.first {
                settings = existing
                if existing.id == nil {
                    existing.id = "singleton"
                }
            } else {
                let initial = AppSettings()
                modelContext.insert(initial)
                settings = initial
            }
        } catch {
            let fallback = AppSettings()
            settings = fallback
            loadingError = "读取设置失败：\(error.localizedDescription)"
        }

        do {
            let descriptor = FetchDescriptor<WorkSession>(
                sortBy: [SortDescriptor(\WorkSession.startedAt)]
            )
            sessions = try modelContext.fetch(descriptor)
        } catch {
            sessions = []
            loadingError = "读取工作记录失败：\(error.localizedDescription)"
        }
        lastError = loadingError

        rollOverActiveSessionIfNeeded(at: now)
        _ = save()

        if startsTimer {
            timerCancellable = Timer.publish(
                every: 1,
                on: .main,
                in: .common
            )
            .autoconnect()
            .sink { [weak self] date in
                self?.tick(at: date)
            }
        }
    }

    deinit {
        timerCancellable?.cancel()
    }

    var isWorking: Bool {
        activeSession != nil
    }

    var currentWindow: ScheduleWindow {
        scheduleResolver.window(containing: now, settings: settings)
    }

    var summary: WorkSummary {
        let window = currentWindow
        let currentIntervals = sessions.compactMap { session -> WorkInterval? in
            let end = session.endedAt ?? now
            guard
                end > window.accountingStartsAt,
                session.startedAt < window.accountingEndsAt
            else {
                return nil
            }
            return session.workInterval
        }
        return payCalculator.summary(
            sessions: currentIntervals,
            now: now,
            window: window,
            isWorking: isWorking
        )
    }

    func toggleWorking() {
        toggleWorking(at: Date())
    }

    func toggleWorking(at date: Date) {
        tick(at: date)
        var openedSession: WorkSession?
        if let activeSession {
            activeSession.endedAt = date
        } else {
            openedSession = beginSession(at: date)
        }
        now = date
        if !save() {
            if let openedSession {
                sessions.removeAll(where: { $0.id == openedSession.id })
            }
            modelContext.rollback()
        }
        objectWillChange.send()
    }

    @discardableResult
    func applySettings(
        ratePerSecondText: String,
        workStartMinutes: Int,
        workEndMinutes: Int,
        paysAfterWork: Bool
    ) -> Bool {
        let normalizedRate = ratePerSecondText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard
            let rate = Decimal(
                string: normalizedRate,
                locale: Locale(identifier: "en_US_POSIX")
            ),
            rate > 0
        else {
            lastError = "秒薪必须是大于 0 的数字。"
            return false
        }
        guard
            (0..<(24 * 60)).contains(workStartMinutes),
            (0..<(24 * 60)).contains(workEndMinutes),
            workStartMinutes != workEndMinutes
        else {
            lastError = "上班时间和下班时间必须不同。"
            return false
        }

        let previousActive = activeSession
        let shouldResume = previousActive != nil
        let wasWaitingForNextShift = previousActive?.paidStartsAt.map {
            $0 > now
        } ?? false
        previousActive?.endedAt = now

        if settings.modelContext == nil {
            modelContext.insert(settings)
        }

        settings.ratePerSecondText = normalizedRate
        settings.workStartMinutes = workStartMinutes
        settings.workEndMinutes = workEndMinutes
        settings.paysAfterWork = paysAfterWork

        var resumedSession: WorkSession?
        if shouldResume {
            let newWindow = scheduleResolver.window(
                containing: now,
                settings: settings
            )
            let paidStartsAt = wasWaitingForNextShift
                && !paysAfterWork
                && newWindow.shiftStartsAt > now
                ? newWindow.shiftStartsAt
                : nil
            resumedSession = beginSession(
                at: now,
                paidStartsAt: paidStartsAt
            )
        }

        lastError = nil
        let didSave = save()
        if !didSave {
            if let resumedSession {
                sessions.removeAll(where: { $0.id == resumedSession.id })
            }
            modelContext.rollback()
        }
        objectWillChange.send()
        return didSave
    }

    func clearError() {
        lastError = nil
    }

    func tick(at date: Date = Date()) {
        now = date
        rollOverActiveSessionIfNeeded(at: date)
    }

    private var activeSession: WorkSession? {
        sessions.last(where: { $0.endedAt == nil })
    }

    @discardableResult
    private func beginSession(
        at date: Date,
        paidStartsAt: Date? = nil
    ) -> WorkSession {
        let window = scheduleResolver.window(containing: date, settings: settings)
        let session = WorkSession(
            startedAt: date,
            ratePerSecondText: settings.ratePerSecondText,
            shiftEndsAt: window.shiftEndsAt,
            paidStartsAt: paidStartsAt,
            accountingStartsAt: window.accountingStartsAt,
            accountingEndsAt: window.accountingEndsAt,
            paysAfterWork: settings.paysAfterWork
        )
        modelContext.insert(session)
        sessions.append(session)
        return session
    }

    private func rollOverActiveSessionIfNeeded(at date: Date) {
        var safetyCounter = 0
        while let active = activeSession,
              date >= active.accountingEndsAt,
              safetyCounter < 10_000 {
            let boundary = active.accountingEndsAt
            active.endedAt = boundary
            let nextWindow = scheduleResolver.window(
                containing: boundary,
                settings: settings
            )
            let carriesUnpaidOvertime =
                !active.paysAfterWork && boundary >= active.shiftEndsAt
            let paidStartsAt = carriesUnpaidOvertime
                && nextWindow.shiftStartsAt > boundary
                ? nextWindow.shiftStartsAt
                : nil
            beginSession(at: boundary, paidStartsAt: paidStartsAt)
            safetyCounter += 1
        }
        if safetyCounter > 0 {
            _ = save()
        }
    }

    @discardableResult
    private func save() -> Bool {
        do {
            try modelContext.save()
            return true
        } catch {
            lastError = "保存本地数据失败：\(error.localizedDescription)"
            return false
        }
    }
}
