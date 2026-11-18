import Foundation

/* A tile is an index. 0...26 are the three suits nine deep, 27...33 the honours --
   four winds then three dragons -- and 34...41 the flowers and seasons, which are
   bonuses rather than tiles you build with. Everything downstream counts in these
   numbers, so the names live here and nowhere else. */
enum Tiles {
    static let suitNames = ["characters", "dots", "bamboo"]
    static let honourNames = ["east", "south", "west", "north",
                              "red-dragon", "green-dragon", "white-dragon"]

    static let faces: [String] = {
        var out = suitNames.flatMap { suit in (1...9).map { "\(suit)-\($0)" } }
        out += honourNames
        out += ["flower", "season"].flatMap { kind in (1...4).map { "\(kind)-\($0)" } }
        return out
    }()

    static let winds = ["East", "South", "West", "North"]
    static let windMarks = ["東", "南", "西", "北"]
    static let dragons = [31, 32, 33]
    /* the ones, the nines and every honour: the thirteen a hand of orphans is made of */
    static let orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]

    /// "characters-5" reads as "5 characters"; everything else just loses its hyphens.
    static func label(_ face: String) -> String {
        let parts = face.split(separator: "-")
        if parts.count == 2, suitNames.contains(String(parts[0])), Int(parts[1]) != nil {
            return "\(parts[1]) \(parts[0])"
        }
        return face.replacingOccurrences(of: "-", with: " ")
    }

    static func name(_ tile: Int) -> String {
        guard tile >= 0 && tile < faces.count else { return "a tile" }
        return label(faces[tile])
    }

    static func image(_ tile: Int) -> String { "tile-\(faces[tile])" }

    /// -1 for an honour, otherwise which of the three suits.
    static func suitOf(_ tile: Int) -> Int { tile < 27 && tile >= 0 ? tile / 9 : -1 }

    static func isBonus(_ tile: Int) -> Bool { tile >= 34 }
}
