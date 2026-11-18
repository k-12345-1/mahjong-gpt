import SwiftUI

struct LearnState {
    var step = 0
    var toured = false
    var tapped: [Int] = []       // the order task, as far as it has got
    var picked: [Int] = []       // the pick task
    var chosen: Int?             // the choice task
    var bins: [Int: Int] = [:]   // the sort task: tile index -> which kind it went in
    var held: Int?               // the tile waiting for a bin
    var wrong = false
    var solved = false

    var lesson: Lesson { Lessons.all[min(step, Lessons.all.count - 1)] }
    var canGoBack: Bool { step > 0 || (step == 0 && toured) }

    mutating func clear() {
        tapped = []; picked = []; chosen = nil; bins = [:]; held = nil
        wrong = false; solved = false
    }
    mutating func on() {
        if step == 0 && !toured { toured = true; return }
        guard step < Lessons.all.count - 1 else { return }
        step += 1
        clear()
    }
    mutating func back() {
        if step == 0 { toured = false; clear(); return }
        step -= 1
        clear()
        if step == 0 { toured = true }
    }
}

/// A line of a lesson is either words or a row of tiles.
enum SayBlock: Identifiable {
    case prose(String)
    case tiles([String])
    var id: String {
        switch self {
        case .prose(let t): "p" + t
        case .tiles(let f): "t" + f.joined()
        }
    }
}

func sayBlocks(_ text: String) -> [SayBlock] {
    guard !text.isEmpty else { return [] }
    var out: [SayBlock] = []
    for line in text.split(separator: "\n", omittingEmptySubsequences: false) {
        var rest = String(line)
        while let open = rest.range(of: "[["), let close = rest.range(of: "]]") {
            let before = String(rest[rest.startIndex..<open.lowerBound])
            if !before.trimmingCharacters(in: .whitespaces).isEmpty { out.append(.prose(before)) }
            let faces = rest[open.upperBound..<close.lowerBound]
                .split(separator: " ").map(String.init)
            out.append(.tiles(faces))
            rest = String(rest[close.upperBound...])
        }
        if !rest.trimmingCharacters(in: .whitespaces).isEmpty { out.append(.prose(rest)) }
    }
    return out
}

struct LearnView: View {
    @Binding var state: LearnState

    private var lesson: Lesson { state.lesson }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if state.step == 0 && !state.toured {
                    TourView(line: lesson.title, groups: lesson.tour) { state.toured = true }
                } else {
                    lessonBody
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 76)
            .padding(.bottom, 40)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    @ViewBuilder private var lessonBody: some View {
        Text("Lesson \(state.step + 1) of \(Lessons.all.count)")
            .eyebrow()
            .foregroundStyle(Lacquer.gold)

        Text(lesson.title)
            .font(.display(30))
            .foregroundStyle(Lacquer.cream)
            .fixedSize(horizontal: false, vertical: true)

        ForEach(Array(sayBlocks(lesson.say).enumerated()), id: \.offset) { i, block in
            switch block {
            case .prose(let words):
                HStack(alignment: .top, spacing: 10) {
                    if lesson.steps {
                        Text("\(i + 1)")
                            .font(.mono(11))
                            .foregroundStyle(Lacquer.gold)
                            .padding(.top, 3)
                    }
                    Text(words)
                        .font(.system(size: 15))
                        .lineSpacing(4)
                        .foregroundStyle(Lacquer.cream.opacity(0.94))
                        .fixedSize(horizontal: false, vertical: true)
                }
            case .tiles(let faces):
                tileRow(faces, width: faces.count > 9 ? 23 : 31)
            }
        }

        if !lesson.row.isEmpty { tileRow(lesson.row, width: 38) }

        if !lesson.cards.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array(lesson.cards.enumerated()), id: \.offset) { _, card in
                    VStack(alignment: .leading, spacing: 7) {
                        Text(card.cap).eyebrow().foregroundStyle(Lacquer.gold)
                        tileRow(card.tiles, width: 36)
                        if !card.note.isEmpty {
                            Text(card.note)
                                .font(.system(size: 13))
                                .foregroundStyle(Lacquer.warm)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }

        if let task = lesson.task { TaskView(task: task, state: $state) }

        Button {
            state.on()
        } label: {
            HStack {
                Text(state.step == Lessons.all.count - 1 ? "Finish" : "Next lesson")
                Image(systemName: "arrow.right")
            }
            .font(.mono(12, weight: .semibold))
            .tracking(1.2)
            .textCase(.uppercase)
            .padding(.vertical, 13)
            .padding(.horizontal, 18)
            .background(state.solved ? Lacquer.cream : .clear, in: Capsule())
            .foregroundStyle(state.solved ? Lacquer.deep : Lacquer.cream)
            .overlay { if !state.solved { Capsule().strokeBorder(Lacquer.hairline) } }
        }
        .padding(.top, 6)
    }

    private func tileRow(_ faces: [String], width: CGFloat) -> some View {
        HStack(spacing: 4) {
            ForEach(Array(faces.enumerated()), id: \.offset) { _, face in
                TileView(tile: Tiles.faces.firstIndex(of: face), width: width)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/* The opening tour: the line, and then the six kinds, each arriving in its own time. */
struct TourView: View {
    let line: String
    let groups: [LessonCard]
    var done: () -> Void
    @State private var shown = 0

    var body: some View {
        VStack(spacing: 26) {
            Text(line)
                .font(.display(30))
                .foregroundStyle(Lacquer.cream)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 18)], spacing: 20) {
                ForEach(Array(groups.enumerated()), id: \.offset) { i, group in
                    VStack(spacing: 7) {
                        HStack(spacing: 3) {
                            ForEach(Array(group.tiles.enumerated()), id: \.offset) { _, face in
                                TileView(tile: Tiles.faces.firstIndex(of: face), width: 30)
                            }
                        }
                        Text(group.cap).eyebrow().foregroundStyle(Lacquer.gold)
                    }
                    .opacity(i < shown ? 1 : 0)
                    .scaleEffect(i < shown ? 1 : 0.86)
                }
            }

            Button("Tap to continue", action: done)
                .font(.display(22))
                .foregroundStyle(Lacquer.warm)
                .opacity(shown >= groups.count ? 1 : 0)
                .disabled(shown < groups.count)
        }
        .frame(maxWidth: .infinity)
        .task {
            for i in 0...groups.count {
                try? await Task.sleep(for: .milliseconds(i == 0 ? 450 : 420))
                withAnimation(.spring(duration: 0.45)) { shown = i + 1 }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { if shown >= groups.count { done() } }
    }
}

struct TaskView: View {
    let task: LessonTask
    @Binding var state: LearnState

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(task.prompt)
                .eyebrow()
                .foregroundStyle(Lacquer.warm)
                .fixedSize(horizontal: false, vertical: true)

            switch task {
            case .order(_, let row, let answer, let note):
                tiles(row) { i in
                    guard !state.solved else { return }
                    if answer[state.tapped.count] == i {
                        state.tapped.append(i)
                        state.wrong = false
                        Sound.clack(0.6)
                        if state.tapped.count == answer.count { state.solved = true }
                    } else {
                        state.wrong = true
                        state.tapped = []
                    }
                } lit: { state.tapped.contains($0) }
                feedback(ok: note, bad: "Not that one. Start again from the 1.")

            case .choice(_, let options, let answer, let note, let wrong):
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(options.enumerated()), id: \.offset) { i, option in
                        Button {
                            state.chosen = i
                            state.solved = i == answer
                            state.wrong = i != answer
                        } label: {
                            Text(option)
                                .font(.system(size: 14))
                                .padding(.vertical, 11)
                                .padding(.horizontal, 15)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(state.chosen == i && state.solved
                                            ? Lacquer.gold.opacity(0.22) : .clear,
                                            in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                                        .strokeBorder(state.chosen == i && state.solved
                                                      ? Lacquer.gold : Lacquer.hairline)
                                }
                                .foregroundStyle(Lacquer.cream)
                        }
                    }
                }
                feedback(ok: note, bad: wrong)

            case .pick(let need, let rule, _, let row, let note, let wrong):
                tiles(row) { i in
                    guard !state.solved else { return }
                    if let at = state.picked.firstIndex(of: i) { state.picked.remove(at: at) }
                    else { state.picked.append(i) }
                    state.wrong = false
                    if state.picked.count == need {
                        let faces = state.picked.map { row[$0] }
                        if rule.accepts(faces) { state.solved = true; Sound.meld() }
                        else { state.wrong = true; state.picked = [] }
                    }
                } lit: { state.picked.contains($0) }
                feedback(ok: note, bad: wrong)

            case .sort(_, let row, let bins, let note, let wrong):
                sortTask(row: row, bins: bins, note: note, wrong: wrong)
            }
        }
        .padding(.top, 4)
    }

