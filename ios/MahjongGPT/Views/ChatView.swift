import SwiftUI

struct ChatMessage: Identifiable {
    enum Role { case you, coach }
    let id = UUID()
    let role: Role
    let text: String
}

struct ChatState {
    var thread: [ChatMessage] = []
    var draft = ""
    /// how many times each page has been asked for, so the answers rotate
    var seen: [String: Int] = [:]
    var lastKey: Int?
    /// the tiles the last answer drew, kept as the groups they were drawn in
    var lastDrawn: [[Int]] = []

    mutating func reset() {
        thread = []; draft = ""; seen = [:]; lastKey = nil; lastDrawn = []
    }
}

@MainActor
enum Chat {
    static let nothing = "I only know mahjong. Ask me about the tiles, the rules, the scoring, or the hand you are holding."
    static let vague = "That one I have not got a page for. Try me on chows, pungs and kongs, the scoring, what to discard, waits, defence, the winds and dragons, the flowers, or a hand worth a given number of faan."

    private static func normalise(_ question: String) -> String {
        /* "Hong Kong" is the place the rules come from, not a call -- without this a
           question about the weather there reads as a question about kongs. */
        let lowered = question.lowercased()
            .replacingOccurrences(of: "hong kong", with: " ")
            .replacingOccurrences(of: "hongkong", with: " ")
        let kept = lowered.map { ch -> Character in
            ch.isLetter || ch.isNumber || ch == "-" || ch == " " ? ch : " "
        }
        return " " + String(kept).split(separator: " ").joined(separator: " ") + " "
    }

    private static func rotate(_ key: String, _ list: [String], _ state: inout ChatState) -> String {
        let n = state.seen[key] ?? 0
        state.seen[key] = n + 1
        return list[n % list.count]
    }

    /// the tiles an answer drew, kept so "how many faan is that?" has something to count
    static func remember(_ text: String, into state: inout ChatState) {
        let groups = sayBlocks(text).compactMap { block -> [Int]? in
            if case .tiles(let faces) = block {
                let tiles = faces.compactMap { Tiles.faces.firstIndex(of: $0) }
                return tiles.isEmpty ? nil : tiles
            }
            return nil
        }
        if !groups.isEmpty { state.lastDrawn = groups }
    }

    /* "How many faan is that worth?" is a question about the tiles that were just drawn,
       and it used to be answered with the page on how faan is counted -- which is the next
       question along, not this one. The count is the table's own faanFor, so the chat and
       the table can never put a different number on the same fourteen tiles. */
    static func scoreShown(_ groups: [[Int]]) -> String? {
        guard !groups.isEmpty else { return nil }
        let all = groups.flatMap { $0 }
        guard all.count == 14, Hand.winning(all, melds: 0) else {
            return "What I drew there is \(all.count) tile\(all.count == 1 ? "" : "s"), not a whole hand,"
                 + " so there is no faan on it yet. A hand is four sets and a pair, fourteen tiles."
        }
        let sets = groups.filter { $0.count == 3 || $0.count == 4 }
        let pair = groups.filter { $0.count == 2 }
        let laidOut = sets.count == 4 && pair.count == 1
        let reading = laidOut
            ? Scoring.faanFor(concealed: pair[0], exposed: sets, bonuses: [], seatWind: 0,
                              roundWind: 0, won: true, selfDraw: false)
            : Scoring.faanFor(concealed: all, exposed: [], bonuses: [], seatWind: 0,
                              roundWind: 0, won: true, selfDraw: false)
        let parts = reading.wins.map { win -> String in
            let why = win.why.prefix(1).lowercased() + win.why.dropFirst()
            return "\(why) is \(win.faan)"
        }
        let bonusTags = ["concealed", "self-draw", "no flowers", "own flower", "a full set", "a plain hand"]
        let shape = reading.had.contains { !bonusTags.contains($0) }

        var out = "\(reading.faan) faan: " + list(parts) + "."
        if reading.faan < 3 {
            out += "\n" + (shape ? "" : "The shape itself pays nothing. ")
                 + "Most tables ask three faan before you may go out, so that hand could not be declared on one."
        }
        out += "\n" + (laidOut
            ? "That counts it as East in the East round, with the sets face up and won on a discard. Held closed it is worth one more, and won on your own draw another."
            : "That counts it as East in the East round, held closed and won on a discard. Winning on your own draw would add one more.")
        return out
    }

    private static func list(_ parts: [String]) -> String {
        guard parts.count > 1 else { return parts.joined() }
        return parts.dropLast().joined(separator: ", ") + " and " + (parts.last ?? "")
    }

    private static func handAnswer(_ want: Int, _ state: inout ChatState) -> String {
        let exact = Book.hands.filter { $0.faan == want }
        let pool = exact.isEmpty
            ? [Book.hands.min { abs($0.faan - want) < abs($1.faan - want) }!]
            : exact
        let n = state.seen["faan-\(want)"] ?? 0
        state.seen["faan-\(want)"] = n + 1
        let hand = pool[n % pool.count]
        let opener = hand.faan == want
            ? "A hand worth \(want) faan: \(hand.name)."
            : "Nothing lands on exactly \(want) faan on the common table. The nearest is \(hand.faan) faan: \(hand.name)."
        return opener + "\n" + hand.tiles + "\n" + hand.note
    }

