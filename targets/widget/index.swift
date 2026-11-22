import WidgetKit
import SwiftUI

// MARK: - Data Models
struct WidgetOccasion: Codable {
    let name: String
    let date: String
    let daysRemaining: Int
    let deepLink: String
}

struct WidgetItemPreview: Codable {
    let title: String
    let price: String
    let deepLink: String
}

struct WidgetDataSnapshot: Codable {
    let isLoggedIn: Bool
    let nextOccasion: WidgetOccasion?
    let wishlistPreview: [WidgetItemPreview]?
}

// MARK: - Timeline Entry
struct WishlistEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetDataSnapshot
}

// MARK: - Timeline Provider
struct WishlistProvider: TimelineProvider {
    let appGroupSuite = "group.com.calebsiegel.wishlist"

    func placeholder(in context: Context) -> WishlistEntry {
        WishlistEntry(
            date: Date(),
            snapshot: WidgetDataSnapshot(
                isLoggedIn: true,
                nextOccasion: WidgetOccasion(name: "Birthday", date: "Oct 24", daysRemaining: 14, deepLink: "wishlist://occasions"),
                wishlistPreview: [
                    WidgetItemPreview(title: "Headphones", price: "$49.99", deepLink: "wishlist://my-list"),
                    WidgetItemPreview(title: "Wool Sweater", price: "$65.00", deepLink: "wishlist://my-list")
                ]
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (WishlistEntry) -> ()) {
        completion(loadCurrentData())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WishlistEntry>) -> ()) {
        let entry = loadCurrentData()
        // Refresh every 2 hours
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 2, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadCurrentData() -> WishlistEntry {
        guard let userDefaults = UserDefaults(suiteName: appGroupSuite),
              let jsonString = userDefaults.string(forKey: "wishlist_widget_snapshot"),
              let data = jsonString.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(WidgetDataSnapshot.self, from: data) else {
            return WishlistEntry(
                date: Date(),
                snapshot: WidgetDataSnapshot(isLoggedIn: false, nextOccasion: nil, wishlistPreview: nil)
            )
        }

        return WishlistEntry(date: Date(), snapshot: decoded)
    }
}

// MARK: - Views
struct WishlistWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: WishlistProvider.Entry

    var body: some View {
        if !entry.snapshot.isLoggedIn {
            SignedOutView()
        } else {
            switch family {
            case .systemMedium:
                MediumWidgetView(snapshot: entry.snapshot)
            default:
                SmallWidgetView(snapshot: entry.snapshot)
            }
        }
    }
}

// Small Widget: Next upcoming occasion countdown
struct SmallWidgetView: View {
    let snapshot: WidgetDataSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "gift.fill")
                    .foregroundColor(Color.indigo)
                    .font(.system(size: 16))
                Spacer()
                if let occasion = snapshot.nextOccasion {
                    Text("\(occasion.daysRemaining)d")
                        .font(.system(size: 13, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.indigo.opacity(0.15))
                        .foregroundColor(Color.indigo)
                        .clipShape(Capsule())
                }
            }

            Spacer()

            if let occasion = snapshot.nextOccasion {
                Text(occasion.name)
                    .font(.system(size: 16, weight: .bold))
                    .lineLimit(2)

                Text(occasion.date)
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            } else {
                Text("No Upcoming Occasions")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .widgetURL(URL(string: snapshot.nextOccasion?.deepLink ?? "wishlist://occasions"))
    }
}

// Medium Widget: Next occasion on left + wishlist preview on right
struct MediumWidgetView: View {
    let snapshot: WidgetDataSnapshot

    var body: some View {
        HStack(spacing: 16) {
            // Left column: Next Occasion
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: "calendar")
                        .foregroundColor(Color.indigo)
                    Text("Occasion")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.secondary)
                }

                if let occasion = snapshot.nextOccasion {
                    Text(occasion.name)
                        .font(.system(size: 16, weight: .bold))
                        .lineLimit(2)

                    Text(occasion.daysRemaining == 0 ? "Today! 🎉" : "in \(occasion.daysRemaining) days")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color.indigo)

                    Text(occasion.date)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                } else {
                    Text("No dates set")
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Divider()

            // Right column: Wishlist Preview
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: "heart.fill")
                        .foregroundColor(Color.pink)
                    Text("Wishlist Ideas")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.secondary)
                }

                if let items = snapshot.wishlistPreview, !items.isEmpty {
                    ForEach(items.prefix(2), id: \.title) { item in
                        VStack(alignment: .leading, spacing: 1) {
                            Text(item.title)
                                .font(.system(size: 12, weight: .medium))
                                .lineLimit(1)
                            Text(item.price)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.secondary)
                        }
                    }
                } else {
                    Text("Open app to add gift ideas")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .widgetURL(URL(string: snapshot.nextOccasion?.deepLink ?? "wishlist://my-list"))
    }
}

// Signed Out Placeholder View
struct SignedOutView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "lock.shield")
                .font(.system(size: 24))
                .foregroundColor(.secondary)
            Text("Gift Wishlist")
                .font(.system(size: 14, weight: .bold))
            Text("Open app to sign in")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
        }
        .padding()
        .widgetURL(URL(string: "wishlist://sign-in"))
    }
}

// MARK: - Main Widget Entrypoint
@main
struct WishlistWidget: Widget {
    let kind: String = "WishlistWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WishlistProvider()) { entry in
            WishlistWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Gift Wishlist")
        .description("Glance at upcoming occasions and your saved gift ideas.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