    private func tiles(_ row: [String], tap: @escaping (Int) -> Void,
                      lit: @escaping (Int) -> Bool) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 40), spacing: 6)], spacing: 8) {
            ForEach(Array(row.enumerated()), id: \.offset) { i, face in
                Button { tap(i) } label: {
                    TileView(tile: Tiles.faces.firstIndex(of: face), width: 38, lifted: lit(i), marked: lit(i))
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder private func sortTask(row: [String], bins: [String], note: String, wrong: String) -> some View {
        let left = row.indices.filter { state.bins[$0] == nil }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 40), spacing: 6)], spacing: 8) {
            ForEach(left, id: \.self) { i in
                Button {
                    state.held = state.held == i ? nil : i
                } label: {
                    TileView(tile: Tiles.faces.firstIndex(of: row[i]), width: 38,
                             lifted: state.held == i, marked: state.held == i)
                }
                .buttonStyle(.plain)
            }
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 8)], spacing: 8) {
            ForEach(Array(bins.enumerated()), id: \.offset) { b, bin in
                Button {
                    guard let held = state.held else { return }
                    if Lessons.kindOf(row[held]) == b {
                        state.bins[held] = b
                        state.held = nil
                        state.wrong = false
                        Sound.clack(0.5)
                        if state.bins.count == row.count { state.solved = true }
                    } else {
                        state.wrong = true
                    }
                } label: {
                    VStack(spacing: 4) {
                        Text(bin).eyebrow()
                        Text("\(state.bins.values.filter { $0 == b }.count)")
                            .font(.mono(12))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .overlay {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .strokeBorder(state.held != nil ? Lacquer.gold.opacity(0.7) : Lacquer.hairline,
                                          style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    }
                    .foregroundStyle(Lacquer.cream)
                }
            }
        }
        feedback(ok: note, bad: wrong)
    }

    @ViewBuilder private func feedback(ok: String, bad: String) -> some View {
        if state.solved && !ok.isEmpty {
            Text(ok)
                .font(.system(size: 13))
                .foregroundStyle(Lacquer.gold)
                .fixedSize(horizontal: false, vertical: true)
        } else if state.wrong && !bad.isEmpty {
            Text(bad)
                .font(.system(size: 13))
                .foregroundStyle(Lacquer.warm)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
