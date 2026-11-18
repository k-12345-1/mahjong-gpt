import Foundation

/* The deal passes on after every hand. A seat's wind is its distance from the dealer, so
   the dealer is always East and every seat takes East in turn. East keeps the deal by
   winning the hand; otherwise it passes, and a round ends when it has been all the way
   round the table. Four rounds -- East, South, West, North -- are a match. */
struct NextDeal {
    let dealer: Int
    let round: Int
    let dealt: Int
    let over: Bool
}

func nextDeal(dealer: Int, round: Int, dealt: Int, winner: Int?) -> NextDeal {
    let keeps = winner == dealer
    var nextRound = round
    var nextDealt = dealt
    if !keeps {
        nextDealt += 1
        if nextDealt >= 4 { nextDealt = 0; nextRound += 1 }
    }
    return NextDeal(dealer: keeps ? dealer : (dealer + 1) % 4,
                    round: nextRound, dealt: nextDealt, over: nextRound >= 4)
}
