import Foundation

struct DiscardChoice {
    let tile: Int
    let distance: Int
    let copies: Int
}

struct Direction {
    enum Kind: String { case halfFlush, fullFlush, allPungs, valuePungs, undecided }
    let kind: Kind
    let suit: Int
    let name: String
    let faan: Int
    let suited: [Int]
    /// the working rule it leans on, said out loud once a match
    let rule: String
}

struct Recommendation {
    let tile: Int
    let distance: Int
    let copies: Int
    let why: String
    let blocked: Bool
    let direction: Direction
}

/* ---- the tile to throw ---------------------------------------------------------------
   Shape decides it: the discard that leaves the hand closest to ready, and among the ones
   that tie, the one with the most tiles still unseen that would improve what is left. Faan
   only enters where the table has a minimum to clear -- under that a chicken hand pays, so
   the widest wait simply is the best hand. Where there is a minimum, a dragon pair or a
   suit the hand is nearly clean in is worth giving up some waits for, and the trade is made
   in waits so the two are comparable.

   Note the convention here and nowhere else: seatWind and roundWind are tile indices
   (27...30), not the 0...3 the scorer takes. */
enum Coach {
    static let flushTiles = 7
    static let pungPairs = 3
    /// a hand this close has stopped choosing what it wants to be, so shape decides the rest
    static let stillShaping = 2

    static func discardChoices(_ hand: [Int], exposed: Int, publicTiles: [Int]) -> [DiscardChoice] {
        var seen = [Int](repeating: 0, count: 34)
        for tile in hand + publicTiles where tile < 34 { seen[tile] += 1 }

        var choices: [DiscardChoice] = []
        for tile in Set(hand) {
            var rest = hand
            if let i = rest.firstIndex(of: tile) { rest.remove(at: i) }
            let distance = Hand.distance(rest, exposed: exposed)
            var copies = 0
            for draw in 0..<34 {
                let left = max(0, 4 - seen[draw])
                if left > 0 && Hand.distance(rest + [draw], exposed: exposed) < distance {
                    copies += left
                }
            }
            choices.append(DiscardChoice(tile: tile, distance: distance, copies: copies))
        }
        return choices.sorted {
            if $0.distance != $1.distance { return $0.distance < $1.distance }
            if $0.copies != $1.copies { return $0.copies > $1.copies }
            return $0.tile < $1.tile
        }
    }

    /* ---- can the hand still be declared? ---------------------------------------------
       Hong Kong is a minimum-constraint game. Four runs and a pair is one faan, and at a
       three-faan table that is not a cheap win -- it is not a win at all. So faan is not a
       tiebreak to apply on top of shape, it is a legality test to apply before it.

       What settles it is the melds already on the table, because those tiles never come
       back. A run laid down ends All Pungs. A second suit ends both flushes. */
    static func faanCeiling(_ concealed: [Int], melds: [[Int]] = [],
                            seatWind: Int = 27, roundWind: Int = 27) -> Int {
        let down = melds.flatMap { $0 }
        let all = (concealed + down).filter { $0 < 34 }
        var counts = [Int](repeating: 0, count: 34)
        for tile in all { counts[tile] += 1 }

        let openChow = melds.contains { meld in
            guard let first = meld.first else { return false }
            return !meld.allSatisfy { $0 == first }
        }
        let meldSuits = Set(down.filter { $0 < 27 }.map { Tiles.suitOf($0) })
        let meldHonours = down.contains { $0 >= 27 }

        var shape = 0
        for s in 0...2 {
            if !meldSuits.isEmpty && !(meldSuits.count == 1 && meldSuits.contains(s)) { continue }
            if !all.contains(where: { Tiles.suitOf($0) == s }) { continue }
            /* honours already face up rule out the clean flush but not the mixed one */
            shape = max(shape, meldHonours ? 3 : 7)
        }
        if !openChow { shape = max(shape, 3) }

        let pays = Set(Tiles.dragons + [seatWind, roundWind])
        let value = pays.filter { counts[$0] >= 2 }.count
        /* three dragons going at once is not three faan, it is the big hand */
        if Tiles.dragons.filter({ counts[$0] >= 2 }).count == 3 { shape = max(shape, 8) }

        /* every finished hand is worth one, and one more again if it was never opened */
        return max(1, shape + value + (melds.isEmpty ? 1 : 0))
    }

