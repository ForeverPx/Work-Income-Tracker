import SwiftData
import XCTest
@testable import WorkPrice

final class ScheduleResolverTests: XCTestCase {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    func testSameDayScheduleUsesCalendarDayForAccounting() {
        let resolver = ScheduleResolver(calendar: calendar)
        let now = date(2026, 8, 11, 12, 0)

        let window = resolver.window(
            containing: now,
            startMinutes: 9 * 60,
            endMinutes: 18 * 60
        )

        XCTAssertEqual(window.shiftStartsAt, date(2026, 8, 11, 9, 0))
        XCTAssertEqual(window.shiftEndsAt, date(2026, 8, 11, 18, 0))
        XCTAssertEqual(window.accountingStartsAt, date(2026, 8, 11, 0, 0))
        XCTAssertEqual(window.accountingEndsAt, date(2026, 8, 12, 0, 0))
    }

    func testCrossMidnightScheduleKeepsPreviousShiftDuringDaytimeGap() {
        let resolver = ScheduleResolver(calendar: calendar)

        let beforeEnd = resolver.window(
            containing: date(2026, 8, 12, 2, 0),
            startMinutes: 22 * 60,
            endMinutes: 6 * 60
        )
        let afterEnd = resolver.window(
            containing: date(2026, 8, 12, 12, 0),
            startMinutes: 22 * 60,
            endMinutes: 6 * 60
        )

        XCTAssertEqual(beforeEnd.shiftStartsAt, date(2026, 8, 11, 22, 0))
        XCTAssertEqual(beforeEnd.shiftEndsAt, date(2026, 8, 12, 6, 0))
        XCTAssertEqual(afterEnd, beforeEnd)
        XCTAssertEqual(afterEnd.accountingEndsAt, date(2026, 8, 12, 22, 0))
    }

    func testCrossMidnightScheduleRollsAtNextStart() {
        let resolver = ScheduleResolver(calendar: calendar)
        let window = resolver.window(
            containing: date(2026, 8, 12, 22, 0),
            startMinutes: 22 * 60,
            endMinutes: 6 * 60
        )

        XCTAssertEqual(window.shiftStartsAt, date(2026, 8, 12, 22, 0))
        XCTAssertEqual(window.shiftEndsAt, date(2026, 8, 13, 6, 0))
    }

    func testScheduleUsesLocalClockTimeAcrossDaylightSavingChange() {
        var berlin = Calendar(identifier: .gregorian)
        berlin.timeZone = TimeZone(identifier: "Europe/Berlin")!
        let now = berlin.date(from: DateComponents(
            year: 2026,
            month: 3,
            day: 29,
            hour: 12
        ))!

        let window = ScheduleResolver(calendar: berlin).window(
            containing: now,
            startMinutes: 9 * 60,
            endMinutes: 18 * 60
        )

        XCTAssertEqual(berlin.component(.hour, from: window.shiftStartsAt), 9)
        XCTAssertEqual(berlin.component(.hour, from: window.shiftEndsAt), 18)
    }

    private func date(
        _ year: Int,
        _ month: Int,
        _ day: Int,
        _ hour: Int,
        _ minute: Int
    ) -> Date {
        calendar.date(from: DateComponents(
            year: year,
            month: month,
            day: day,
            hour: hour,
            minute: minute
        ))!
    }
}

final class PayCalculatorTests: XCTestCase {
    func testUnpaidOvertimeStopsEarningsButKeepsWorkingDuration() {
        let start = Date(timeIntervalSince1970: 0)
        let shiftEnd = start.addingTimeInterval(9 * 3600)
        let now = start.addingTimeInterval(10 * 3600)
        let session = makeSession(
            start: start,
            end: now,
            rate: "1",
            shiftEnd: shiftEnd,
            paysAfterWork: false
        )

        let summary = PayCalculator().summary(
            sessions: [session],
            now: now,
            window: window(start: start, end: now),
            isWorking: false
        )

        XCTAssertEqual(summary.earned, Decimal(9 * 3600))
        XCTAssertEqual(summary.workedDuration, 10 * 3600)
        XCTAssertEqual(summary.unpaidDuration, 3600)
    }

