import Foundation
import SwiftUI

/// Shared with the app (src/widgets/iosPayload.ts). Keep both sides in sync.
enum SharedStore {
  static let appGroup = "group.dev.habits.app"
  static let snapshotKey = "widgetSnapshot"
  static let pendingActionsKey = "pendingWidgetActions"

  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  static func loadSnapshot() -> WidgetSnapshot? {
    guard let json = defaults?.string(forKey: snapshotKey),
          let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
  }

  static func saveSnapshot(_ snapshot: WidgetSnapshot) {
    guard let data = try? JSONEncoder().encode(snapshot),
          let json = String(data: data, encoding: .utf8) else { return }
    defaults?.set(json, forKey: snapshotKey)
  }

  /// Appends a quick action; the app applies the queue to its database when it becomes active.
  static func enqueueAction(habitId: String, date: String) {
    var queue: [[String: String]] = []
    if let json = defaults?.string(forKey: pendingActionsKey),
       let data = json.data(using: .utf8),
       let existing = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] {
      queue = existing
    }
    queue.append(["habitId": habitId, "date": date])
    if let data = try? JSONSerialization.data(withJSONObject: queue),
       let json = String(data: data, encoding: .utf8) {
      defaults?.set(json, forKey: pendingActionsKey)
    }
  }
}

struct HabitColors: Codable, Hashable {
  let solid: String
  let onSolid: String
}

struct ThemePalette: Codable, Hashable {
  let background: String
  let text: String
  let textMuted: String
  let primary: String
  let track: String
  let outline: String
}

struct WidgetHabit: Codable, Hashable, Identifiable {
  let id: String
  let name: String
  var done: Bool
  var progress: Double
  let detail: String
  /// "toggle" | "increment" | "open"
  let action: String
  let light: HabitColors
  let dark: HabitColors
}

struct WidgetSnapshot: Codable {
  let date: String
  var completed: Int
  let total: Int
  var habits: [WidgetHabit]
  /// Weeks (columns) × 7 days; -1 = the day does not count.
  let heatmap: [[Double]]
  let light: ThemePalette
  let dark: ThemePalette

  func palette(_ scheme: ColorScheme) -> ThemePalette { scheme == .dark ? dark : light }

  /// Local "yyyy-MM-dd" of today, same format as the app.
  static func todayString(_ date: Date = Date()) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  /// True when the snapshot was generated today (otherwise the list is stale until the app opens).
  var isToday: Bool { date == WidgetSnapshot.todayString() }
}

extension Color {
  /// "#rrggbb" or "#rrggbbaa".
  init(hex: String) {
    var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if value.hasPrefix("#") { value.removeFirst() }
    var rgba: UInt64 = 0
    Scanner(string: value).scanHexInt64(&rgba)
    let hasAlpha = value.count == 8
    let r = Double((rgba >> (hasAlpha ? 24 : 16)) & 0xff) / 255
    let g = Double((rgba >> (hasAlpha ? 16 : 8)) & 0xff) / 255
    let b = Double((rgba >> (hasAlpha ? 8 : 0)) & 0xff) / 255
    let a = hasAlpha ? Double(rgba & 0xff) / 255 : 1
    self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
  }
}
