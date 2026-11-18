import SwiftUI

struct SettingsSheet: View {
    @Environment(Table.self) private var table
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        @Bindable var table = table
        NavigationStack {
            Form {
                Section {
                    Picker("Difficulty", selection: $table.settings.level) {
                        ForEach(Level.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    Picker("Faan minimum", selection: $table.settings.minFaan) {
                        ForEach([0, 1, 2, 3, 5], id: \.self) { Text("\($0)").tag($0) }
                    }
                    Picker("Between turns", selection: $table.turnSeconds) {
                        ForEach([1.0, 3.0, 5.0, 7.0, 10.0], id: \.self) {
                            Text("\(Int($0)) second\($0 == 1 ? "" : "s")").tag($0)
                        }
                    }
                    Toggle("Play with coach", isOn: $table.coach)
                } footer: {
                    Text(table.settings.minFaan > 0
                         ? "A hand has to be worth \(table.settings.minFaan) faan before it can be declared, which is what makes the game about value rather than speed. A match is four rounds, East through North, and the deal passes each hand unless East wins it."
                         : "With no minimum any four sets and a pair can be declared, and the hand becomes a race. A match is four rounds, East through North.")
                }
                Section {
                    Button("Start new match") {
                        table.newMatch()
                        dismiss()
                    }
                }
            }
            .navigationTitle("Match")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

struct ReviewSheet: View {
    @Environment(Table.self) private var table
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let reading = table.review()
        NavigationStack {
            List {
                if !table.finalScores.isEmpty {
                    Section("The hands") {
                        ForEach(table.finalScores) { row in
                            VStack(alignment: .leading, spacing: 3) {
                                HStack {
                                    Text("\(row.mark)  \(row.name)")
                                        .fontWeight(row.won ? .semibold : .regular)
                                    Spacer()
                                    Text(row.score).foregroundStyle(.secondary)
                                }
                                if !row.note.isEmpty {
                                    Text(row.note).font(.footnote).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
                Section("What went well") {
                    ForEach(reading.well, id: \.self) { Text($0).font(.callout) }
                }
                Section("What to work on") {
                    ForEach(reading.work, id: \.self) { Text($0).font(.callout) }
                }
                if !reading.every.isEmpty {
                    Section("Every discard and call") {
                        ForEach(Array(reading.every.enumerated()), id: \.offset) { _, line in
                            Text(line).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
                Section {
                    Text("The coach measures standard hand shape and suggests faan paths. Improving copies count unseen tiles, including tiles opponents may hold.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle(table.match.winner == nil ? "Hand review" : "Match review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}
