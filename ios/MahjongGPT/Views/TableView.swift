import SwiftUI

struct TableView: View {
    @Environment(Table.self) private var table
    @Binding var settingsOpen: Bool
    @State private var reviewOpen = false

    var body: some View {
        GeometryReader { geo in
            let under: CGFloat = 150          // the coach's line and the bar under the board
            let side = min(geo.size.width - 24, geo.size.height - under)
            VStack(spacing: 0) {
                Spacer(minLength: 0)
                board(side: max(side, 240))
                coachLine
                    .frame(width: max(side, 240), alignment: .leading)
                    .padding(.top, 13)
                actionBar
                    .frame(width: max(side, 240))
                    .padding(.top, 12)
                Spacer(minLength: 0)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .sheet(isPresented: $reviewOpen) { ReviewSheet() }
        .onChange(of: table.phase) { _, now in
            if now == .ended { Haptics.thud() }
        }
    }

    // MARK: - the board

    private func board(side: CGFloat) -> some View {
        let hand: CGFloat = side / 15.6
        let back: CGFloat = side / 23
        let pad: CGFloat = side * 0.012

        return ZStack {
            Image("tile-table")
                .resizable()
                .scaledToFill()
                .frame(width: side, height: side)
                .clipShape(RoundedRectangle(cornerRadius: side * 0.02, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: side * 0.02, style: .continuous)
                        .strokeBorder(Lacquer.hairline)
                }

            CompassView(turn: table.seat, windOf: table.wind(of:))
                .frame(width: side * 0.22, height: side * 0.22)

            // the four piles of discards, each between the middle and its own seat
            ForEach(0..<4, id: \.self) { p in
                river(p, tile: side / 26)
                    .position(riverCentre(p, side: side))
            }

            // the three seats across the table, each along its own edge
            ForEach(1..<4, id: \.self) { p in
                opponent(p, tile: back)
                    .rotationEffect(.degrees(Double(p) * -90))
                    .position(seatCentre(p, side: side, inset: back * 1.5 + pad))
            }

            // melds and flowers, laid beside each seat
            ForEach(0..<4, id: \.self) { p in
                exposed(p, tile: back)
                    .rotationEffect(.degrees(Double(p) * -90))
                    .position(exposedCentre(p, side: side, inset: back * 3.1 + pad))
            }

            // your own hand, along the near edge
            yourHand(tile: hand)
                .position(x: side / 2, y: side - hand * 1.31 / 2 - pad * 2)

            if let word = table.callWord {
                Text(word)
                    .font(.display(side * 0.17))
                    .foregroundStyle(Lacquer.gold)
                    .shadow(color: .black.opacity(0.7), radius: 20)
                    .transition(.scale(scale: 1.3).combined(with: .opacity))
                    .id(word)
            }
        }
        .frame(width: side, height: side)
        .animation(.easeOut(duration: 0.25), value: table.callWord)
    }

    private func seatCentre(_ p: Int, side: CGFloat, inset: CGFloat) -> CGPoint {
        switch p {
        case 1: CGPoint(x: side - inset, y: side / 2)
        case 2: CGPoint(x: side / 2, y: inset)
        default: CGPoint(x: inset, y: side / 2)
        }
    }

    private func exposedCentre(_ p: Int, side: CGFloat, inset: CGFloat) -> CGPoint {
        switch p {
        case 0: CGPoint(x: side / 2, y: side - inset)
        case 1: CGPoint(x: side - inset, y: side / 2)
        case 2: CGPoint(x: side / 2, y: inset)
        default: CGPoint(x: inset, y: side / 2)
        }
    }

    private func riverCentre(_ p: Int, side: CGFloat) -> CGPoint {
        let out = side * 0.185
        switch p {
        case 0: return CGPoint(x: side / 2, y: side / 2 + out)
        case 1: return CGPoint(x: side / 2 + out, y: side / 2)
        case 2: return CGPoint(x: side / 2, y: side / 2 - out)
        default: return CGPoint(x: side / 2 - out, y: side / 2)
        }
    }

    /* A seat shows four discards at a time, in four fixed places. The fifth takes the place
       of the oldest, so a pile never outgrows its corner of the table. */
    private func river(_ p: Int, tile: CGFloat) -> some View {
        let places = 4
        var shown = [Int?](repeating: nil, count: places)
        for (i, n) in table.rivers[p].enumerated() { shown[i % places] = n }
        return HStack(spacing: tile * 0.14) {
            ForEach(0..<places, id: \.self) { slot in
                Group {
                    if let n = shown[slot] { TileView(tile: n, width: tile) }
                    else { Color.clear.frame(width: tile, height: tile * 1.31) }
                }
            }
        }
        .rotationEffect(.degrees(Double(p) * -90))
    }

    private func opponent(_ p: Int, tile: CGFloat) -> some View {
        HStack(spacing: tile * 0.09) {
            ForEach(Array(table.hands[p].enumerated()), id: \.offset) { _, n in
                TileView(tile: table.phase == .ended ? n : nil, width: tile)
            }
        }
    }

    private func exposed(_ p: Int, tile: CGFloat) -> some View {
        HStack(spacing: tile * 0.4) {
            ForEach(Array(table.melds[p].enumerated()), id: \.offset) { _, meld in
                HStack(spacing: tile * 0.09) {
                    ForEach(Array(meld.enumerated()), id: \.offset) { _, n in
                        TileView(tile: n, width: tile)
                    }
                }
            }
            if !table.bonuses[p].isEmpty {
                HStack(spacing: tile * 0.09) {
                    ForEach(Array(table.bonuses[p].enumerated()), id: \.offset) { _, n in
                        TileView(tile: n, width: tile * 0.85)
                    }
                }
            }
        }
    }

    private func yourHand(tile: CGFloat) -> some View {
        let pick = table.coach && table.phase == .player ? table.coachPick()?.tile : nil
        return HStack(spacing: tile * 0.08) {
            ForEach(Array(table.hands[0].enumerated()), id: \.offset) { i, n in
                Button {
                    guard table.phase == .player else { return }
                    if table.choice == i { table.playerDiscard(at: i); Haptics.tap() }
                    else { table.choice = i }
                } label: {
                    TileView(tile: n, width: tile,
                             lifted: table.choice == i || i == table.newTileIndex,
                             marked: n == pick && table.choice != i)
                }
                .buttonStyle(.plain)
                .disabled(table.phase != .player)
            }
        }
    }

    // MARK: - what the coach says, and what you can do about it

    @ViewBuilder private var coachLine: some View {
        if let (lead, rest) = table.coachLine() {
            HStack(alignment: .firstTextBaseline, spacing: 11) {
                Text("Coach")
                    .eyebrow()
                    .foregroundStyle(Lacquer.gold)
                (lead.isEmpty ? Text(rest) : Text(lead).bold() + Text(" — ") + Text(rest))
                    .font(.system(size: 13))
                    .foregroundStyle(Lacquer.cream)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(.vertical, 9)
            .padding(.horizontal, 13)
            .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Lacquer.hairline)
            }
            .frame(minHeight: 56, alignment: .top)
        } else {
            Color.clear.frame(height: 0)
        }
    }

    private var actionBar: some View {
        HStack(spacing: 8) {
            Text(table.statusLine)
                .font(.mono(11))
                .foregroundStyle(Lacquer.warm)
                .lineLimit(3)
                .minimumScaleFactor(0.8)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)

            if table.phase == .offer, let offer = table.offer {
                ForEach(offer.options) { option in
                    pill(option.name) { table.claim(option); Haptics.tap() }
                }
                pill("Pass", ghost: true) { table.pass() }
            }
            if table.canDeclareWin {
                pill("Win") { table.declareSelfDraw() }
            }
            if table.phase == .ended {
                if table.match.winner == nil {
                    pill("Next hand") { Sound.wash(); table.nextHand() }
                } else {
                    pill("New match") { table.newMatch() }
                }
                pill("Review", ghost: true) { reviewOpen = true }
            }
        }
        .frame(minHeight: 42)
    }

