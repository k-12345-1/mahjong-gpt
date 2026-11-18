import Foundation

/* The school, one idea a screen, from the 144 tiles to who pays. The text and the tasks
   are the ones the web app teaches; only the way you answer them has changed, because a
   phone is tapped rather than dragged. */

struct LessonCard {
    let cap: String
    let tiles: [String]
    let note: String
}

enum PickRule {
    case chow, pung, kong, pair, bonus

    func accepts(_ faces: [String]) -> Bool {
        let tiles = faces.compactMap { Tiles.faces.firstIndex(of: $0) }
        guard tiles.count == faces.count else { return false }
        switch self {
        case .bonus: return tiles.count == 1 && tiles[0] >= 34
        case .pair: return tiles.count == 2 && tiles[0] == tiles[1]
        case .pung: return tiles.count == 3 && Set(tiles).count == 1
        case .kong: return tiles.count == 4 && Set(tiles).count == 1
        case .chow:
            guard tiles.count == 3 else { return false }
            let run = tiles.sorted()
            return run.allSatisfy { $0 < 27 } && Set(run.map { $0 / 9 }).count == 1
                && run[1] == run[0] + 1 && run[2] == run[1] + 1
        }
    }
}

enum LessonTask {
    case order(prompt: String, row: [String], answer: [Int], note: String)
    case choice(prompt: String, options: [String], answer: Int, note: String, wrong: String)
    case pick(need: Int, rule: PickRule, prompt: String, row: [String], note: String, wrong: String)
    case sort(prompt: String, row: [String], bins: [String], note: String, wrong: String)

    var prompt: String {
        switch self {
        case .order(let p, _, _, _), .choice(let p, _, _, _, _),
             .pick(_, _, let p, _, _, _), .sort(let p, _, _, _, _): p
        }
    }
}

struct Lesson {
    var title: String = ""
    var say: String = ""
    /// the say text read as a numbered sequence rather than one paragraph
    var steps: Bool = false
    var cards: [LessonCard] = []
    var row: [String] = []
    /// the opening tour, which shows the whole set before anything is asked
    var tour: [LessonCard] = []
    var task: LessonTask?
}

enum Lessons {
    static let sortHand = ["characters-3", "dots-7", "flower-2", "bamboo-5", "east",
                           "characters-8", "red-dragon", "dots-2", "north", "bamboo-9",
                           "green-dragon", "season-4", "characters-1"]
    static let kinds = ["Characters", "Dots", "Bamboo", "Dragons", "Winds", "Flowers"]

    static func kindOf(_ face: String) -> Int {
        if face.hasPrefix("characters") { return 0 }
        if face.hasPrefix("dots") { return 1 }
        if face.hasPrefix("bamboo") { return 2 }
        if face.hasSuffix("dragon") { return 3 }
        if face.hasPrefix("flower") || face.hasPrefix("season") { return 5 }
        return 4
    }

