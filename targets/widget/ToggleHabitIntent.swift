import AppIntents
import WidgetKit

/// Quick check from the widget (iOS 17+). The widget extension cannot open the app's SQLite
/// database, so it queues the action for the app and updates the snapshot optimistically.
struct ToggleHabitIntent: AppIntent {
  static var title: LocalizedStringResource = "Marcar hábito"
  static var isDiscoverable = false

  @Parameter(title: "Hábito")
  var habitId: String

  init() {}

  init(habitId: String) {
    self.habitId = habitId
  }

  func perform() async throws -> some IntentResult {
    guard var snapshot = SharedStore.loadSnapshot(), snapshot.isToday,
          let index = snapshot.habits.firstIndex(where: { $0.id == habitId }) else {
      return .result()
    }
    SharedStore.enqueueAction(habitId: habitId, date: snapshot.date)

    var habit = snapshot.habits[index]
    if habit.action == "toggle" {
      habit.done.toggle()
      habit.progress = habit.done ? 1 : 0
      snapshot.completed += habit.done ? 1 : -1
      snapshot.habits[index] = habit
      SharedStore.saveSnapshot(snapshot)
    }
    // "increment": the exact new value is computed by the app; the list refreshes when it opens.
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}
