import SwiftUI

struct LearnState {
    /* Where the school was left, kept as the web app keeps it: one number, the lesson,
       and nothing about how it was answered. Until now this app kept nothing -- walking
       out of the school and back in started it again. */
    static let schoolKey = "mahjong-school"
    static var recalled: Int {
        let n = UserDefaults.standard.integer(forKey: schoolKey)
        return n > 0 && n < Lessons.all.count ? n : 0
    }

    var step = LearnState.recalled {
        didSet {
            UserDefaults.standard.set(step, forKey: LearnState.schoolKey)
            Account.noteSchool()
        }
    }
    /// a lesson reached before is landed on at its task, with the tour as the step behind it
    var toured = LearnState.recalled > 0
    var tapped: [Int] = []       // the order task, as far as it has got
    var picked: [Int] = []       // the pick task
    var chosen: Int?             // the choice task
    var bins: [Int: Int] = [:]   // the sort task: tile index -> which kind it went in
    var held: Int?               // the tile waiting for a bin
    var wrong = false
    var solved = false

    var lesson: Lesson { Lessons.all[min(step, Lessons.all.count - 1)] }
    var canGoBack: Bool { step > 0 || (step == 0 && toured) }

    /// after a sign-in has brought a further lesson down from elsewhere
    mutating func resume() {
        step = LearnState.recalled
        toured = step > 0
        clear()
    }

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

/* The school, set the way the page sets it on a phone: a 23px serif line, 13px serif
   prose under it, the question in 10.5px mono small caps, and the tiles at the size the
   lesson's own container query gives them. */
struct LearnView: View {
    @Binding var state: LearnState
    let width: CGFloat

    private var lesson: Lesson { state.lesson }
    /// --tile: min(clamp(28px, min(8vw,10vh), 92px), 9.6cqw, (100vw - 80) / 14)
    private var taskTile: CGFloat { max(16, (width - 80) / 14) }
    private var inner: CGFloat { width - 32 }

    var body: some View {
        /* .learn-body is a flex box and .learn-inner sits in the middle of it: a lesson is
           centred in the screen, and only runs from the top when it is too tall to be. */
        GeometryReader { geo in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if state.step == 0 && !state.toured {
                        TourView(line: lesson.title, groups: lesson.tour, width: inner) {
                            state.toured = true
                        }
                    } else {
                        lessonBody
                    }
                }
                .frame(width: inner, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.top, corner(width) + 30)
                .padding(.bottom, 30)
                .frame(minHeight: geo.size.height, alignment: .center)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }

    @ViewBuilder private var lessonBody: some View {
        Text(lesson.title)
            .webType(MG.display(23), lineHeight: 24.15, over: MG.uiDisplay(23))
            .tracking(-0.69)
            .foregroundStyle(Lacquer.cream)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.bottom, 8.05)

        ForEach(Array(sayBlocks(lesson.say).enumerated()), id: \.offset) { i, block in
            switch block {
            case .prose(let words):
                HStack(alignment: .top, spacing: 9) {
                    if lesson.steps {
                        Text("\(i + 1)")
                            .font(MG.mono(10.5))
                            .foregroundStyle(Lacquer.gold)
                            .padding(.top, 3)
                    }
                    Text(words)
                        .webType(MG.display(13), lineHeight: 18.72, over: MG.uiDisplay(13))
                        .foregroundStyle(Lacquer.say)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.bottom, 10)
            case .tiles(let faces):
                tileRow(faces, width: faces.count > 9 ? 18 : 21.3, plate: true)
                    .padding(.bottom, 10)
            }
        }
        .padding(.bottom, 8)

        if !lesson.row.isEmpty {
            tileRow(lesson.row, width: taskTile, plate: false).padding(.bottom, 14)
        }

        if !lesson.cards.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(lesson.cards.enumerated()), id: \.offset) { _, card in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(card.cap)
                            .eyebrow(size: 10.5)
                            .foregroundStyle(Lacquer.gold)
                        tileRow(card.tiles, width: 21.3, plate: false)
                        if !card.note.isEmpty {
                            Text(card.note)
                                .webType(MG.display(13), lineHeight: 18.72, over: MG.uiDisplay(13))
                                .foregroundStyle(Lacquer.say)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
            .padding(.bottom, 16)
        }

        if let task = lesson.task {
            TaskView(task: task, state: $state, tile: taskTile, width: inner)
        }

        HStack {
            Spacer(minLength: 0)
            Button { state.on() } label: {
                Text(state.step == Lessons.all.count - 1 ? "Finish" : "Next lesson")
                    .font(MG.mono(11))
                    .tracking(11 * 0.07)
                    .textCase(.uppercase)
                    .padding(.vertical, 9)
                    .padding(.horizontal, 13)
                    .frame(minHeight: 38)
                    .background(state.solved ? Lacquer.cream : .clear, in: Capsule())
                    .overlay { if !state.solved { Capsule().strokeBorder(Lacquer.choiceLine) } }
                    .foregroundStyle(state.solved ? Lacquer.deep : Lacquer.cream)
            }
            Spacer(minLength: 0)
        }
        .padding(.top, 18)
    }

    /* .learn-tiles: a faint plate behind a run of tiles, 7px corners and 5px between. */
    private func tileRow(_ faces: [String], width tw: CGFloat, plate: Bool) -> some View {
        HStack(spacing: 5) {
            ForEach(Array(faces.enumerated()), id: \.offset) { _, face in
                TileView(tile: Tiles.faces.firstIndex(of: face), width: tw, shadow: 2)
            }
        }
        .padding(.vertical, plate ? 4 : 0)
        .padding(.horizontal, plate ? 5 : 0)
        .background(plate ? Color.white.opacity(0.07) : .clear,
                    in: RoundedRectangle(cornerRadius: 7, style: .continuous))
    }
}

