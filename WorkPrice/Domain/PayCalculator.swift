import Foundation

struct WorkInterval: Equatable {
    let startedAt: Date
    let endedAt: Date?
    let ratePerSecond: Decimal
    let shiftEndsAt: Date
    let paidStartsAt: Date?
    let paysAfterWork: Bool
}

struct WorkSummary: Equatable {
    var earned: Decimal = 0
    var workedDuration: TimeInterval = 0
    var unpaidDuration: TimeInterval = 0
    var countdownDuration: TimeInterval = 0
    var isWorking = false
}

struct PayCalculator {
    func summary(
        sessions: [WorkInterval],
        now: Date,
        window: ScheduleWindow,
        isWorking: Bool
    ) -> WorkSummary {
        var result = WorkSummary(
            countdownDuration: max(0, window.shiftEndsAt.timeIntervalSince(now)),
            isWorking: isWorking
        )

        for session in sessions {
            let sessionEnd = min(session.endedAt ?? now, now)
            let start = max(session.startedAt, window.accountingStartsAt)
            let end = min(sessionEnd, window.accountingEndsAt)
            guard end > start else { continue }

            result.workedDuration += end.timeIntervalSince(start)

            let paidDuration: TimeInterval
            if session.paysAfterWork {
                paidDuration = end.timeIntervalSince(start)
            } else {
                let paidStart = max(start, session.paidStartsAt ?? start)
                let paidEnd = min(end, session.shiftEndsAt)
                paidDuration = max(0, paidEnd.timeIntervalSince(paidStart))
                result.unpaidDuration += end.timeIntervalSince(start) - paidDuration
            }

            let seconds = NSDecimalNumber(value: paidDuration).decimalValue
            result.earned += seconds * session.ratePerSecond
        }

        return result
    }
}

extension WorkSession {
    var workInterval: WorkInterval {
        WorkInterval(
            startedAt: startedAt,
            endedAt: endedAt,
            ratePerSecond: ratePerSecond,
            shiftEndsAt: shiftEndsAt,
            paidStartsAt: paidStartsAt,
            paysAfterWork: paysAfterWork
        )
    }
}
