import Foundation

enum SetKind { case pung, chow, pair }

struct TileSet {
    let kind: SetKind
    let tile: Int
}

enum Hand {
    /// Four sets and a pair, with `melds` of them already face up on the table.
    static func winning(_ tiles: [Int], melds: Int = 0) -> Bool {
        var counts = [Int](repeating: 0, count: 34)
        for tile in tiles {
            if tile >= 34 { return false }
            counts[tile] += 1
        }
        if tiles.count != (4 - melds) * 3 + 2 { return false }

        func sets() -> Bool {
            guard let i = counts.firstIndex(where: { $0 > 0 }) else { return true }
            if counts[i] >= 3 {
                counts[i] -= 3
                let ok = sets()
                counts[i] += 3
                if ok { return true }
            }
            if i < 27 && i % 9 < 7 && counts[i + 1] > 0 && counts[i + 2] > 0 {
                counts[i] -= 1; counts[i + 1] -= 1; counts[i + 2] -= 1
                let ok = sets()
                counts[i] += 1; counts[i + 1] += 1; counts[i + 2] += 1
                return ok
            }
            return false
        }

        for i in 0..<34 where counts[i] >= 2 {
            counts[i] -= 2
            let ok = sets()
            counts[i] += 2
            if ok { return true }
        }
        return false
    }

    /* One reading of a closed hand as sets and a pair, pungs preferred over chows so that
       a hand which can be read as all pungs is. Nil when the tiles do not make a hand,
       which is how every pattern that needs complete sets stays out of the count. */
    static func partition(_ counts: [Int], needPair: Bool) -> [TileSet]? {
        var c = counts
        func walk(_ needPair: Bool) -> [TileSet]? {
            guard let i = c.firstIndex(where: { $0 > 0 }) else { return needPair ? nil : [] }
            if c[i] >= 3 {
                c[i] -= 3
                let rest = walk(needPair)
                c[i] += 3
                if let rest { return [TileSet(kind: .pung, tile: i)] + rest }
            }
            if i < 27 && i % 9 < 7 && c[i + 1] > 0 && c[i + 2] > 0 {
                c[i] -= 1; c[i + 1] -= 1; c[i + 2] -= 1
                let rest = walk(needPair)
                c[i] += 1; c[i + 1] += 1; c[i + 2] += 1
                if let rest { return [TileSet(kind: .chow, tile: i)] + rest }
            }
            if needPair && c[i] >= 2 {
                c[i] -= 2
                let rest = walk(false)
                c[i] += 2
                if let rest { return [TileSet(kind: .pair, tile: i)] + rest }
            }
            return nil
        }
        return walk(needPair)
    }

    /* How far a hand is from being ready: -1 is finished, 0 is waiting on one tile, and
       anything above that is how many steps of shape it still has to make. */
    static func distance(_ hand: [Int], exposed: Int = 0) -> Int {
        var counts = [Int](repeating: 0, count: 34)
        for tile in hand where tile < 34 { counts[tile] += 1 }
        var best = 8

        func search(_ start: Int, _ sets: Int, _ pairs: Int, _ partials: Int) {
            var start = start
            while start < 34 && counts[start] == 0 { start += 1 }
            if start == 34 {
                best = min(best, 8 - 2 * sets - min(4 - sets, partials) - pairs)
                return
            }
            if best == -1 { return }

            func take(_ indices: [Int], _ nextSets: Int, _ nextPairs: Int, _ nextPartials: Int) {
                for i in indices { counts[i] -= 1 }
                search(start, nextSets, nextPairs, nextPartials)
                for i in indices { counts[i] += 1 }
            }

            let n = start, suited = n < 27
            if sets < 4 {
                if counts[n] >= 3 { take([n, n, n], sets + 1, pairs, partials) }
                if suited && n % 9 < 7 && counts[n + 1] > 0 && counts[n + 2] > 0 {
                    take([n, n + 1, n + 2], sets + 1, pairs, partials)
                }
            }
            if counts[n] >= 2 {
                if pairs == 0 { take([n, n], sets, 1, partials) }
                if partials < 4 - sets { take([n, n], sets, pairs, partials + 1) }
            }
            if partials < 4 - sets && suited {
                if n % 9 < 8 && counts[n + 1] > 0 { take([n, n + 1], sets, pairs, partials + 1) }
                if n % 9 < 7 && counts[n + 2] > 0 { take([n, n + 2], sets, pairs, partials + 1) }
            }
            take([n], sets, pairs, partials)
        }

        search(0, exposed, 0, 0)
        return best
    }
}