    /// What the coach would say about the hand actually on the table, if one is in play.
    private static func aboutYourHand(_ table: Table) -> String? {
        guard !table.hands[0].isEmpty, let pick = table.coachPick() else { return nil }
        var out = "Your hand right now:\n[[" + table.hands[0].map { Tiles.faces[$0] }.joined(separator: " ") + "]]\n"
        if table.phase == .player {
            out += "Discard \(Tiles.name(pick.tile)) — \(pick.why)."
        } else {
            out += "It is not your turn, but \(Tiles.name(pick.tile)) is the tile I would let go of — \(pick.why)."
        }
        if !pick.direction.name.isEmpty {
            out += " You are on \(pick.direction.name), \(pick.direction.faan) faan."
        }
        out += "\nThe table is \(Tiles.winds[table.match.round]) round, you are \(Tiles.winds[table.wind(of: 0)]),"
             + " and \(table.minFaan > 0 ? "a hand has to be worth \(table.minFaan) faan to be declared" : "any four sets and a pair can be declared")."
        return out
    }

    static func answer(to question: String, state: inout ChatState, table: Table) -> String {
        let q = normalise(question)
        let words = Set(q.split(separator: " ").flatMap {
            [String($0), String($0).hasSuffix("s") ? String($0.dropLast()) : String($0)]
        })

        let scoreWord = ["faan", "fan", "score", "scores", "scored", "scoring", "worth",
                         "value", "count", "counts", "point", "points"]
        let thatOne = ["above", "this", "that", "these", "those", "it", "shown", "showed", "same"]
        let asksScore = scoreWord.contains { words.contains($0) }
        let pointsAtIt = thatOne.contains { words.contains($0) }

        if asksScore, pointsAtIt, let count = scoreShown(state.lastDrawn) {
            state.lastKey = nil
            return count
        }

        /* A question about the hand you are actually holding is answered from the table. */
        if words.contains("my") || words.contains("i") || pointsAtIt,
           words.contains("discard") || words.contains("hand") || words.contains("play"),
           let mine = aboutYourHand(table) {
            state.lastKey = nil
            return mine
        }

        // "a hand worth 3 faan" wants tiles; "how many points is 3 faan" wants the table
        if let want = askedFaan(question),
           ["hand", "hands", "show", "see", "example", "look", "shape"].contains(where: { words.contains($0) }) {
            state.lastKey = nil
            return handAnswer(want, &state)
        }

        /* whole words only, with a plural forgiven. The longer the word that matched, the
           more it says about the question: a whole phrase beats any single word. */
        var best: Int?
        var bestScore = 0
        for (i, entry) in Book.entries.enumerated() {
            var score = 0
            for term in entry.on {
                let hit = term.contains(" ") ? q.contains(" " + term + " ") : words.contains(term)
                if hit { score = max(score, term.contains(" ") ? 10 + term.count : term.count) }
            }
            if score > bestScore { bestScore = score; best = i }
        }
        let again = ["more", "another", "other", "others", "different", "else", "again", "next", "new"]
        if best == nil, again.contains(where: { words.contains($0) }), let last = state.lastKey {
            best = last
        }
        if let key = best {
            state.lastKey = key
            return rotate("book-\(key)", Book.entries[key].say, &state)
        }
        if pointsAtIt, let count = scoreShown(state.lastDrawn) {
            state.lastKey = nil
            return count
        }
        state.lastKey = nil
        let vocabulary = Set(Book.entries.flatMap(\.on) + ["mahjong", "majong", "mah-jong", "majiang",
            "hand", "hands", "honor", "honors", "meld", "melds", "rack", "terminal", "terminals",
            "pungs", "chows", "kongs", "tile"])
        return words.contains(where: { vocabulary.contains($0) }) ? vague : nothing
    }

    private static func askedFaan(_ question: String) -> Int? {
        let text = question.lowercased()
        for pattern in [#"(\d{1,2})\s*(faan|fan|point|points)\b"#, #"worth\s*(\d{1,2})"#] {
            guard let re = try? NSRegularExpression(pattern: pattern) else { continue }
            if let m = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let r = Range(m.range(at: 1), in: text) {
                return Int(text[r])
            }
        }
        return nil
    }
}

/* The panel, set the way the page sets it: what you asked in a mono bubble on the right,
   what it answers in 17px serif straight on the ground, and the tiles it draws on a faint
   plate. The empty box does the suggesting -- it cycles through what is worth asking. */
struct ChatView: View {
    @Environment(Table.self) private var table
    @Binding var state: ChatState
    let width: CGFloat
    @FocusState private var writing: Bool
    @State private var prompt = 0

