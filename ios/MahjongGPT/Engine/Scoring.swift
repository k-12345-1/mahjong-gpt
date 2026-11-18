import Foundation

struct FaanWin: Identifiable {
    let id = UUID()
    let why: String
    let faan: Int
    /// where in the laid-out hand the faan was earned, so the tiles can be pointed at
    let at: [Int]
}

struct FaanReading {
    let faan: Int
    let had: [String]
    let wins: [FaanWin]
}

/* The faan table follows the modern Hong Kong "new chapter" list: every pattern below is
   scored at the value that list gives it, a hand is capped at the ten-faan limit, and the
   patterns that contain other patterns are counted once, not twice.

   The count takes no part of the table with it: everything it needs is in the hand it is
   given, which is what makes it checkable on its own. */
enum Scoring {
    static let limit = 10

    private enum Kind { case pung, chow, kong, pair }
    private struct Scored { let kind: Kind; let tile: Int }

    static func faanFor(concealed held: [Int],
                        exposed: [[Int]],
                        bonuses flowers: [Int],
                        seatWind: Int,
                        roundWind: Int = 0,
                        won: Bool,
                        selfDraw: Bool) -> FaanReading {
        let concealed = held.filter { $0 < 34 }
        let tiles = (concealed + exposed.flatMap { $0 }).filter { $0 < 34 }
        var counts = [Int](repeating: 0, count: 34)
        for tile in tiles { counts[tile] += 1 }

        /* The tiles as they are laid out in the seat -- concealed hand first, then the
           melds and bonuses beside it -- so each faan can point at the tiles that earned it. */
        let shown = held + exposed.flatMap { $0 } + flowers
        func places(_ tile: Int) -> [Int] {
            shown.indices.filter { shown[$0] == tile }
        }
        func placesAny(_ list: [Int]) -> [Int] {
            shown.indices.filter { list.contains(shown[$0]) }
        }
        let everything = shown.indices.filter { shown[$0] < 34 }

        var faan = 0
        var had: [String] = []
        var wins: [FaanWin] = []
        func add(_ tag: String, _ why: String, _ n: Int, _ at: [Int] = []) {
            faan += n
            had.append(tag)
            wins.append(FaanWin(why: why, faan: n, at: at))
        }
        func done() -> FaanReading {
            FaanReading(faan: min(faan, limit), had: had, wins: wins)
        }

        /* Thirteen orphans is its own hand and its own limit: nothing else is counted on it. */
        if won, tiles.count == 14,
           Tiles.orphans.allSatisfy({ counts[$0] >= 1 }),
           tiles.allSatisfy({ Tiles.orphans.contains($0) }) {
            add("thirteen orphans", "The thirteen orphans", 13, everything)
            return done()
        }

        func kindOf(_ meld: [Int]) -> Kind {
            guard let first = meld.first else { return .chow }
            if meld.allSatisfy({ $0 == first }) { return meld.count >= 4 ? .kong : .pung }
            return .chow
        }
        let open = exposed.map { Scored(kind: kindOf($0), tile: $0[0]) }
        var closed = [Int](repeating: 0, count: 34)
        for tile in concealed { closed[tile] += 1 }
        let rest = Hand.partition(closed, needPair: true)
        let sets: [Scored]? = rest.map { reading in
            open + reading.filter { $0.kind != .pair }
                .map { Scored(kind: $0.kind == .pung ? .pung : .chow, tile: $0.tile) }
        }
        let allPungs = (sets?.count == 4) && (sets?.allSatisfy { $0.kind != .chow } ?? false)
        let allChows = (sets?.count == 4) && (sets?.allSatisfy { $0.kind == .chow } ?? false)

        /* All kongs is a limit hand on its own. */
        if let sets, sets.filter({ $0.kind == .kong }).count == 4 {
            add("all kongs", "Four kongs", 13, everything)
            return done()
        }

        let dragonPungs = Tiles.dragons.filter { counts[$0] >= 3 }
        let dragonPair = Tiles.dragons.filter { counts[$0] == 2 }
        if dragonPungs.count == 3 {
            add("great three dragons", "All three dragons, in pungs", 8, placesAny(dragonPungs))
        } else if dragonPungs.count == 2 && dragonPair.count == 1 {
            add("small three dragons", "Two dragon pungs and a pair of the third", 5,
                placesAny(dragonPungs + dragonPair))
        } else {
            for d in dragonPungs {
                add("dragon pung", "Pung of " + Tiles.name(d), 1, places(d))
            }
        }

        let windPungs = [27, 28, 29, 30].filter { counts[$0] >= 3 }
        let windPair = [27, 28, 29, 30].filter { counts[$0] == 2 }
        let mine = 27 + seatWind
        if windPungs.count == 4 {
            add("great four winds", "All four winds, in pungs", 13, placesAny(windPungs))
        } else if windPungs.count == 3 && windPair.count == 1 {
            add("small four winds", "Three wind pungs and a pair of the fourth", 6,
                placesAny(windPungs + windPair))
        } else {
            /* A pung of East held by East in the East round counts twice, once as the seat
               wind and once as the round wind, which is the one place the two stack. */
            if counts[mine] >= 3 { add("seat wind", "Pung of your own seat wind", 1, places(mine)) }
            let prevailing = 27 + roundWind
            if counts[prevailing] >= 3 { add("round wind", "Pung of the round wind", 1, places(prevailing)) }
        }

        let suitsPresent = [0, 1, 2].filter { su in tiles.contains { $0 < 27 && $0 / 9 == su } }
        let honours = tiles.contains { $0 >= 27 }
        let terminals = !tiles.isEmpty && tiles.allSatisfy { $0 >= 27 || $0 % 9 == 0 || $0 % 9 == 8 }

        if suitsPresent.isEmpty && !tiles.isEmpty {
            add("all honours", "Honours all the way through", 10, everything)
        } else if terminals && allPungs && !honours {
            add("pure terminals", "Ones and nines, nothing else", 10, everything)
        } else if terminals && allPungs {
            add("mixed terminals", "Ones, nines and honours only", 4, everything)
        } else {
            if suitsPresent.count == 1 && !honours {
                add("full flush", "One suit and nothing else", 7, everything)
            } else if suitsPresent.count == 1 {
                add("half flush", "One suit plus honours", 3, everything)
            }
            if allPungs && exposed.isEmpty {
                add("all concealed pungs", "Four pungs, not one of them opened", 8, everything)
            } else if allPungs {
                add("all pungs", "Every set a pung", 3, everything)
            }
        }

        if won {
            /* All concealed pungs already says the hand was never opened. */
            if exposed.isEmpty && !had.contains("all concealed pungs") {
                add("concealed", "Won without opening a set", 1)
            }
            if selfDraw { add("self-draw", "Won on a tile drawn yourself", 1) }
            if flowers.isEmpty {
                add("no flowers", "Finished with no flowers", 1)
            } else {
                /* A full set of flowers is scored instead of, not as well as, the seat
                   flower that sits inside it. */
                var full: [Int] = []
                for base in [34, 38] where (0...3).allSatisfy({ flowers.contains(base + $0) }) {
                    full.append(base)
                    add("a full set", "All four " + (base == 34 ? "flowers" : "seasons"), 2,
                        placesAny([base, base + 1, base + 2, base + 3]))
                }
                for base in [34, 38] where !full.contains(base) {
                    let own = base + seatWind
                    if flowers.contains(own) {
                        add("own flower", "Your own " + Tiles.name(own), 1, places(own))
                    }
                }
            }
            if allChows { add("all chows", "Every set a run", 1, everything) }
            if faan == 0 { add("a plain hand", "A plain hand, four sets and a pair", 1, everything) }
        }
        if faan > limit { had.append("over the limit") }
        return done()
    }
}
