import Foundation
import Observation

enum Phase { case player, bot, offer, review, ended }

enum Level: String, CaseIterable, Codable {
    case beginner, intermediate, advanced
    var label: String {
        switch self {
        case .beginner: "Beginner"
        case .intermediate: "Intermediate"
        case .advanced: "Advanced"
        }
    }
    /// how long a seat takes to look at a discard before letting it go
    var review: Double {
        switch self {
        case .beginner: 2.0
        case .intermediate: 1.4
        case .advanced: 0.7
        }
    }
}

struct ClaimOption: Identifiable {
    let id = UUID()
    let name: String
    let use: [Int]
    let priority: Int
    var player: Int = 0
    var distance: Int = 0
    /// what the call is called, with any run stripped off the end
    var call: String { name.hasPrefix("Chow") ? "Chow" : name }
}

struct Offer {
    let from: Int
    let tile: Int
    let options: [ClaimOption]
    let bot: ClaimOption?
}

struct SeatScore: Identifiable {
    var id: Int { seat }
    let seat: Int
    let won: Bool
    let name: String
    let mark: String
    let faan: Int
    let away: Int
    let wins: [FaanWin]
    let note: String
    let score: String
}

struct MatchState: Codable {
    var level: Level = .beginner
    var minFaan: Int = 3
    var round: Int = 0
    var dealt: Int = 0
    var nextDealer: Int = 1
    var wins: [Int] = [0, 0, 0, 0]
    var score: [Int] = [0, 0, 0, 0]
    var winner: Int? = nil
}

@MainActor
@Observable
final class Table {
    // the tiles
    var wall: [Int] = []
    var hands: [[Int]] = [[], [], [], []]
    var bonuses: [[Int]] = [[], [], [], []]
    var melds: [[[Int]]] = [[], [], [], []]
    var rivers: [[Int]] = [[], [], [], []]

    // where the hand stands
    var dealer = 0
    var seat = 0
    var phase: Phase = .player
    var choice = -1
    var offer: Offer?
    var note = ""
    var claimNotice = ""
    var callWord: String?
    var newTileIndex = -1
    var lastDiscard: (seat: Int, tile: Int, index: Int)?
    var canSelfDraw = false
    var counting = false
    var finalScores: [SeatScore] = []

    // the match, and what the player has asked for
    var match = MatchState()
    var settings = MatchState()
    var coach = true
    var turnSeconds: Double = 1
    var saidDirection = false

    private var turnTask: Task<Void, Never>?
    private var decisions: [Decision] = []
    private var completed: [[Decision]] = []

    struct Decision {
        enum Kind { case strong, improve, call, pass }
        let kind: Kind
        let cost: Int
        let text: String
        var efficient = false
    }

    init() {
        if !restore() { reset() }
    }

    // MARK: - the table in words

    func wind(of player: Int) -> Int { (player - dealer + 4) % 4 }
    func seatName(_ player: Int) -> String { player == 0 ? "You" : Tiles.winds[wind(of: player)] }
    var minFaan: Int { match.minFaan }
    var standings: String {
        (0..<4).map { "\(seatName($0)) \(match.score[$0])" }.joined(separator: " · ")
    }

    // MARK: - dealing

    @discardableResult
    private func draw(_ player: Int) -> Bool {
        while let tile = wall.popLast() {
            if tile >= 34 { bonuses[player].append(tile) }
            else { hands[player].append(tile); return true }
        }
        return false
    }

    func reset() {
        turnTask?.cancel()
        counting = false
        decisions = []
        finalScores = []
        wall = (0..<Tiles.faces.count).flatMap { Array(repeating: $0, count: $0 < 34 ? 4 : 1) }
        wall.shuffle()
        hands = [[], [], [], []]
        bonuses = [[], [], [], []]
        melds = [[], [], [], []]
        rivers = [[], [], [], []]
        for _ in 0..<13 { for p in 0..<4 { draw(p) } }
        choice = -1
        offer = nil
        claimNotice = ""
        callWord = nil
        draw(dealer)
        if dealer == 0 { sortPlayer() } else { hands[0].sort() }
        newTileIndex = -1
        lastDiscard = nil
        note = dealer == 0
            ? "Select a tile to discard. The coach can help you compare options."
            : "\(Tiles.winds[wind(of: dealer)]) deals and opens the hand."
        playTurn(dealer, drawn: true)
    }

