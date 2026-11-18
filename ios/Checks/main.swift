import Foundation

/* The engine's own check, the counterpart of test-scoring.mjs and test-coach.mjs on the
   web side. It compiles the four pure-Swift engine files and nothing else, so it runs on
   the Mac with no simulator: ./Checks/run.sh */

var passed = 0
var failed = 0

func check(_ ok: Bool, _ what: String) {
    if ok { passed += 1 }
    else { failed += 1; print("FAIL: \(what)") }
}

func face(_ name: String) -> Int {
    guard let i = Tiles.faces.firstIndex(of: name) else { fatalError("no tile \(name)") }
    return i
}

// ---- the tiles themselves
check(Tiles.faces.count == 42, "42 faces")
check(Tiles.name(face("characters-5")) == "5 characters", "a character reads as a number and a suit")
check(Tiles.name(face("red-dragon")) == "red dragon", "a dragon loses its hyphen")
check(Tiles.suitOf(face("bamboo-1")) == 2 && Tiles.suitOf(face("east")) == -1, "suits and honours")

// ---- four sets and a pair
let plain = ["dots-2", "dots-3", "dots-4", "bamboo-5", "bamboo-5", "bamboo-5",
             "characters-6", "characters-7", "characters-8", "west", "west", "west",
             "east", "east"].map(face)
check(Hand.winning(plain), "four sets and a pair is a hand")
check(!Hand.winning(Array(plain.dropLast())), "thirteen tiles is not")
check(Hand.distance(Array(plain.dropLast()), exposed: 0) == 0, "one short is waiting on one tile")
check(Hand.distance(plain, exposed: 0) == -1, "a finished hand is -1")

// ---- the count
let allPungs = ["characters-3", "characters-3", "characters-3", "dots-7", "dots-7", "dots-7",
                "bamboo-2", "bamboo-2", "bamboo-2", "south", "south", "south",
                "east", "east"].map(face)
let pungs = Scoring.faanFor(concealed: allPungs, exposed: [], bonuses: [], seatWind: 0,
                            roundWind: 0, won: true, selfDraw: false)
check(pungs.had.contains("all concealed pungs"), "four pungs never opened is its own pattern")
check(pungs.had.contains("no flowers"), "and no flowers pays too")

let openPungs = Scoring.faanFor(
    concealed: ["east", "east"].map(face),
    exposed: [["characters-3", "characters-3", "characters-3"].map(face),
              ["dots-7", "dots-7", "dots-7"].map(face),
              ["bamboo-2", "bamboo-2", "bamboo-2"].map(face),
              ["south", "south", "south"].map(face)],
    bonuses: [], seatWind: 0, roundWind: 0, won: true, selfDraw: false)
check(openPungs.faan == 4, "all pungs open, won: 3 and 1 for no flowers — got \(openPungs.faan)")
check(openPungs.had.contains("all pungs"), "the open version is all pungs")

let greatDragons = ["red-dragon", "red-dragon", "red-dragon",
                    "green-dragon", "green-dragon", "green-dragon",
                    "white-dragon", "white-dragon", "white-dragon",
                    "bamboo-4", "bamboo-5", "bamboo-6",
                    "characters-9", "characters-9"].map(face)
let dragons = Scoring.faanFor(concealed: greatDragons, exposed: [], bonuses: [], seatWind: 0,
                              roundWind: 0, won: true, selfDraw: false)
check(dragons.faan == 10, "the three dragons run into the limit — got \(dragons.faan)")
check(dragons.wins.contains { $0.why.lowercased().contains("all three dragons") },
      "and the count says which pattern paid")

let orphans = (Tiles.orphans + [0]).map { $0 }
let thirteen = Scoring.faanFor(concealed: orphans, exposed: [], bonuses: [], seatWind: 0,
                               roundWind: 0, won: true, selfDraw: false)
check(thirteen.had == ["thirteen orphans"], "thirteen orphans is counted alone")
check(thirteen.faan == 10, "and is held to the limit")

/* A hand that is not finished is worth its patterns and none of the bonuses. */
let held = Scoring.faanFor(concealed: allPungs, exposed: [], bonuses: [], seatWind: 0,
                           roundWind: 0, won: false, selfDraw: false)
check(!held.had.contains("no flowers") && !held.had.contains("concealed"),
      "an unfinished hand collects no bonuses")

// ---- the coach
/* The melds are part of the hand. Leaving them out read this hand as characters and threw
   the west the bamboo hand can still use. */
let shaped = [5, 8, 10, 21, 21, 28, 32]
let withMelds = [[31, 31, 31], [22, 23, 24]]
if let pick = Coach.recommend(shaped, exposed: withMelds.count, publicTiles: [],
                              melds: withMelds, minFaan: 3) {
    check(pick.tile < 9, "a character goes, not the wind the bamboo hand can still use")
    check(pick.tile != 28, "the lone west is faan this hand can still use")
} else {
    check(false, "the coach returned nothing")
}

/* A hand with a run already face up cannot be all pungs, and with a second suit down it
   cannot be either flush -- so its ceiling is what is left. */
check(Coach.faanCeiling([face("east"), face("east")], melds: [[0, 1, 2]]) >= 1,
      "a ceiling is never below one")
let cleanish = ["bamboo-1", "bamboo-2", "bamboo-3", "bamboo-5", "bamboo-6", "bamboo-7",
                "bamboo-9", "red-dragon"].map(face)
check(Coach.direction(cleanish).kind == .halfFlush, "seven bamboo and a dragon is a half flush")
check(Coach.faanCeiling(cleanish) >= 3, "and it can still reach three")

let choices = Coach.discardChoices(plain, exposed: 0, publicTiles: [])
check(choices.first!.distance <= choices.last!.distance, "choices come back nearest-first")

// ---- the deal
check(nextDeal(dealer: 0, round: 0, dealt: 0, winner: 0).dealer == 0, "East keeps the deal by winning")
check(nextDeal(dealer: 0, round: 0, dealt: 0, winner: 1).dealer == 1, "otherwise it passes")
check(nextDeal(dealer: 3, round: 3, dealt: 3, winner: 1).over, "and after North the match is over")

print(failed == 0 ? "\(passed) checks passed" : "\(passed) passed, \(failed) FAILED")
exit(failed == 0 ? 0 : 1)
