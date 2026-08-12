import Foundation
import SwiftData

@Model
final class WorkSession {
    @Attribute(.unique) var id: UUID
    var startedAt: Date
    var endedAt: Date?
    var ratePerSecondText: String
    var shiftEndsAt: Date
    var paidStartsAt: Date?
    var accountingStartsAt: Date
    var accountingEndsAt: Date
    var paysAfterWork: Bool

    init(
        id: UUID = UUID(),
        startedAt: Date,
        endedAt: Date? = nil,
        ratePerSecondText: String,
        shiftEndsAt: Date,
        paidStartsAt: Date? = nil,
        accountingStartsAt: Date,
        accountingEndsAt: Date,
        paysAfterWork: Bool
    ) {
        self.id = id
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.ratePerSecondText = ratePerSecondText
        self.shiftEndsAt = shiftEndsAt
        self.paidStartsAt = paidStartsAt
        self.accountingStartsAt = accountingStartsAt
        self.accountingEndsAt = accountingEndsAt
        self.paysAfterWork = paysAfterWork
    }

    var ratePerSecond: Decimal {
        Decimal(string: ratePerSecondText, locale: Locale(identifier: "en_US_POSIX")) ?? 0
    }
}