    func testPaidOvertimeContinuesEarningsAndHasNoUnpaidDuration() {
        let start = Date(timeIntervalSince1970: 0)
        let now = start.addingTimeInterval(10 * 3600)
        let session = makeSession(
            start: start,
            end: now,
            rate: "1",
            shiftEnd: start.addingTimeInterval(9 * 3600),
            paysAfterWork: true
        )

        let summary = PayCalculator().summary(
            sessions: [session],
            now: now,
            window: window(start: start, end: now),
            isWorking: false
        )

        XCTAssertEqual(summary.earned, Decimal(10 * 3600))
        XCTAssertEqual(summary.unpaidDuration, 0)
    }

    func testRestGapIsNotCountedAcrossMultipleSessions() {
        let start = Date(timeIntervalSince1970: 0)
        let first = makeSession(
            start: start,
            end: start.addingTimeInterval(3600),
            rate: "0.5",
            shiftEnd: start.addingTimeInterval(8 * 3600),
            paysAfterWork: false
        )
        let second = makeSession(
            start: start.addingTimeInterval(2 * 3600),
            end: start.addingTimeInterval(3 * 3600),
            rate: "0.5",
            shiftEnd: start.addingTimeInterval(8 * 3600),
            paysAfterWork: false
        )

        let summary = PayCalculator().summary(
            sessions: [first, second],
            now: start.addingTimeInterval(4 * 3600),
            window: window(
                start: start,
                end: start.addingTimeInterval(24 * 3600)
            ),
            isWorking: false
        )

        XCTAssertEqual(summary.workedDuration, 2 * 3600)
        XCTAssertEqual(summary.earned, Decimal(3600))
    }

    func testCarriedOvertimeStaysUnpaidUntilNextShiftStarts() {
        let midnight = Date(timeIntervalSince1970: 0)
        let shiftStart = midnight.addingTimeInterval(9 * 3600)
        let now = shiftStart.addingTimeInterval(60)
        let session = WorkInterval(
            startedAt: midnight,
            endedAt: nil,
            ratePerSecond: 1,
            shiftEndsAt: midnight.addingTimeInterval(18 * 3600),
            paidStartsAt: shiftStart,
            paysAfterWork: false
        )

        let summary = PayCalculator().summary(
            sessions: [session],
            now: now,
            window: window(
                start: midnight,
                end: midnight.addingTimeInterval(24 * 3600)
            ),
            isWorking: true
        )

        XCTAssertEqual(summary.earned, 60)
        XCTAssertEqual(summary.workedDuration, 9 * 3600 + 60)
        XCTAssertEqual(summary.unpaidDuration, 9 * 3600)
    }

    private func makeSession(
        start: Date,
        end: Date,
        rate: String,
        shiftEnd: Date,
        paysAfterWork: Bool
    ) -> WorkInterval {
        WorkInterval(
            startedAt: start,
            endedAt: end,
            ratePerSecond: Decimal(
                string: rate,
                locale: Locale(identifier: "en_US_POSIX")
            )!,
            shiftEndsAt: shiftEnd,
            paidStartsAt: nil,
            paysAfterWork: paysAfterWork
        )
    }

    private func window(start: Date, end: Date) -> ScheduleWindow {
        ScheduleWindow(
            shiftStartsAt: start,
            shiftEndsAt: end,
            accountingStartsAt: start,
            accountingEndsAt: end
        )
    }
}

final class WorkStateStoreTests: XCTestCase {
    @MainActor
    func testToggleCreatesAndClosesSession() throws {
        let container = try makeContainer()
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let store = WorkStateStore(
            modelContext: container.mainContext,
            now: start,
            startsTimer: false
        )

        store.toggleWorking(at: start)
        XCTAssertTrue(store.isWorking)

        let end = start.addingTimeInterval(125)
        store.toggleWorking(at: end)
        XCTAssertFalse(store.isWorking)
        XCTAssertEqual(store.sessions.count, 1)
        XCTAssertEqual(store.sessions[0].endedAt, end)
    }