    /* ---- which hand is this going to be? ---------------------------------------------
       Seven tiles of one suit points at a flush; three pairs point at all pungs. Both come
       out of the research as one commercial source's counts rather than a published
       standard -- a working rule, and the coach says so when it leans on it. */
    static func direction(_ hand: [Int], melds: [[Int]] = [],
                          seatWind: Int = 27, roundWind: Int = 27) -> Direction {
        let down = melds.flatMap { $0 }
        let all = (hand + down).filter { $0 < 34 }
        var counts = [Int](repeating: 0, count: 34)
        for tile in all { counts[tile] += 1 }
        let meldSuits = Set(down.filter { $0 < 27 }.map { Tiles.suitOf($0) })
        let suited = [0, 1, 2].map { s in all.filter { Tiles.suitOf($0) == s }.count }
        let open = [0, 1, 2].filter { meldSuits.isEmpty || (meldSuits.count == 1 && meldSuits.contains($0)) }
        let top = open.reduce(open.first ?? 0) { suited[$1] > suited[$0] ? $1 : $0 }

        if !open.isEmpty && suited[top] >= flushTiles {
            let honours = all.contains { $0 >= 27 }
            return Direction(kind: honours ? .halfFlush : .fullFlush, suit: top,
                             name: (honours ? "a half flush in " : "a clean flush in ") + Tiles.suitNames[top],
                             faan: honours ? 3 : 7, suited: suited,
                             rule: "Seven tiles of one suit")
        }
        let openChow = melds.contains { meld in
            guard let first = meld.first else { return false }
            return !meld.allSatisfy { $0 == first }
        }
        if counts.filter({ $0 >= 2 }).count >= pungPairs && !openChow {
            return Direction(kind: .allPungs, suit: -1, name: "all pungs", faan: 3,
                             suited: suited, rule: "Three pairs")
        }
        let pays = Set(Tiles.dragons + [seatWind, roundWind])
        if pays.contains(where: { counts[$0] >= 2 }) {
            return Direction(kind: .valuePungs, suit: -1, name: "a value pung", faan: 1,
                             suited: suited, rule: "")
        }
        return Direction(kind: .undecided, suit: -1, name: "", faan: 0, suited: suited, rule: "")
    }

    /* The suit the hand leans on, melds counted. Leaving the melds out of this read a hand
       with a bamboo chow and a dragon pung face up as whatever its concealed tiles happened
       to be most of -- and the cost below then protected that suit and threw the tiles the
       melds were pointing at. */
    private static func lean(_ hand: [Int], _ melds: [[Int]]) -> (dominant: Int, offSuit: Int) {
        let tiles = hand + melds.flatMap { $0 }
        let suited = [0, 1, 2].map { s in tiles.filter { Tiles.suitOf($0) == s }.count }
        let dominant = suited.firstIndex(of: suited.max() ?? 0) ?? 0
        return (dominant, suited.reduce(0, +) - suited[dominant])
    }