    private func pill(_ title: String, ghost: Bool = false, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(.mono(11, weight: .semibold))
            .tracking(0.8)
            .textCase(.uppercase)
            .padding(.vertical, 9)
            .padding(.horizontal, 17)
            .background(ghost ? .clear : Lacquer.cream, in: Capsule())
            .overlay { if ghost { Capsule().strokeBorder(Lacquer.hairline) } }
            .foregroundStyle(ghost ? Lacquer.cream : Lacquer.deep)
            .fixedSize()
    }
}

/* The compass is marked straight onto the felt: the four winds, each facing its own seat,
   with the seat whose turn it is lit. */
struct CompassView: View {
    let turn: Int
    let windOf: (Int) -> Int

    var body: some View {
        GeometryReader { geo in
            let side = min(geo.size.width, geo.size.height)
            ZStack {
                Circle().strokeBorder(Lacquer.cream.opacity(0.3), lineWidth: 1)
                    .frame(width: side * 0.62)
                ForEach(0..<4, id: \.self) { p in
                    Text(Tiles.windMarks[windOf(p)])
                        .font(.system(size: side * 0.2))
                        .foregroundStyle(turn == p ? Lacquer.gold : Lacquer.cream.opacity(0.45))
                        .offset(y: side * 0.42)
                        .rotationEffect(.degrees(Double(p) * -90))
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .animation(.easeInOut(duration: 0.25), value: turn)
        }
    }
}

enum Haptics {
    static func tap() {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
    }
    static func thud() {
        #if canImport(UIKit)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
    }
}