    func newMatch() {
        saidDirection = false
        completed = []
        match = MatchState(level: settings.level, minFaan: settings.minFaan)
        dealer = 0
        reset()
    }

    func nextHand() {
        guard phase == .ended, match.winner == nil else { return }
        dealer = match.nextDealer
        reset()
    }

    private func sortPlayer() {
        guard let drawnTile = hands[0].popLast() else { return }
        hands[0].sort()
        hands[0].append(drawnTile)
    }

    // MARK: - turns

    private func playTurn(_ player: Int, drawn: Bool) {
        turnTask?.cancel()
        seat = player
        choice = -1
        offer = nil
        canSelfDraw = drawn
        phase = player == 0 ? .player : .bot
        if player == 0 { newTileIndex = drawn ? hands[0].count - 1 : -1 }
        if player == 0 { keep(handOver: false); return }

        turnTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(self?.turnSeconds ?? 1))
            guard let self, !Task.isCancelled else { return }
            if drawn && self.winsWith(player, tiles: self.hands[player], selfDraw: true) {
                self.finish("\(Tiles.winds[self.wind(of: player)]) wins by self-draw.", winner: player)
                return
            }
            self.discard(player, at: self.opponentDiscard(player))
        }
    }

    private func takeTurn(_ player: Int) {
        if !draw(player) {
            finish("The wall is empty. This hand ends in a draw.", winner: nil)
            return
        }
        playTurn(player, drawn: true)
    }

    /// the lazy shape score the weaker seats play by
    private func shapeScore(_ hand: [Int], _ i: Int) -> Int {
        let n = hand[i]
        var value = 0
        for (j, other) in hand.enumerated() where j != i {
            if n == other { value += 5 }
            else if n < 27 && n / 9 == other / 9 {
                if abs(n - other) == 1 { value += 3 }
                if abs(n - other) == 2 { value += 1 }
            }
        }
        return value
    }

    private func opponentDiscard(_ player: Int) -> Int {
        let hand = hands[player]
        switch match.level {
        case .advanced:
            /* the strong seats play to the table's minimum, not to shape alone -- otherwise
               they chase hands they could not declare if they finished them */
            let visible = rivers.flatMap { $0 } + melds.flatMap { $0.flatMap { $0 } }
            if let pick = Coach.recommend(hand, exposed: melds[player].count, publicTiles: visible,
                                          melds: melds[player], seatWind: 27 + wind(of: player),
                                          roundWind: 27 + match.round, minFaan: minFaan),
               let i = hand.firstIndex(of: pick.tile) { return i }
            return 0
        case .beginner:
            let options = hand.indices.sorted { shapeScore(hand, $0) < shapeScore(hand, $1) }.prefix(3)
            return options.randomElement() ?? 0
        case .intermediate:
            return hand.indices.min { shapeScore(hand, $0) < shapeScore(hand, $1) } ?? 0
        }
    }

    // MARK: - discards and claims

    func playerDiscard(at index: Int) {
        guard phase == .player, hands[0].indices.contains(index) else { return }
        discard(0, at: index)
    }

    private func discard(_ player: Int, at index: Int) {
        guard hands[player].indices.contains(index) else { return }
        let tile = hands[player][index]
        if player == 0 { recordDiscard(tile) }
        hands[player].remove(at: index)
        rivers[player].append(tile)
        Sound.clack()
        if player == 0 { newTileIndex = -1 }
        lastDiscard = (player, tile, rivers[player].count - 1)
        claimNotice = ""
        callWord = nil
        resolveDiscard(from: player, tile: tile, proceed: false)
    }

    private func recordDiscard(_ tile: Int) {
        let options = playerChoices()
        guard let best = coachPick(), let played = options.first(where: { $0.tile == tile }) else { return }
        var line = "You discarded \(Tiles.name(tile)), leaving \(played.copies) unseen improving copies."
        if played.distance > best.distance {
            line += " Discarding \(Tiles.name(best.tile)) instead would leave you \(Self.distanceText(best.distance))."
        } else if played.copies < best.copies {
            line += " \(Tiles.name(best.tile)) kept the same hand distance with \(best.copies) improving copies."
        } else {
            line += " That ties the strongest discard by hand distance and improving copies."
        }
        note = line
        let distanceCost = played.distance - best.distance
        let copyCost = best.copies - played.copies
        decisions.append(Decision(kind: distanceCost > 0 || copyCost > 0 ? .improve : .strong,
                                  cost: distanceCost * 150 + copyCost, text: line))
    }

    private func claimOptions(hand: [Int], meldCount: Int, tile: Int, isNext: Bool,
                              replacementAvailable: Bool, worthIt: ([Int]) -> Bool) -> [ClaimOption] {
        var options: [ClaimOption] = []
        if Hand.winning(hand + [tile], melds: meldCount) && worthIt(hand + [tile]) {
            options.append(ClaimOption(name: "Win", use: [], priority: 3))
        }
        if meldCount >= 4 { return options }
        let matching = hand.filter { $0 == tile }.count
        if matching >= 3 && replacementAvailable {
            options.append(ClaimOption(name: "Kong", use: [tile, tile, tile], priority: 2))
        }
        if matching >= 2 {
            options.append(ClaimOption(name: "Pung", use: [tile, tile], priority: 2))
        }
        if isNext && tile < 27 {
            for start in (tile - 2)...tile where start >= 0 {
                let run = [start, start + 1, start + 2]
                let use = run.filter { $0 != tile }
                guard run.allSatisfy({ $0 / 9 == tile / 9 }) else { continue }
                var rest = hand
                var ok = true
                for needed in use {
                    if let i = rest.firstIndex(of: needed) { rest.remove(at: i) } else { ok = false; break }
                }
                if ok {
                    options.append(ClaimOption(name: "Chow " + run.map { "\($0 % 9 + 1)" }.joined(separator: "–"),
                                               use: use, priority: 1))
                }
            }
        }
        /* A chow is called a chow. The run is only on the button when there is more than
           one to choose between, and it never goes into what is said or announced. */
        let chows = options.enumerated().filter { $0.element.call == "Chow" }
        if chows.count == 1, let only = chows.first {
            options[only.offset] = ClaimOption(name: "Chow", use: only.element.use, priority: 1)
        }
        return options
    }

    private func resolveDiscard(from player: Int, tile: Int, proceed: Bool) {
        turnTask?.cancel()
        let next = (player + 1) % 4
        var candidates: [ClaimOption] = []
        for distance in 1...3 {
            let claimant = (player + distance) % 4
            let found = claimOptions(hand: hands[claimant], meldCount: melds[claimant].count,
                                     tile: tile, isNext: distance == 1,
                                     replacementAvailable: wall.contains { $0 < 34 },
                                     worthIt: { self.winsWith(claimant, tiles: $0, selfDraw: false) })
            candidates += found.map {
                var option = $0
                option.player = claimant
                option.distance = distance
                return option
            }
        }
        let bot = candidates.filter { $0.player != 0 }
            .sorted { ($0.priority, -$0.distance) > ($1.priority, -$1.distance) }.first
        let mine = candidates.filter { option in
            guard option.player == 0 else { return false }
            guard let bot else { return true }
            return option.priority > bot.priority
                || (option.priority == bot.priority && option.distance < bot.distance)
        }

        if !proceed && !mine.isEmpty {
            offer = Offer(from: player, tile: tile, options: mine, bot: bot)
            phase = .offer
            choice = -1
            return
        }
        if player != 0 && !proceed {
            phase = .review
            turnTask = Task { [weak self] in
                guard let self else { return }
                try? await Task.sleep(for: .seconds(self.match.level.review))
                guard !Task.isCancelled else { return }
                self.resolveDiscard(from: player, tile: tile, proceed: true)
            }
            return
        }
        if let bot { resolveClaim(from: player, tile: tile, option: bot) }
        else { takeTurn(next) }
    }

    private func resolveClaim(from player: Int, tile: Int, option: ClaimOption) {
        let claimant = option.player
        let who = claimant == 0 ? "You" : Tiles.winds[wind(of: claimant)]
        if !rivers[player].isEmpty { rivers[player].removeLast() }
        lastDiscard = nil
        if option.name == "Win" {
            hands[claimant].append(tile)
            finish("\(who)\(claimant == 0 ? " win on " : " wins on ")\(Tiles.name(tile)).", winner: claimant)
            return
        }
        for used in option.use {
            if let i = hands[claimant].firstIndex(of: used) { hands[claimant].remove(at: i) }
        }
        melds[claimant].append((option.use + [tile]).sorted())
        Sound.meld()
        Sound.say(option.call)
        claimNotice = "\(who) called \(option.call) on \(Tiles.name(tile))."
        callWord = option.call
        if option.name == "Kong" { takeTurn(claimant) } else { playTurn(claimant, drawn: false) }
    }

    func claim(_ option: ClaimOption) {
        guard let offer else { return }
        let after = claimDistance(option)
        let before = Hand.distance(hands[0], exposed: melds[0].count)
        var impact = ""
        if let after {
            impact = after < before ? " It moved you closer to ready."
                : after == before ? " It kept the same distance to ready."
                : " It left you farther from ready."
        }
        decisions.append(Decision(kind: .call, cost: 0,
                                  text: "Called \(option.call) on \(Tiles.name(offer.tile)).\(impact)",
                                  efficient: option.name == "Win" || (after.map { $0 < before } ?? false)))
        resolveClaim(from: offer.from, tile: offer.tile, option: option)
    }

    func pass() {
        guard let offer else { return }
        decisions.append(Decision(kind: .pass, cost: 0,
                                  text: "Passed on \(Tiles.name(offer.tile)) without opening another set."))
        self.offer = nil
        if let bot = offer.bot { resolveClaim(from: offer.from, tile: offer.tile, option: bot) }
        else { takeTurn((offer.from + 1) % 4) }
    }

    func declareSelfDraw() {
        guard phase == .player, canSelfDraw, winsWith(0, tiles: hands[0], selfDraw: true) else { return }
        finish("You win by self-draw.", winner: 0)
    }

    // MARK: - the end of a hand

    /* A finished shape is not always a win: away from a beginner table a hand has to be
       worth the table's minimum before it can be declared. */
    func winsWith(_ player: Int, tiles: [Int], selfDraw: Bool) -> Bool {
        guard Hand.winning(tiles, melds: melds[player].count) else { return false }
        guard minFaan > 0 else { return true }
        return Scoring.faanFor(concealed: tiles, exposed: melds[player], bonuses: bonuses[player],
                               seatWind: wind(of: player), roundWind: match.round,
                               won: true, selfDraw: selfDraw).faan >= minFaan
    }

    var canDeclareWin: Bool {
        phase == .player && canSelfDraw && winsWith(0, tiles: hands[0], selfDraw: true)
    }

    private func grade(_ player: Int, winner: Int?) -> SeatScore {
        let won = player == winner
        let reading = Scoring.faanFor(concealed: hands[player], exposed: melds[player],
                                      bonuses: bonuses[player], seatWind: wind(of: player),
                                      roundWind: match.round, won: won,
                                      selfDraw: canSelfDraw && seat == winner)
        let away = Hand.distance(hands[player].filter { $0 < 34 }, exposed: melds[player].count)
        return SeatScore(
            seat: player, won: won,
            name: player == 0 ? "You" : Tiles.winds[wind(of: player)],
            mark: Tiles.windMarks[wind(of: player)],
            faan: reading.faan, away: away, wins: reading.wins,
            note: won ? (reading.had.isEmpty ? "a plain hand" : reading.had.joined(separator: ", "))
                      : (away <= 0 ? "" : "\(away) tile\(away == 1 ? "" : "s") away"),
            score: won ? "\(reading.faan) faan"
                       : (reading.faan > 0 ? "\(reading.faan) faan held" : "—"))
    }

    private func finish(_ message: String, winner: Int?) {
        guard phase != .ended else { return }
        turnTask?.cancel()
        var rows = (0..<4).map { grade($0, winner: winner) }
        rows.sort { a, b in
            if a.seat == winner { return true }
            if b.seat == winner { return false }
            if a.faan != b.faan { return a.faan > b.faan }
            return a.away < b.away
        }
        if let winner {
            match.wins[winner] += 1
            match.score[winner] += rows.first { $0.seat == winner }?.faan ?? 0
        }
        completed.append(decisions)

        let next = nextDeal(dealer: dealer, round: match.round, dealt: match.dealt, winner: winner)
        match.nextDealer = next.dealer
        match.round = next.round
        match.dealt = next.dealt
        var line = message + " " + standings + "."
        if next.over {
            let best = match.score.max() ?? 0
            let champion = match.score.firstIndex(of: best) ?? 0
            match.winner = champion
            line += " " + (champion == 0 ? "You take" : "\(Tiles.winds[wind(of: champion)]) takes")
                  + " the match on \(best) faan."
        }
        phase = .ended
        note = line
        finalScores = rows
        if winner != nil { Sound.say("Win") }
        keep(handOver: true)
    }

    // MARK: - what the coach says

    private var analysisKey: String?
    private var cachedChoices: [DiscardChoice] = []
    private var cachedPick: Recommendation?

    func playerChoices() -> [DiscardChoice] {
        let visible = rivers.flatMap { $0 } + melds.flatMap { $0.flatMap { $0 } }
        let key = "\(hands[0])|\(melds[0].count)|\(visible.count)|\(minFaan)|\(match.round)"
        if analysisKey != key {
            /* The hand is read once and the table and the coach's line are both shown that
               one reading, so the ring on a tile and the sentence under it cannot disagree. */
            let choices = Coach.discardChoices(hands[0], exposed: melds[0].count, publicTiles: visible)
            cachedChoices = choices
            cachedPick = Coach.recommend(hands[0], exposed: melds[0].count, publicTiles: visible,
                                         melds: melds[0], seatWind: 27 + wind(of: 0),
                                         roundWind: 27 + match.round, minFaan: minFaan,
                                         choices: choices)
            analysisKey = key
        }
        return cachedChoices
    }

    func coachPick() -> Recommendation? {
        _ = playerChoices()
        return cachedPick
    }

    static func distanceText(_ distance: Int) -> String {
        distance == 0 ? "one tile from a complete hand"
        : distance == -1 ? "a complete hand"
        : "\(distance) steps from ready"
    }

    private func claimDistance(_ option: ClaimOption) -> Int? {
        guard !option.use.isEmpty, option.name != "Kong" else { return nil }
        var rest = hands[0]
        for used in option.use {
            if let i = rest.firstIndex(of: used) { rest.remove(at: i) }
        }
        guard !rest.isEmpty else { return nil }
        return rest.indices.map { i in
            Hand.distance(rest.enumerated().filter { $0.offset != i }.map { $0.element },
                          exposed: melds[0].count + 1)
        }.min()
    }

    /* What to do with the tile being offered: a set is worth taking when it leaves the hand
       nearer ready than it is now, and a kong neither helps nor hurts the shape. */
    func claimAdvice() -> (take: ClaimOption?, why: String) {
        guard let offer else { return (nil, "") }
        let current = Hand.distance(hands[0], exposed: melds[0].count)
        let need = minFaan
        let seatWind = 27 + wind(of: 0), roundWind = 27 + match.round

        /* A set put down cannot be picked up again, so a call that puts the minimum out of
           reach is not a call at all, whatever it does for the shape. */
        func ceilingAfter(_ option: ClaimOption) -> Int {
            guard !option.use.isEmpty else { return Int.max }
            var rest = hands[0]
            for used in option.use {
                if let i = rest.firstIndex(of: used) { rest.remove(at: i) }
            }
            return Coach.faanCeiling(rest, melds: melds[0] + [(option.use + [offer.tile]).sorted()],
                                     seatWind: seatWind, roundWind: roundWind)
        }

        /* A pung of a dragon, or of your own seat or the round wind, buys a faan outright and
           cannot be made as a run later. It is worth taking even where it does nothing for
           the shape, which is the opposite of how a chow is worth taking. */
        let pays = Set(Tiles.dragons + [seatWind, roundWind])
        struct Read { let option: ClaimOption; let after: Int; let ceiling: Int; let value: Int }
        let read: [Read] = offer.options.compactMap { option in
            let after: Int?
            if option.name == "Win" { after = -2 }
            else if option.name == "Kong" { after = current }
            else { after = claimDistance(option) }
            guard let after else { return nil }
            return Read(option: option, after: after,
                        ceiling: option.name == "Win" ? Int.max : ceilingAfter(option),
                        value: (option.name == "Pung" || option.name == "Kong")
                               && pays.contains(offer.tile) ? 1 : 0)
        }
        let legal = read.filter { need == 0 || $0.ceiling >= need }
        let best = legal.sorted { a, b in
            if a.value != b.value { return a.value > b.value }
            return a.after < b.after
        }.first

        if let best, best.option.name == "Win" { return (best.option, "the hand is there, so take it") }
        if let best, best.value > 0 {
            return (best.option, "a \(best.option.call.lowercased()) of \(Tiles.name(offer.tile)) is a faan"
                               + " in itself, and it cannot be made as a run later")
        }
        if let best, best.after < current {
            return (best.option, "it leaves you \(Self.distanceText(best.after))")
        }
        /* Nothing legal to call. Whether the call is what shuts the door depends on whether
           the door was open to begin with: a hand that has already run out of routes is not
           being kept alive by passing. */
        if need > 0, legal.isEmpty, !read.isEmpty {
            let open = Coach.faanCeiling(hands[0], melds: melds[0], seatWind: seatWind, roundWind: roundWind) >= need
            return (nil, open
                ? "every call here would put \(need) faan out of reach, and a hand that cannot be declared is not worth opening"
                : "this hand can no longer reach \(need) faan, whatever you do with this tile -- play it out safely")
        }
        return (nil, "no call here brings you nearer ready, and passing keeps your hand concealed")
    }

    /// The one line under the table, and the whole of what the coach says.
    func coachLine() -> (lead: String, rest: String)? {
        guard coach, !counting, phase != .ended else { return nil }
        if phase == .offer {
            let (take, why) = claimAdvice()
            return (take.map { "Take the \($0.call.lowercased())" } ?? "Pass", why)
        }
        /* While the table plays on there is nothing to advise -- but the line stays, because
           a row that came and went every turn would shift the controls under it each time. */
        guard phase == .player else { return ("", "Watching the table.") }
        guard let pick = coachPick() else { return nil }

        var line = pick.why + "."
        /* If you have already picked a different tile up, the line says what that one costs
           rather than repeating itself. */
        if choice >= 0, hands[0].indices.contains(choice) {
            let mineTile = hands[0][choice]
            if mineTile != pick.tile, let mine = playerChoices().first(where: { $0.tile == mineTile }) {
                line += mine.distance > pick.distance
                    ? " \(Tiles.name(mine.tile)) would leave you \(Self.distanceText(mine.distance))."
                    : " \(Tiles.name(mine.tile)) is the same distance, on \(mine.copies) improving tiles against \(pick.copies)."
            }
        }
        /* Name the hand it is steering towards, once it has one -- and say, once a match,
           that the threshold behind it is a working rule rather than a published one. */
        let dir = pick.direction
        if minFaan > 0, !dir.name.isEmpty, dir.kind != .valuePungs {
            line += " You are on \(dir.name), \(dir.faan) faan."
            if !dir.rule.isEmpty && !saidDirection {
                line += " \(dir.rule) is a working rule, not a published one."
                saidDirection = true
            }
        }
        return ("Discard \(Tiles.name(pick.tile))", line)
    }

    var statusLine: String {
        let lead: String
        switch phase {
        case .ended: lead = note
        case .offer: lead = "Claim \(Tiles.name(offer?.tile ?? 0)) or pass"
        case .player: lead = newTileIndex >= 0
            ? "You drew \(Tiles.name(hands[0][newTileIndex])) · Your discard" : "Your discard"
        default: lead = "Opponent's turn"
        }
        let said = !claimNotice.isEmpty ? claimNotice + " "
            : (lastDiscard.map { $0.seat != 0 ? "\(Tiles.winds[wind(of: $0.seat)]) discarded \(Tiles.name($0.tile)). " : "" } ?? "")
        return said + lead + " · \(Tiles.winds[match.round]) round · \(wall.count) in wall"
    }

    /// What the review has to say about the hands played so far.
    func review() -> (well: [String], work: [String], every: [String]) {
        let scope = match.winner == nil ? Array(completed.suffix(1)) : completed
        let all = scope.flatMap { $0 }
        let strong = all.filter { $0.kind == .strong }
        let calls = all.filter { $0.kind == .call }
        var well: [String] = []
        if let first = strong.first {
            well.append("\(strong.count) discard\(strong.count == 1 ? " tied" : "s tied") the best option"
                      + " for hand shape and unseen improving copies. " + first.text)
        }
        if let efficient = calls.first(where: { $0.efficient }) { well.append(efficient.text) }
        var work = all.filter { $0.kind == .improve }.sorted { $0.cost > $1.cost }.prefix(3).map(\.text)
        if !work.isEmpty {
            work.append("Before discarding, compare hand distance first, then how many unseen tiles improve each option.")
        }
        if calls.contains(where: { !$0.efficient }) {
            work.append("Before calling, check what it does to your hand shape and how you plan to earn faan with an open hand.")
        }
        if well.isEmpty { well = ["No clear strengths to highlight from the decisions recorded."] }
        if work.isEmpty { work = ["No lower-ranked discards stood out. In the next hand, practise finding a path to \(max(minFaan, 3)) faan early."] }
        return (well, work, all.map(\.text))
    }

    // MARK: - the table, kept across a launch

    private struct Kept: Codable {
        var handOver: Bool
        var wall: [Int]
        var hands: [[Int]]
        var bonuses: [[Int]]
        var melds: [[[Int]]]
        var rivers: [[Int]]
        var dealer: Int
        var match: MatchState
        var note: String
        var coach: Bool
        var turnSeconds: Double
        var newTileIndex: Int
        var canSelfDraw: Bool
    }
    private static let keptKey = "mahjong-table-v1"

    /* Saved at the one moment a hand can be picked up again exactly as it was left: your own
       turn, nothing in the air, no claim waiting on an answer and no timer half run. That is
       also the moment anyone actually walks away from it. */
    private func keep(handOver: Bool) {
        let kept = Kept(handOver: handOver, wall: wall, hands: hands, bonuses: bonuses,
                        melds: melds, rivers: rivers, dealer: dealer, match: match, note: note,
                        coach: coach, turnSeconds: turnSeconds, newTileIndex: newTileIndex,
                        canSelfDraw: canSelfDraw)
        if let data = try? JSONEncoder().encode(kept) {
            UserDefaults.standard.set(data, forKey: Self.keptKey)
            Account.shared.push(.table)
        }
    }

    /// Read the store again, after signing in has brought a table down from another phone.
    func reload() { _ = restore() }

    private func restore() -> Bool {
        guard let data = UserDefaults.standard.data(forKey: Self.keptKey),
              let kept = try? JSONDecoder().decode(Kept.self, from: data),
              kept.hands.count == 4 else { return false }
        match = kept.match
        settings = MatchState(level: kept.match.level, minFaan: kept.match.minFaan)
        dealer = kept.dealer
        coach = kept.coach
        turnSeconds = kept.turnSeconds
        if kept.handOver {
            dealer = match.winner == nil ? match.nextDealer : 0
            if match.winner != nil { newMatch() } else { reset() }
            return true
        }
        wall = kept.wall; hands = kept.hands; bonuses = kept.bonuses
        melds = kept.melds; rivers = kept.rivers; note = kept.note
        newTileIndex = kept.newTileIndex; canSelfDraw = kept.canSelfDraw
        choice = -1; offer = nil; claimNotice = ""; callWord = nil
        counting = false; seat = 0; phase = .player
        return true
    }
}