/* The opening tour: the line, and then the six kinds, each arriving in its own time. */
struct TourView: View {
    let line: String
    let groups: [LessonCard]
    let width: CGFloat
    var done: () -> Void
    @State private var shown = 0

    var body: some View {
        VStack(spacing: 24) {
            Text(line)
                .webType(MG.display(23), lineHeight: 24.15, over: MG.uiDisplay(23))
                .tracking(-0.69)
                .foregroundStyle(Lacquer.cream)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 16)], spacing: 18) {
                ForEach(Array(groups.enumerated()), id: \.offset) { i, group in
                    VStack(spacing: 6) {
                        HStack(spacing: 3) {
                            ForEach(Array(group.tiles.enumerated()), id: \.offset) { _, face in
                                TileView(tile: Tiles.faces.firstIndex(of: face), width: 26, shadow: 4)
                            }
                        }
                        Text(group.cap)
                            .eyebrow(size: 10.5, tracking: 0.12)
                            .foregroundStyle(Lacquer.gold)
                    }
                    .opacity(i < shown ? 1 : 0)
                    .scaleEffect(i < shown ? 1 : 0.86)
                }
            }

            Text("Tap to continue")
                .webType(MG.display(23), lineHeight: 24.15, over: MG.uiDisplay(23))
                .tracking(-0.69)
                .foregroundStyle(Lacquer.warm)
                .opacity(shown >= groups.count ? 1 : 0)
        }
        .frame(width: width)
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
    let tile: CGFloat
    let width: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(task.prompt)
                .font(MG.mono(10.488))
                .tracking(0.944)
                .textCase(.uppercase)
                .foregroundStyle(Lacquer.ask)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 13)

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
                choices(options) { i in
                    state.chosen = i
                    state.solved = i == answer
                    state.wrong = i != answer
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
        .frame(width: width, alignment: .leading)
    }

    private func tiles(_ row: [String], tap: @escaping (Int) -> Void,
                      lit: @escaping (Int) -> Bool) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: tile), spacing: 6)],
                  alignment: .center, spacing: 8) {
            ForEach(Array(row.enumerated()), id: \.offset) { i, face in
                Button { tap(i) } label: {
                    TileView(tile: Tiles.faces.firstIndex(of: face), width: tile,
                             lifted: lit(i), ring: lit(i) ? .solid : .none, shadow: 3)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.bottom, 10)
    }

    /* .learn-choice: a 12px pill in the serif, hairline in rgba(255,199,168,.3). */
    private func choices(_ options: [String], tap: @escaping (Int) -> Void) -> some View {
        FlowRow(spacing: 7) {
            ForEach(Array(options.enumerated()), id: \.offset) { i, option in
                Button { tap(i) } label: {
                    Text(option)
                        .webType(MG.display(16), lineHeight: 20.8, over: MG.uiDisplay(16))
                        .padding(.vertical, 9)
                        .padding(.horizontal, 15)
                        .background(state.chosen == i && state.solved
                                    ? Lacquer.gold.opacity(0.12) : .clear,
                                    in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(state.chosen == i && state.solved
                                              ? Lacquer.gold : Lacquer.choiceLine)
                        }
                        .foregroundStyle(state.chosen == i && state.solved ? .white : Lacquer.choice)
                }
            }
        }
        .padding(.bottom, 12)
    }

    @ViewBuilder private func sortTask(row: [String], bins: [String],
                                       note: String, wrong: String) -> some View {
        let left = row.indices.filter { state.bins[$0] == nil }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: tile), spacing: 6)],
                  alignment: .center, spacing: 8) {
            ForEach(left, id: \.self) { i in
                Button { state.held = state.held == i ? nil : i } label: {
                    TileView(tile: Tiles.faces.firstIndex(of: row[i]), width: tile,
                             lifted: state.held == i, ring: state.held == i ? .solid : .none,
                             shadow: 3)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.bottom, 12)

        LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 6)], spacing: 6) {
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
                    VStack(spacing: 3) {
                        Text(bin).eyebrow(size: 10.5, tracking: 0.12)
                        Text("\(state.bins.values.filter { $0 == b }.count)").font(MG.mono(11))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .overlay {
                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                            .strokeBorder(state.held != nil ? Lacquer.gold.opacity(0.6)
                                                            : Lacquer.choiceLine,
                                          style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    }
                    .foregroundStyle(Lacquer.choice)
                }
            }
        }
        .padding(.bottom, 12)
        feedback(ok: note, bad: wrong)
    }

    @ViewBuilder private func feedback(ok: String, bad: String) -> some View {
        if state.solved && !ok.isEmpty {
            Text(ok)
                .webType(MG.display(13), lineHeight: 18.72, over: MG.uiDisplay(13))
                .foregroundStyle(Lacquer.gold)
                .fixedSize(horizontal: false, vertical: true)
        } else if state.wrong && !bad.isEmpty {
            Text(bad)
                .webType(MG.display(13), lineHeight: 18.72, over: MG.uiDisplay(13))
                .foregroundStyle(Lacquer.warm)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// A row that wraps, the way `flex-wrap` does -- for choices of different lengths.
struct FlowRow: Layout {
    var spacing: CGFloat = 7

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > width { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        /* inline-flex: a run that fits on one line is only as wide as it is */
        let used = max(0, x - spacing)
        return CGSize(width: y == 0 ? used : (proposal.width ?? used), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize,
                       subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX {
                x = bounds.minX; y += rowHeight + spacing; rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
