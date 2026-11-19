import SwiftUI

/* Settings is the match panel the play screen otherwise keeps off the table: a card over
   the felt in the same lacquer the rest of the screen is in, on a #2a0500a8 scrim, with
   room beside it to tap the table and close it. */
struct SettingsCard: View {
    @Environment(Table.self) private var table
    var close: () -> Void

    var body: some View {
        @Bindable var table = table
        ZStack {
            Color(red: 42/255, green: 5/255, blue: 0).opacity(0.66)
                .ignoresSafeArea()
                .onTapGesture(perform: close)

            VStack(alignment: .leading, spacing: 12) {
                row("Difficulty") {
                    Picker("", selection: $table.settings.level) {
                        ForEach(Level.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                }
                row("Faan minimum") {
                    Picker("", selection: $table.settings.minFaan) {
                        ForEach([0, 1, 2, 3, 5], id: \.self) { Text("\($0)").tag($0) }
                    }
                }
                row("Between turns") {
                    Picker("", selection: $table.turnSeconds) {
                        ForEach([1.0, 3.0, 5.0, 7.0, 10.0], id: \.self) {
                            Text("\(Int($0)) second\($0 == 1 ? "" : "s")").tag($0)
                        }
                    }
                }
                HStack {
                    Text("Play with coach").font(MG.mono(11.7)).foregroundStyle(Lacquer.cream)
                    Spacer()
                    Toggle("", isOn: $table.coach).labelsHidden().tint(Lacquer.gold)
                }

                Text(table.settings.minFaan > 0
                     ? "A hand has to be worth \(table.settings.minFaan) faan before it can be declared, which is what makes the game about value rather than speed. A match is four rounds, East through North, and the deal passes each hand unless East wins it."
                     : "With no minimum any four sets and a pair can be declared, and the hand becomes a race. A match is four rounds, East through North, and the deal passes each hand unless East wins it.")
                    .webType(MG.display(13), lineHeight: 18.72, over: MG.uiDisplay(13))
                    .foregroundStyle(Lacquer.warm)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)

                Button {
                    table.newMatch()
                    close()
                } label: {
                    Text("Start new match")
                        .font(MG.mono(11))
                        .tracking(11 * 0.07)
                        .textCase(.uppercase)
                        .padding(.vertical, 9)
                        .padding(.horizontal, 13)
                        .frame(maxWidth: .infinity, minHeight: 38)
                        .background(Lacquer.cream, in: RoundedRectangle(cornerRadius: 5))
                        .foregroundStyle(Lacquer.deep)
                }
                .padding(.top, 4)
            }
            .padding(22)
            .frame(maxWidth: 420)
            .background(Color(red: 122/255, green: 3/255, blue: 0),
                        in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color(red: 1, green: 0.878, blue: 0.796).opacity(0.33))
            }
            .shadow(color: Color(red: 29/255, green: 3/255, blue: 0).opacity(0.48), radius: 25, y: 18)
            .padding(.horizontal, 36)
        }
    }

    private func row<Content: View>(_ title: String, @ViewBuilder control: () -> Content) -> some View {
        HStack(spacing: 14) {
            Text(title).font(MG.mono(11.7)).foregroundStyle(Lacquer.cream)
            Spacer(minLength: 0)
            control()
                .pickerStyle(.menu)
                .tint(Lacquer.gold)
                .font(MG.mono(11.7))
                .fixedSize()
        }
    }
}

/* The review the coach offers once a hand is over: the same card, with the count of each
   hand and what the discards said about how it was played. */
struct ReviewSheet: View {
    @Environment(Table.self) private var table
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let reading = table.review()
        ZStack {
            Color.clear.lacquerGround()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(table.match.winner == nil ? "Hand review" : "Match review")
                        .webType(MG.display(23), lineHeight: 24.15, over: MG.uiDisplay(23))
                        .tracking(-0.69)
                        .foregroundStyle(Lacquer.cream)

                    if !table.finalScores.isEmpty {
                        VStack(alignment: .leading, spacing: 7) {
                            ForEach(table.finalScores) { row in
                                HStack(alignment: .firstTextBaseline) {
                                    Text("\(row.mark)  \(row.name)")
                                        .font(MG.mono(12))
                                        .foregroundStyle(row.won ? Lacquer.gold : Lacquer.cream)
                                    Spacer()
                                    Text(row.score)
                                        .font(MG.mono(12))
                                        .foregroundStyle(Lacquer.warm)
                                }
                                if !row.note.isEmpty {
                                    Text(row.note)
                                        .webType(MG.display(13), lineHeight: 18.72, over: MG.uiDisplay(13))
                                        .foregroundStyle(Lacquer.warm)
                                }
                            }
                        }
                    }

                    section("What went well", reading.well)
                    section("What to work on", reading.work)
                    if !reading.every.isEmpty {
                        section("Every discard and call", reading.every)
                    }
                    Text("The coach measures standard hand shape and suggests faan paths. Improving copies count unseen tiles, including tiles opponents may hold.")
                        .webType(MG.display(13), lineHeight: 18.72, over: MG.uiDisplay(13))
                        .foregroundStyle(Lacquer.warm)

                    Button("Done") { dismiss() }
                        .font(MG.mono(11))
                        .tracking(11 * 0.07)
                        .textCase(.uppercase)
                        .padding(.vertical, 9)
                        .padding(.horizontal, 13)
                        .frame(minHeight: 38)
                        .background(Lacquer.cream, in: Capsule())
                        .foregroundStyle(Lacquer.deep)
                        .padding(.top, 6)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func section(_ title: String, _ lines: [String]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).eyebrow().foregroundStyle(Lacquer.gold)
            ForEach(lines, id: \.self) { line in
                Text("· " + line)
                    .webType(MG.display(13), lineHeight: 18.72, over: MG.uiDisplay(13))
                    .foregroundStyle(Lacquer.say)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
