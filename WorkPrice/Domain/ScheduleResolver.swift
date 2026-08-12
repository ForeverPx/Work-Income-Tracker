import Foundation

struct ScheduleWindow: Equatable {
    let shiftStartsAt: Date
    let shiftEndsAt: Date
    let accountingStartsAt: Date
    let accountingEndsAt: Date
}

struct ScheduleResolver {
    var calendar: Calendar

    init(calendar: Calendar = .current) {
        self.calendar = calendar
    }

    func window(containing date: Date, settings: AppSettings) -> ScheduleWindow {
        window(
            containing: date,
            startMinutes: settings.workStartMinutes,
            endMinutes: settings.workEndMinutes
        )
    }

    func window(
        containing date: Date,
        startMinutes: Int,
        endMinutes: Int
    ) -> ScheduleWindow {
        let dayStart = calendar.startOfDay(for: date)

        if startMinutes < endMinutes {
            let nextDay = calendar.date(byAdding: .day, value: 1, to: dayStart)!
            return ScheduleWindow(
                shiftStartsAt: makeDate(on: dayStart, minutes: startMinutes),
                shiftEndsAt: makeDate(on: dayStart, minutes: endMinutes),
                accountingStartsAt: dayStart,
                accountingEndsAt: nextDay
            )
        }

        let minuteOfDay = calendar.component(.hour, from: date) * 60
            + calendar.component(.minute, from: date)
        let shiftStartDay: Date
        if minuteOfDay >= startMinutes {
            shiftStartDay = dayStart
        } else {
            shiftStartDay = calendar.date(byAdding: .day, value: -1, to: dayStart)!
        }

        let shiftEndDay = calendar.date(byAdding: .day, value: 1, to: shiftStartDay)!
        let nextShiftStartDay = shiftEndDay
        return ScheduleWindow(
            shiftStartsAt: makeDate(on: shiftStartDay, minutes: startMinutes),
            shiftEndsAt: makeDate(on: shiftEndDay, minutes: endMinutes),
            accountingStartsAt: makeDate(on: shiftStartDay, minutes: startMinutes),
            accountingEndsAt: makeDate(on: nextShiftStartDay, minutes: startMinutes)
        )
    }

    private func makeDate(on dayStart: Date, minutes: Int) -> Date {
        calendar.date(
            bySettingHour: minutes / 60,
            minute: minutes % 60,
            second: 0,
            of: dayStart,
            matchingPolicy: .nextTime,
            repeatedTimePolicy: .first,
            direction: .forward
        )!
    }
}
