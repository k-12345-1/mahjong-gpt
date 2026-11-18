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
        let words = String(kept).split(separator: " ").joined(separator: " ")
        return " " + words + " "
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
        let direction = pick.direction
        if !direction.name.isEmpty {
            out += " You are on \(direction.name), \(direction.faan) faan."
        }
        out += "\nThe table is \(Tiles.winds[table.match.round]) round, you are \(Tiles.winds[table.wind(of: 0)]),"
             + " and \(table.minFaan > 0 ? "a hand has to be worth \(table.minFaan) faan to be declared" : "any four sets and a pair can be declared")."
        return out
    }

    static func answer(to question: String, state: inout ChatState, table: Table) -> String {
        let q = normalise(question)
        let words = Set(q.split(separator: " ").flatMap { [String($0), String($0).hasSuffix("s") ? String($0.dropLast()) : String($0)] })

        let scoreWord = ["faan", "fan", "score", "scores", "scored", "scoring", "worth",
                         "value", "count", "counts", "point", "points"]
        let thatOne = ["above", "this", "that", "these", "those", "it", "shown", "showed", "same"]
        let asksScore = scoreWord.contains { words.contains($0) }
        let pointsAtIt = thatOne.contains { words.contains($0) }

        /* Asked about the tiles already on the screen before asked for new ones, so "what is
           that one worth" counts what is there rather than drawing another hand. */
        if asksScore, pointsAtIt, let count = scoreShown(state.lastDrawn) {
            state.lastKey = nil
            return count
        }

        /* A question about the hand you are actually holding is answered from the table. */
        if (words.contains("my") || words.contains("i") || pointsAtIt),
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

        /* whole words only, with a plural forgiven: "winds" is the winds, "win" is winning.
           The longer the word that matched, the more it says about the question: a whole
           phrase beats any single word. */
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
        // "show me another" on its own carries no subject -- it means the one we were just on
        let again = ["more", "another", "other", "others", "different", "else", "again", "next", "new"]
        if best == nil, again.contains(where: { words.contains($0) }), let last = state.lastKey {
            best = last
        }
        if let key = best {
            state.lastKey = key
            return rotate("book-\(key)", Book.entries[key].say, &state)
        }
        /* Nothing in the book matched -- but a hand is on the screen and the question points
           at it. "And that one?" is a question about those tiles, not about nothing. */
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
        let patterns = [#"(\d{1,2})\s*(faan|fan|point|points)\b"#, #"worth\s*(\d{1,2})"#]
        for pattern in patterns {
            guard let re = try? NSRegularExpression(pattern: pattern) else { continue }
            let range = NSRange(text.startIndex..., in: text)
            if let m = re.firstMatch(in: text, range: range),
               let r = Range(m.range(at: 1), in: text) {
                return Int(text[r])
            }
        }
        return nil
    }
}

struct ChatView: View {
    @Environment(Table.self) private var table
    @Binding var state: ChatState
    @FocusState private var writing: Bool

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        if state.thread.isEmpty { opener }
                        ForEach(state.thread) { message in
                            bubble(message).id(message.id)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 76)
                    .padding(.bottom, 16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .onChange(of: state.thread.count) {
                    if let last = state.thread.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            HStack(spacing: 8) {
                TextField("Ask about mahjong", text: $state.draft)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15))
                    .padding(.vertical, 11)
                    .padding(.horizontal, 14)
                    .background(Color.white.opacity(0.1), in: Capsule())
                    .overlay { Capsule().strokeBorder(Lacquer.hairline) }
                    .foregroundStyle(Lacquer.cream)
                    .focused($writing)
                    .submitLabel(.send)
                    .onSubmit(send)

                Button(action: send) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .frame(width: 42, height: 42)
                        .background(Lacquer.cream, in: Circle())
                        .foregroundStyle(Lacquer.deep)
                }
                .disabled(state.draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
        }
    }

    private var opener: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Table coach").eyebrow().foregroundStyle(Lacquer.gold)
            Text("Ask me about the game")
                .font(.display(30))
                .foregroundStyle(Lacquer.cream)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Book.prompts.prefix(5), id: \.self) { prompt in
                    Button {
                        state.draft = prompt
                        send()
                    } label: {
                        Text(prompt)
                            .font(.system(size: 14))
                            .padding(.vertical, 10)
                            .padding(.horizontal, 14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .overlay { RoundedRectangle(cornerRadius: 9, style: .continuous).strokeBorder(Lacquer.hairline) }
                            .foregroundStyle(Lacquer.warm)
                    }
                }
            }
        }
    }

    private func bubble(_ message: ChatMessage) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(message.role == .you ? "You" : "Mahjong GPT")
                .eyebrow()
                .foregroundStyle(message.role == .you ? Lacquer.warm : Lacquer.gold)
            ForEach(sayBlocks(message.text)) { block in
                switch block {
                case .prose(let words):
                    Text(words)
                        .font(.system(size: 15))
                        .lineSpacing(4)
                        .foregroundStyle(Lacquer.cream)
                        .fixedSize(horizontal: false, vertical: true)
                case .tiles(let faces):
                    FlowTiles(faces: faces)
                }
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(message.role == .you ? Color.white.opacity(0.06) : Color.black.opacity(0.14),
                    in: RoundedRectangle(cornerRadius: 11, style: .continuous))
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

/// A row of tiles that wraps, for the hands the coach draws in the middle of an answer.
struct FlowTiles: View {
    let faces: [String]

    var body: some View {
        let tiles = faces.compactMap { Tiles.faces.firstIndex(of: $0) }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 30), spacing: 3)], alignment: .leading, spacing: 5) {
            ForEach(Array(tiles.enumerated()), id: \.offset) { _, tile in
                TileView(tile: tile, width: 28)
            }
        }
    }
}