    static let all: [Lesson] = [
        Lesson(
            title: "A mahjong set is 144 tiles.",
            tour: [
                LessonCard(cap: "Characters", tiles: ["characters-1", "characters-5", "characters-9"], note: ""),
                LessonCard(cap: "Dots", tiles: ["dots-1", "dots-5", "dots-9"], note: ""),
                LessonCard(cap: "Bamboo", tiles: ["bamboo-1", "bamboo-5", "bamboo-9"], note: ""),
                LessonCard(cap: "Dragons", tiles: ["red-dragon", "green-dragon", "white-dragon"], note: ""),
                LessonCard(cap: "Winds", tiles: ["east", "south", "west", "north"], note: ""),
                LessonCard(cap: "Flowers", tiles: ["flower-1", "flower-2", "season-1", "season-2"], note: ""),
            ],
            task: .sort(prompt: "Tap a tile, then tap its kind.",
                        row: sortHand, bins: kinds,
                        note: "You got it! Tap to continue.",
                        wrong: "萬 marks a character, circles are dots, sticks are bamboo. 中 發 and the blank are the dragons, 東 南 西 北 the winds.")
        ),
        Lesson(
            title: "Here are the characters in numerical order.",
            say: "[[characters-1 characters-2 characters-3 characters-4 characters-5 characters-6 characters-7 characters-8 characters-9]]",
            task: .order(prompt: "Tap these in order, one to nine.",
                         row: ["characters-4", "characters-9", "characters-1", "characters-7", "characters-3",
                               "characters-6", "characters-2", "characters-8", "characters-5"],
                         answer: [2, 6, 4, 0, 8, 5, 3, 7, 1],
                         note: "You got it! Tap to continue.")
        ),
        Lesson(
            title: "Dots are counted by their circles.",
            say: "[[dots-1 dots-2 dots-3 dots-4 dots-5 dots-6 dots-7 dots-8 dots-9]]",
            task: .order(prompt: "Tap the dots in order, one to nine.",
                         row: ["dots-6", "dots-2", "dots-9", "dots-4", "dots-7", "dots-1", "dots-5", "dots-3", "dots-8"],
                         answer: [5, 1, 7, 3, 6, 0, 4, 8, 2],
                         note: "You got it! Tap to continue.")
        ),
        Lesson(
            title: "Bamboo is counted in sticks. The 1 is drawn as a bird.",
            say: "[[bamboo-1 bamboo-2 bamboo-3 bamboo-4 bamboo-5 bamboo-6 bamboo-7 bamboo-8 bamboo-9]]",
            task: .order(prompt: "Tap the bamboo in order, one to nine.",
                         row: ["bamboo-3", "bamboo-8", "bamboo-1", "bamboo-5", "bamboo-9", "bamboo-2", "bamboo-7", "bamboo-4", "bamboo-6"],
                         answer: [2, 5, 0, 7, 3, 8, 6, 1, 4],
                         note: "You got it! Tap to continue.")
        ),
        Lesson(
            title: "Chow",
            say: "Three running numbers in the same suit.\n[[bamboo-2 bamboo-3 bamboo-4]]",
            task: .pick(need: 3, rule: .chow,
                        prompt: "Find a chow in this hand. Tap its three tiles.",
                        row: ["bamboo-2", "dots-6", "characters-9", "east", "dots-5", "white-dragon", "bamboo-8",
                              "characters-3", "dots-7", "east", "characters-9", "bamboo-4", "dots-1"],
                        note: "Three running numbers in one suit.",
                        wrong: "This is incorrect. Try again.")
        ),
        Lesson(
            title: "Runs",
            say: "A run — a chow, or shung — is three tiles in a row in one suit. You can build one quietly in your hand and show it only when the hand is over.\nOr you can claim one. If the player on your left discards the tile you need, say so: the run goes down in front of you, face up, there and then.\nOnly that player’s discard will do. You cannot reach across the table for a run, or cut in ahead of somebody else’s turn. The one exception is the tile that wins the hand — that you may take from anyone.",
            steps: true,
            cards: [
                LessonCard(cap: "Open at both ends", tiles: ["dots-4", "dots-5"], note: "A 3 or a 6 finishes it."),
                LessonCard(cap: "Closed at the end", tiles: ["dots-8", "dots-9"], note: "Only a 7 will do."),
            ],
            task: .choice(prompt: "You hold the 8 and 9 of dots. Which tile finishes the run?",
                          options: ["The 7 of dots", "The 10 of dots", "The 7 of bamboo"], answer: 0,
                          note: "Only a 7, because a suit stops at 9. A run at either end can be filled from one side alone, which is what makes 1-2-3 and 7-8-9 harder to put together than the runs in the middle.",
                          wrong: "A run is three in a row in one suit, and the numbers stop at 9.")
        ),
        Lesson(
            title: "Pung",
            say: "Three of the same tile.\n[[red-dragon red-dragon red-dragon]]",
            task: .pick(need: 3, rule: .pung,
                        prompt: "Find a pung in this hand. Tap its three tiles.",
                        row: ["dots-3", "east", "bamboo-7", "east", "characters-2", "red-dragon", "east",
                              "bamboo-1", "dots-8", "characters-6", "bamboo-4", "dots-5", "white-dragon"],
                        note: "Three East winds. Honours make no runs, so three of a kind is the only set they form.",
                        wrong: "Not three of a kind. A pung is the identical tile three times over.")
        ),
        Lesson(
            title: "Kong",
            say: "Four of the same tile.\n[[dots-5 dots-5 dots-5 dots-5]]",
            task: .pick(need: 4, rule: .kong,
                        prompt: "Find the kong in this hand. Tap its four tiles.",
                        row: ["characters-8", "dots-2", "characters-8", "bamboo-6", "characters-8", "green-dragon",
                              "characters-8", "dots-9", "south", "bamboo-3", "dots-4", "characters-1", "bamboo-9"],
                        note: "All four of the 8 characters — still one set, which is why it earns a replacement tile.",
                        wrong: "Not all four of one tile. A kong is the whole four, no mixture.")
        ),
        Lesson(
            title: "Flowers",
            say: "If you draw one, lay it face up in front of you and take a replacement from the dead wall.\n[[flower-1 flower-2 season-1 season-2]]",
            task: .pick(need: 1, rule: .bonus,
                        prompt: "One of these would be set aside at once. Tap it.",
                        row: ["bamboo-2", "season-3", "dots-6", "characters-4"],
                        note: "That one is a bonus tile: it scores, but it builds nothing.",
                        wrong: "That one stays in your hand. Look for the one that belongs to no set at all.")
        ),
        Lesson(
            title: "Mahjong",
            say: "Mahjong is a set of 14 tiles with four sets and one pair.\n[[dots-2 dots-3 dots-4 bamboo-5 bamboo-5 bamboo-5 characters-6 characters-7 characters-8 west west west east east]]",
            task: .pick(need: 2, rule: .pair,
                        prompt: "This hand is one pair short. Tap the two tiles that make it.",
                        row: ["bamboo-1", "green-dragon", "dots-4", "green-dragon", "characters-5"],
                        note: "Correct. Two green dragons is a pair. Tap to continue.",
                        wrong: "A pair is two of the identical tile, not two of a kind.")
        ),
        Lesson(
            title: "Sitting down",
            say: "Everyone rolls, and the highest takes East. The others take South, West and North counterclockwise, and play runs the same way.\nEast deals the tiles and throws the first one, then South, then West, then North, and round again. East keeps the seat by winning the hand.\nThe round is named after a wind too — the first one is East’s. Your own seat’s wind is worth having: a pung of it scores a faan, and so does a pung of the wind the round is named for.",
            steps: true,
            row: ["east", "south", "west", "north"],
            task: .choice(prompt: "You are sitting South. Who plays immediately after you?",
                          options: ["East", "West", "North"], answer: 1,
                          note: "Play runs East, South, West, North and round again, so after South comes West — the player on your right.",
                          wrong: "Count round in the order of the seats: East, South, West, North.")
        ),
        Lesson(
            title: "Breaking the wall",
            say: "Each player builds a wall, two tiles high and eighteen long. The four are pushed together into a square.\nEast rolls. Counting round from East as one, that many seats along is the wall to open. Count the same number of stacks in from that wall’s right-hand end: that is the break.\nDealing starts at the break and goes round in twos, until everyone holds twelve. East then takes two more and the others one each — so East begins with fourteen tiles and everyone else with thirteen.\nThe tiles just past the break are the dead wall. Replacements come from there.",
            steps: true,
            task: .choice(prompt: "East rolls a 7. Counting counterclockwise with East as one, whose wall is opened?",
                          options: ["East", "South", "West", "North"], answer: 2,
                          note: "East 1, South 2, West 3, North 4, East 5, South 6, West 7 — the seventh seat is West.",
                          wrong: "Count all the way round: East is 1, South 2, West 3, North 4, and then it begins again at East.")
        ),
        Lesson(
            title: "Taking a turn",
            say: "A turn is two things: take a tile, then put one down.\nTake it from the wall, or claim the tile just discarded if it finishes a set. Then discard one from your hand, face up in the middle.\nA chow can only be claimed by the player whose turn is next. A pung, a kong or a win can be claimed by anyone at the table.\nIf two people want the same tile, a win beats a pung or a kong, and those beat a chow.",
            steps: true,
            task: .choice(prompt: "You are West. North discards the exact tile you need for a chow. May you take it?",
                          options: ["Yes — a chow can be claimed from anyone",
                                    "No — only East may chow that tile",
                                    "Only if nobody else calls"], answer: 1,
                          note: "A chow can only be taken by the player whose turn is next, and after North comes East. Had you needed it for a pung, you could have claimed it from anybody.",
                          wrong: "Think about whose turn follows North, and which claims are open to the whole table.")
        ),
        Lesson(
            title: "Value sets",
            say: "Some sets are worth more than the place they fill. A pung or a kong of dragons is one — red, green or white, it pays a faan to whoever holds it.\nWinds pay only if they are yours: the wind you are sitting, or the wind the round is named for. Any other wind is three tiles and nothing more. A pung of East, held by East in the East round, scores for both.",
            steps: true,
            cards: [
                LessonCard(cap: "Dragons", tiles: ["red-dragon", "red-dragon", "red-dragon"], note: "A faan for anyone holding it."),
                LessonCard(cap: "Your wind", tiles: ["east", "east", "east"], note: "Your own seat, or the round."),
            ],
            task: .choice(prompt: "You are sitting West in the East round. Which of these pungs is worth a faan?",
                          options: ["Three green dragons", "Three South winds", "Three 9 of bamboo"], answer: 0,
                          note: "Dragons pay for anyone. South is neither your seat nor the round, so that pung is worth nothing extra — and a pung of nines is just a pung.",
                          wrong: "Dragons are always worth something. A wind has to be your own seat or the round.")
        ),
        Lesson(
            title: "What a hand is worth",
            say: "Faan are added up. A hand scores every one it earns.",
            cards: [
                LessonCard(cap: "One faan", tiles: ["red-dragon", "red-dragon", "red-dragon"],
                           note: "A pung of dragons, of your own seat wind, or of the round’s wind. Going out on your own draw. No flowers at all."),
                LessonCard(cap: "Three faan", tiles: ["characters-3", "characters-3", "characters-3"],
                           note: "Every set a pung. Or one suit and nothing but honours beside it."),
                LessonCard(cap: "Seven faan", tiles: ["dots-1", "dots-2", "dots-3"],
                           note: "One suit, with no honours at all — the whole hand in dots, bamboo or characters."),
            ],
            task: .choice(prompt: "Your hand is four pungs and a pair. How many faan is that worth?",
                          options: ["2 faan", "3 faan", "7 faan"], answer: 1,
                          note: "All pungs pays 3, which clears the usual minimum on its own. Four chows pays only 1, which is why a plain hand often cannot be declared at all.",
                          wrong: "Look back: the shapes that cover the whole hand pay more than the single sets.")
        ),
        Lesson(
            title: "Who pays",
            say: "Faan turn into points by doubling. One faan is 2 points, two is 4, three is 8, four is 16. After that it slows: five is 24, eight is 64, and ten is the ceiling.\nThen it matters how you finished.\nWon on someone else’s discard: that player pays double, and the other two pay once.\nWon on a tile you drew yourself: all three pay double.",
            steps: true,
            task: .choice(prompt: "You complete your hand on a tile you drew yourself. Who pays you?",
                          options: ["Only the player who discarded last", "All three, at double", "All three, at the plain value"], answer: 1,
                          note: "That is why a self-draw is worth far more than the one extra faan it scores — the whole table pays, and pays double.",
                          wrong: "Nobody discarded the winning tile, so think about who is left to pay.")
        ),
    ]
}
