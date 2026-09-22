import SwiftUI
import WidgetKit

@main
struct HabitsWidgetBundle: WidgetBundle {
  var body: some Widget {
    TodayWidget()
    HeatmapWidget()
  }
}

// MARK: - Timeline

struct SnapshotEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
}

struct SnapshotProvider: TimelineProvider {
  func placeholder(in context: Context) -> SnapshotEntry {
    SnapshotEntry(date: Date(), snapshot: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
    completion(SnapshotEntry(date: Date(), snapshot: SharedStore.loadSnapshot()))
  }

  /// One entry now and one right after midnight, so a stale "today" list is hidden at day change.
  func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
    let now = Date()
    let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86_400))
    let snapshot = SharedStore.loadSnapshot()
    completion(Timeline(
      entries: [
        SnapshotEntry(date: now, snapshot: snapshot),
        SnapshotEntry(date: midnight.addingTimeInterval(60), snapshot: snapshot),
      ],
      policy: .after(midnight.addingTimeInterval(60))
    ))
  }
}

/// Background from the app palette (light/dark), falling back to the system background.
struct WidgetBackground: View {
  let snapshot: WidgetSnapshot?
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    if let snapshot {
      Color(hex: snapshot.palette(scheme).background)
    } else {
      Color(.systemBackground)
    }
  }
}

// MARK: - Today widget

struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TodayWidget", provider: SnapshotProvider()) { entry in
      TodayWidgetView(entry: entry)
        .containerBackground(for: .widget) { WidgetBackground(snapshot: entry.snapshot) }
    }
    .configurationDisplayName("Hábitos de hoje")
    .description("Marque seus hábitos direto da tela inicial.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

struct TodayWidgetView: View {
  let entry: SnapshotEntry
  @Environment(\.colorScheme) private var scheme
  @Environment(\.widgetFamily) private var family

  private var maxRows: Int {
    switch family {
    case .systemSmall: return 3
    case .systemMedium: return 3
    default: return 8
    }
  }

  var body: some View {
    if let snapshot = entry.snapshot, snapshot.isToday {
      let palette = snapshot.palette(scheme)
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text("Hoje").font(.headline).foregroundStyle(Color(hex: palette.text))
          Spacer()
          if snapshot.total > 0 {
            Text("\(snapshot.completed)/\(snapshot.total)")
              .font(.subheadline)
              .foregroundStyle(Color(hex: palette.textMuted))
          }
        }
        ProgressView(value: snapshot.total > 0 ? Double(snapshot.completed) / Double(snapshot.total) : 0)
          .tint(Color(hex: palette.primary))
        if snapshot.habits.isEmpty {
          Text("Nenhum hábito para hoje")
            .font(.subheadline)
            .foregroundStyle(Color(hex: palette.textMuted))
        }
        ForEach(snapshot.habits.prefix(maxRows)) { habit in
          HabitRow(habit: habit, palette: palette, compact: family == .systemSmall)
        }
        Spacer(minLength: 0)
      }
    } else {
      VStack(spacing: 6) {
        Image(systemName: "checkmark.circle")
          .font(.title)
        Text("Abra o app para atualizar")
          .font(.caption)
          .multilineTextAlignment(.center)
      }
      .foregroundStyle(.secondary)
    }
  }
}

struct HabitRow: View {
  let habit: WidgetHabit
  let palette: ThemePalette
  let compact: Bool
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    let colors = scheme == .dark ? habit.dark : habit.light
    let row = HStack(spacing: 8) {
      ZStack {
        Circle()
          .strokeBorder(Color(hex: colors.solid), lineWidth: 2)
          .background(Circle().fill(habit.done ? Color(hex: colors.solid) : Color.clear))
        if habit.done {
          Image(systemName: "checkmark").font(.caption.bold()).foregroundStyle(Color(hex: colors.onSolid))
        } else if habit.action == "increment" {
          Image(systemName: "plus").font(.caption.bold()).foregroundStyle(Color(hex: colors.solid))
        }
      }
      .frame(width: 24, height: 24)
      VStack(alignment: .leading, spacing: 0) {
        Text(habit.name).font(.subheadline.weight(.semibold)).lineLimit(1)
          .foregroundStyle(Color(hex: palette.text))
        if !compact && !habit.detail.isEmpty {
          Text(habit.detail).font(.caption2).lineLimit(1)
            .foregroundStyle(Color(hex: palette.textMuted))
        }
      }
      Spacer(minLength: 0)
    }

    if habit.action == "open" {
      Link(destination: URL(string: "habits://")!) { row }
    } else {
      Button(intent: ToggleHabitIntent(habitId: habit.id)) { row }
        .buttonStyle(.plain)
    }
  }
}

// MARK: - Heatmap widget

struct HeatmapWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "HeatmapWidget", provider: SnapshotProvider()) { entry in
      HeatmapWidgetView(entry: entry)
        .containerBackground(for: .widget) { WidgetBackground(snapshot: entry.snapshot) }
    }
    .configurationDisplayName("Mapa de hábitos")
    .description("Suas últimas semanas em um mapa de calor.")
    .supportedFamilies([.systemMedium])
  }
}

struct HeatmapWidgetView: View {
  let entry: SnapshotEntry
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    if let snapshot = entry.snapshot {
      let palette = snapshot.palette(scheme)
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text("Últimas semanas").font(.subheadline.bold()).foregroundStyle(Color(hex: palette.text))
          Spacer()
          if snapshot.isToday && snapshot.total > 0 {
            Text("Hoje \(snapshot.completed)/\(snapshot.total)")
              .font(.caption)
              .foregroundStyle(Color(hex: palette.textMuted))
          }
        }
        HeatmapGrid(heatmap: snapshot.heatmap, palette: palette)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    } else {
      Text("Abra o app para atualizar").font(.caption).foregroundStyle(.secondary)
    }
  }
}

/// Same intensity levels as the app: one hue at 4 opacities; days that do not count are outlined.
struct HeatmapGrid: View {
  let heatmap: [[Double]]
  let palette: ThemePalette

  private func fill(_ value: Double) -> Color {
    if value <= 0 { return Color(hex: palette.track) }
    let alphas = [0.3, 0.5, 0.75, 1.0]
    let level = min(4, Int((value * 4).rounded(.up)))
    return Color(hex: palette.primary).opacity(alphas[level - 1])
  }

  var body: some View {
    GeometryReader { geometry in
      let columns = max(1, heatmap.count)
      let gap: CGFloat = 3
      let cell = min(
        (geometry.size.width - gap * CGFloat(columns - 1)) / CGFloat(columns),
        (geometry.size.height - gap * 6) / 7
      )
      HStack(spacing: gap) {
        ForEach(Array(heatmap.enumerated()), id: \.offset) { _, week in
          VStack(spacing: gap) {
            ForEach(Array(week.enumerated()), id: \.offset) { _, value in
              if value < 0 {
                RoundedRectangle(cornerRadius: 2)
                  .strokeBorder(Color(hex: palette.outline), lineWidth: 1)
                  .frame(width: cell, height: cell)
              } else {
                RoundedRectangle(cornerRadius: 2)
                  .fill(fill(value))
                  .frame(width: cell, height: cell)
              }
            }
          }
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }
}