    @MainActor
    func testChangingSettingsWhileWorkingSplitsRateSnapshot() throws {
        let container = try makeContainer()
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let store = WorkStateStore(
            modelContext: container.mainContext,
            now: start,
            startsTimer: false
        )
        store.toggleWorking(at: start)
        store.tick(at: start.addingTimeInterval(60))

        XCTAssertTrue(store.applySettings(
            ratePerSecondText: "1.25",
            workStartMinutes: 9 * 60,
            workEndMinutes: 18 * 60,
            paysAfterWork: true
        ))

        XCTAssertEqual(store.sessions.count, 2)
        XCTAssertNotNil(store.sessions[0].endedAt)
        XCTAssertEqual(store.sessions[0].ratePerSecondText, "0.0367")
        XCTAssertEqual(store.sessions[1].ratePerSecondText, "1.25")
        XCTAssertNil(store.sessions[1].endedAt)
    }

    @MainActor
    func testOpenSessionIsRecoveredByNewStore() throws {
        let container = try makeContainer()
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let firstStore = WorkStateStore(
            modelContext: container.mainContext,
            now: start,
            startsTimer: false
        )
        firstStore.toggleWorking(at: start)

        let restored = WorkStateStore(
            modelContext: container.mainContext,
            now: start.addingTimeInterval(60),
            startsTimer: false
        )

        XCTAssertTrue(restored.isWorking)
        XCTAssertEqual(restored.sessions.count, 1)
        XCTAssertEqual(restored.summary.workedDuration, 60, accuracy: 0.001)
    }

    @MainActor
    func testActiveSessionRollsAtAccountingBoundary() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let start = calendar.date(from: DateComponents(
            year: 2026,
            month: 8,
            day: 11,
            hour: 23,
            minute: 59
        ))!
        let midnight = calendar.date(byAdding: .minute, value: 1, to: start)!
        let now = calendar.date(byAdding: .minute, value: 1, to: midnight)!
        let container = try makeContainer()
        let store = WorkStateStore(
            modelContext: container.mainContext,
            now: start,
            startsTimer: false,
            calendar: calendar
        )

        store.toggleWorking(at: start)
        store.tick(at: now)

        XCTAssertEqual(store.sessions.count, 2)
        XCTAssertEqual(store.sessions[0].endedAt, midnight)
        XCTAssertEqual(store.sessions[1].startedAt, midnight)
        XCTAssertEqual(
            store.sessions[1].paidStartsAt,
            calendar.date(byAdding: .hour, value: 9, to: midnight)
        )
        XCTAssertNil(store.sessions[1].endedAt)
        XCTAssertEqual(store.summary.workedDuration, 60, accuracy: 0.001)
        XCTAssertEqual(store.summary.unpaidDuration, 60, accuracy: 0.001)
        XCTAssertEqual(store.summary.earned, 0)

        XCTAssertTrue(store.applySettings(
            ratePerSecondText: "0.05",
            workStartMinutes: 9 * 60,
            workEndMinutes: 18 * 60,
            paysAfterWork: false
        ))
        XCTAssertEqual(store.sessions.count, 3)
        XCTAssertEqual(
            store.sessions[2].paidStartsAt,
            calendar.date(byAdding: .hour, value: 9, to: midnight)
        )
    }

    @MainActor
    func testRejectsInvalidSettingsWithoutChangingStoredValues() throws {
        let container = try makeContainer()
        let store = WorkStateStore(
            modelContext: container.mainContext,
            startsTimer: false
        )
        let originalRate = store.settings.ratePerSecondText

        XCTAssertFalse(store.applySettings(
            ratePerSecondText: "abc",
            workStartMinutes: 9 * 60,
            workEndMinutes: 18 * 60,
            paysAfterWork: false
        ))
        XCTAssertEqual(store.settings.ratePerSecondText, originalRate)
        XCTAssertNotNil(store.lastError)
    }

    @MainActor
    private func makeContainer() throws -> ModelContainer {
        let schema = Schema([AppSettings.self, WorkSession.self])
        let configuration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: true
        )
        return try ModelContainer(for: schema, configurations: [configuration])
    }
}