    private let promptTick = Timer.publish(every: 4, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 19) {
                        ForEach(state.thread) { message in
                            line(message).id(message.id)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, corner(width) + 58)
                    .padding(.bottom, 10)
                }
                .onChange(of: state.thread.count) {
                    if let last = state.thread.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            HStack(spacing: 10) {
                TextField("", text: $state.draft, prompt: Text(Book.prompts[prompt % Book.prompts.count])
                    .font(MG.display(17))
                    .foregroundColor(Lacquer.warm.opacity(0.75)))
                    .textFieldStyle(.plain)
                    .font(MG.display(17))
                    .padding(.vertical, 10)
                    .padding(.horizontal, 2)
                    .foregroundStyle(Lacquer.cream)
                    .tint(Lacquer.gold)
                    .focused($writing)
                    .submitLabel(.send)
                    .onSubmit(send)

                Button(action: send) {
                    Text("Ask")
                        .font(MG.mono(11))
                        .tracking(0.99)
                        .textCase(.uppercase)
                        .padding(.vertical, 11)
                        .padding(.horizontal, 21)
                        .background(Lacquer.cream, in: Capsule())
                        .foregroundStyle(Lacquer.deep)
                }
                .disabled(state.draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.top, 13)
            .overlay(alignment: .top) {
                Rectangle().fill(Lacquer.askLine).frame(height: 1)
            }
        }
        .frame(width: width - 40)
        .padding(.horizontal, 20)
        .padding(.top, width * 0.0696)
        .padding(.bottom, width * 0.0522)
        .onReceive(promptTick) { _ in if state.thread.isEmpty { prompt += 1 } }
    }

    @ViewBuilder private func line(_ message: ChatMessage) -> some View {
        if message.role == .you {
            HStack {
                Spacer(minLength: 40)
                Text(message.text)
                    .webType(MG.mono(15), lineHeight: 21.75, over: MG.uiMono(15))
                    .foregroundStyle(Lacquer.cream)
                    .padding(.vertical, 9)
                    .padding(.horizontal, 15)
                    .background(Color.white.opacity(0.09), in: YouBubble())
                    .overlay { YouBubble().strokeBorder(Lacquer.youLine) }
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(sayBlocks(message.text)) { block in
                    switch block {
                    case .prose(let words):
                        Text(words)
                            .webType(MG.display(17), lineHeight: 25.5, over: MG.uiDisplay(17))
                            .foregroundStyle(Lacquer.say)
                            .fixedSize(horizontal: false, vertical: true)
                    case .tiles(let faces):
                        FlowTiles(faces: faces).padding(.vertical, 7)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func send() {
        let question = state.draft.trimmingCharacters(in: .whitespaces)
        guard !question.isEmpty else { return }
        state.draft = ""
        writing = false
        state.thread.append(ChatMessage(role: .you, text: question))
        let said = Chat.answer(to: question, state: &state, table: table)
        Chat.remember(said, into: &state)
        state.thread.append(ChatMessage(role: .coach, text: said))
    }
}

/// border-radius: 15px 15px 4px -- square-ish where it points back at you
struct YouBubble: InsettableShape {
    var inset: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: inset, dy: inset)
        return Path { p in
            p.move(to: CGPoint(x: r.minX + 15, y: r.minY))
            p.addLine(to: CGPoint(x: r.maxX - 15, y: r.minY))
            p.addQuadCurve(to: CGPoint(x: r.maxX, y: r.minY + 15),
                           control: CGPoint(x: r.maxX, y: r.minY))
            p.addLine(to: CGPoint(x: r.maxX, y: r.maxY - 4))
            p.addQuadCurve(to: CGPoint(x: r.maxX - 4, y: r.maxY),
                           control: CGPoint(x: r.maxX, y: r.maxY))
            p.addLine(to: CGPoint(x: r.minX + 15, y: r.maxY))
            p.addQuadCurve(to: CGPoint(x: r.minX, y: r.maxY - 15),
                           control: CGPoint(x: r.minX, y: r.maxY))
            p.addLine(to: CGPoint(x: r.minX, y: r.minY + 15))
            p.addQuadCurve(to: CGPoint(x: r.minX + 15, y: r.minY),
                           control: CGPoint(x: r.minX, y: r.minY))
            p.closeSubpath()
        }
    }

    func inset(by amount: CGFloat) -> YouBubble { YouBubble(inset: inset + amount) }
}

/// .gpt-tiles: a run of tiles on a faint plate, 26px wide with 3px between them.
struct FlowTiles: View {
    let faces: [String]

    var body: some View {
        let tiles = faces.compactMap { Tiles.faces.firstIndex(of: $0) }
        FlowRow(spacing: 3) {
            ForEach(Array(tiles.enumerated()), id: \.offset) { _, tile in
                TileView(tile: tile, width: 26, shadow: 2)
            }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 7)
        .background(Color.white.opacity(0.07),
                    in: RoundedRectangle(cornerRadius: 9, style: .continuous))
    }
}
