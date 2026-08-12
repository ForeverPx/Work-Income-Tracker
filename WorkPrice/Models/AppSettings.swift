import Foundation
import SwiftData

@Model
final class AppSettings {
    @Attribute(.unique) var id: String?
    var ratePerSecondText: String
    var workStartMinutes: Int
    var workEndMinutes: Int
    var paysAfterWork: Bool

    init(
        id: String? = "singleton",
        ratePerSecondText: String = "0.0367",
        workStartMinutes: Int = 9 * 60,
        workEndMinutes: Int = 18 * 60,
        paysAfterWork: Bool = false
    ) {
        self.id = id
        self.ratePerSecondText = ratePerSecondText
        self.workStartMinutes = workStartMinutes
        self.workEndMinutes = workEndMinutes
        self.paysAfterWork = paysAfterWork
    }

    var ratePerSecond: Decimal {
        Decimal(string: ratePerSecondText, locale: Locale(identifier: "en_US_POSIX")) ?? 0
    }
}