    static func recommend(_ hand: [Int], exposed: Int, publicTiles: [Int],
                          melds: [[Int]] = [], seatWind: Int = 27, roundWind: Int = 27,
                          minFaan: Int = 0,
                          choices: [DiscardChoice]? = nil) -> Recommendation? {
        let scored = choices ?? discardChoices(hand, exposed: exposed, publicTiles: publicTiles)
        guard !scored.isEmpty else { return nil }

        var counts = [Int](repeating: 0, count: 34)
        for tile in hand where tile < 34 { counts[tile] += 1 }
        var gone = [Int](repeating: 0, count: 34)
        for tile in publicTiles where tile < 34 { gone[tile] += 1 }

        let (dominant, offSuit) = lean(hand, melds)
        let pays = Set(Tiles.dragons + [seatWind, roundWind])
        let clean = offSuit <= 4   /* close enough to a flush to be worth steering to */
        func cost(_ tile: Int) -> Int {
            guard minFaan > 0 else { return 0 }
            return (pays.contains(tile) && counts[tile] >= 2 ? 8 : 0)
                 + (clean && Tiles.suitOf(tile) == dominant ? 5 : 0)
        }

        /* While a flush is still being built, the tiles that leave are the ones that can
           never be part of it, shortest suit first to clear a lane. Ordinary tile efficiency
           says the opposite, and riichi guides say to throw the honours first -- actively
           wrong here, because in Hong Kong the honours are the faan that lifts a half flush
           over the floor. */
        let dir = direction(hand, melds: melds, seatWind: seatWind, roundWind: roundWind)
        let shaping = (scored.map { $0.distance }.min() ?? 0) >= stillShaping
        let lane = (minFaan > 0 && shaping && (dir.kind == .halfFlush || dir.kind == .fullFlush))
            ? dir.suit : -1
        func shed(_ tile: Int) -> Int {
            let su = Tiles.suitOf(tile)
            if lane < 0 || su < 0 || su == lane { return 99 }
            /* the shorter the suit the sooner it is gone, and a pair is not broken to do it */
            return dir.suited[su] * 2 + (counts[tile] >= 2 ? 1 : 0)
        }

        /* A tile with nothing built on it: no pair, and in a suit, no neighbour to run with.
           It is the weakest thing a hand can hold, so it leaves before a tile that connects,
           whatever the table's minimum. Counting improving draws alone says the opposite,
           because a scattered hand has more of them. */
        func alone(_ tile: Int) -> Bool {
            guard counts[tile] == 1 else { return false }
            if tile >= 27 { return true }
            return ![-2, -1, 1, 2].contains { d in
                let near = tile + d
                return near >= 0 && near < 34 && Tiles.suitOf(near) == Tiles.suitOf(tile) && counts[near] > 0
            }
        }

        struct Ranked {
            let choice: DiscardChoice
            let shed: Int
            let lonely: Bool
            let pays: Int
            let legal: Bool
            let merit: Int
        }

        /* Legality sorts above everything, then the lane, then shape, then what is loose:
           when nothing left is legal the coach says which wall the hand has run into rather
           than quietly recommending the prettiest dead hand. */
        let ranked = scored.map { c -> Ranked in
            var rest = hand
            if let i = rest.firstIndex(of: c.tile) { rest.remove(at: i) }
            let ceiling = faanCeiling(rest, melds: melds, seatWind: seatWind, roundWind: roundWind)
            return Ranked(choice: c, shed: shed(c.tile), lonely: alone(c.tile),
                          pays: minFaan > 0 && pays.contains(c.tile) ? 1 : 0,
                          legal: minFaan == 0 || ceiling >= minFaan,
                          merit: c.copies - cost(c.tile))
        }.sorted { a, b in
            if a.legal != b.legal { return a.legal && !b.legal }
            if a.shed != b.shed { return a.shed < b.shed }
            if a.choice.distance != b.choice.distance { return a.choice.distance < b.choice.distance }
            if a.lonely != b.lonely { return a.lonely && !b.lonely }
            if a.pays != b.pays { return a.pays < b.pays }
            if a.merit != b.merit { return a.merit > b.merit }
            return a.choice.tile < b.choice.tile
        }

        let best = ranked[0]
        let blocked = minFaan > 0 && !ranked.contains { $0.legal }
        let tile = best.choice.tile

        let why: String
        if blocked {
            why = "this hand can no longer reach \(minFaan) faan, so it cannot be declared -- play it out safely"
        } else if best.shed < 99 {
            why = "you are collecting \(Tiles.suitNames[lane]), and \(Tiles.suitNames[Tiles.suitOf(tile)])"
                + " is the shortest way out of the hand"
        } else if best.choice.distance == -1 {
            why = "the hand is already complete"
        } else if alone(tile) && tile >= 27 {
            why = gone[tile] >= 2 ? "a lone honour, and most of the others are already out"
                                  : "a lone honour with nothing built on it"
        } else if alone(tile) {
            why = "nothing in your hand sits beside it"
        } else if minFaan > 0 && clean && Tiles.suitOf(tile) >= 0 && Tiles.suitOf(tile) != dominant {
            why = "it is off the suit you are collecting"
        } else if best.choice.copies > 0 {
            why = "\(best.choice.copies) unseen tiles would improve what is left"
        } else {
            why = "it costs the hand least"
        }

        return Recommendation(tile: tile, distance: best.choice.distance, copies: best.choice.copies,
                              why: why, blocked: blocked, direction: dir)
    }
}
