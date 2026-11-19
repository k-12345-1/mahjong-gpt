import SwiftUI

/* Every proportion here is the one the stylesheet produces on a phone, read off the page
   at 402x874: the board is a square of the content width, a hand tile is 4.4865% of it,
   the gap between tiles 1.3514%, and a seat sits 5.7027% in from its own edge. */
private enum Felt {
    static let tile: CGFloat = 0.044865      // 16.6 / 370
    static let gap: CGFloat = 0.013514       // 5 / 370
    static let rowGap: CGFloat = 0.010811    // 4 / 370
    static let inset: CGFloat = 0.057027     // 21.1 / 370
    static let compass: CGFloat = 0.214865   // 21.5cqw
    static let compassType: CGFloat = 0.05   // 5cqw
    static let riverPad: CGFloat = 0.016216  // 6 / 370
    static let riverOut: CGFloat = 0.19432   // 71.9 / 370, the near and far piles
    static let riverSide: CGFloat = 0.160405 // 59.35 / 370, the two beside you
    static let callType: CGFloat = 0.13      // 13cqi
    static let aspect: CGFloat = 272.0 / 208.0
}

struct TableView: View {
    @Environment(Table.self) private var table
    @Binding var settingsOpen: Bool
    @State private var reviewOpen = false

    var body: some View {
        GeometryReader { geo in
            /* --under:173px; --lift:28px; --table-w:min(100%,900px,100dvh - 173 - 28 - 36) */
            let content = geo.size.width - 32
            let side = min(content, geo.size.height - 237)
            /* What the page's own flow centres is the board, the coach's line and the one
               row of status under it -- the bar's 89px floor hangs below that block rather
               than counting towards it. Measured at two viewport heights, the board lands
               at (height - side - 132) / 2 both times. */
            let above = max(28, (geo.size.height - side - 132) / 2)
            VStack(spacing: 0) {
                board(side: side)
                coachLine(width: side).padding(.top, 13)
                actionBar(width: side).padding(.top, 12)
            }
            .padding(.top, above)
            .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
        }
        .sheet(isPresented: $reviewOpen) { ReviewSheet() }
        .onChange(of: table.phase) { _, now in if now == .ended { Haptics.thud() } }
    }

    // MARK: - the felt

    private func board(side S: CGFloat) -> some View {
        let tile = S * Felt.tile
        let gap = S * Felt.gap

        return ZStack {
            Image("tile-table")
                .resizable()
                .scaledToFill()
                .frame(width: S, height: S)
                .clipped()
                .background(Lacquer.felt)

            compass(side: S)

            ForEach(0..<4, id: \.self) { p in
                river(p, side: S, tile: tile, gap: gap)
            }
            ForEach(0..<4, id: \.self) { p in
                seat(p, side: S, tile: tile, gap: gap)
            }

            if let word = table.callWord {
                Text(word)
                    .font(MG.display(S * Felt.callType))
                    .tracking(S * Felt.callType * 0.04)
                    .foregroundStyle(Color(red: 1, green: 0.874, blue: 0.604))
                    .shadow(color: Color(red: 45/255, green: 8/255, blue: 0), radius: 0, y: 2)
                    .shadow(color: .black.opacity(0.69), radius: 19)
                    .transition(.scale(scale: 1.25).combined(with: .opacity))
                    .id(word)
            }
        }
        .frame(width: S, height: S)
        .animation(.easeOut(duration: 0.25), value: table.callWord)
    }

    /* The compass is marked straight on the felt: the four winds, each facing its own
       seat, with the seat whose turn it is lit. */
    private func compass(side S: CGFloat) -> some View {
        let box = S * Felt.compass
        return ZStack {
            Circle()
                .strokeBorder(Lacquer.compass.opacity(0.65), lineWidth: 1)
                .frame(width: box * 0.63, height: box * 0.63)
            ForEach(0..<4, id: \.self) { p in
                Text(Tiles.windMarks[table.wind(of: p)])
                    .font(.custom("Songti TC", fixedSize: S * Felt.compassType))
                    .foregroundStyle(table.seat == p ? Lacquer.compassLit : Lacquer.compass)
                    .offset(y: box * 0.42)
                    .rotationEffect(.degrees(Double(p) * -90))
            }
        }
        .frame(width: box, height: box)
        .animation(.easeInOut(duration: 0.25), value: table.seat)
    }

    /* A seat shows four discards at a time in four fixed places; the fifth takes the place
       of the oldest, so a pile never outgrows its corner of the table. */
    private func river(_ p: Int, side S: CGFloat, tile: CGFloat, gap: CGFloat) -> some View {
        var shown = [Int?](repeating: nil, count: 4)
        for (i, n) in table.rivers[p].enumerated() { shown[i % 4] = n }
        let centre: CGPoint = switch p {
        case 0: CGPoint(x: S / 2, y: S / 2 + S * Felt.riverOut)
        case 1: CGPoint(x: S / 2 + S * Felt.riverSide, y: S / 2)
        case 2: CGPoint(x: S / 2, y: S / 2 - S * Felt.riverOut)
        default: CGPoint(x: S / 2 - S * Felt.riverSide, y: S / 2)
        }
        return HStack(spacing: gap) {
            ForEach(0..<4, id: \.self) { slot in
                if let n = shown[slot] {
                    TileView(tile: n, width: tile,
                             ring: table.lastDiscard?.seat == p
                                && table.rivers[p].count - 1 == slotIndex(p, slot) ? .solid : .none)
                }
                else { Color.clear.frame(width: tile, height: tile * Felt.aspect) }
            }
        }
        .padding(S * Felt.riverPad)
        .rotationEffect(.degrees(Double(p) * -90))
        .position(centre)
    }

    /// which discard of this seat currently occupies that place on the felt
    private func slotIndex(_ p: Int, _ slot: Int) -> Int {
        var last = -1
        for i in table.rivers[p].indices where i % 4 == slot { last = i }
        return last
    }

    private func seat(_ p: Int, side S: CGFloat, tile: CGFloat, gap: CGFloat) -> some View {
        let inset = S * Felt.inset + tile * Felt.aspect / 2
        let centre: CGPoint = switch p {
        case 0: CGPoint(x: S / 2, y: S - inset)
        case 1: CGPoint(x: S - inset, y: S / 2)
        case 2: CGPoint(x: S / 2, y: inset)
        default: CGPoint(x: inset, y: S / 2)
        }
        let open = table.melds[p].flatMap { $0 } + table.bonuses[p]
        return VStack(spacing: S * Felt.rowGap) {
            hand(p, tile: tile, gap: gap)
            if !open.isEmpty {
                HStack(spacing: gap) {
                    ForEach(Array(open.enumerated()), id: \.offset) { _, n in
                        TileView(tile: n, width: tile)
                    }
                }
            }
        }
        .rotationEffect(.degrees(Double(p) * -90))
        .position(centre)
    }

    @ViewBuilder private func hand(_ p: Int, tile: CGFloat, gap: CGFloat) -> some View {
        if p == 0 {
            let pick = table.coach && table.phase == .player ? table.coachPick()?.tile : nil
            HStack(spacing: gap) {
                ForEach(Array(table.hands[0].enumerated()), id: \.offset) { i, n in
                    Button {
                        guard table.phase == .player else { return }
                        if table.choice == i { table.playerDiscard(at: i); Haptics.tap() }
                        else { table.choice = i }
                    } label: {
                        /* picked up: it lifts and takes a solid ring. Just drawn: the same
                           ring and the NEW tab over it. The coach's pick is dashed, so at a
                           glance it is never read as either of those. */
                        TileView(tile: n, width: tile,
                                 lifted: table.choice == i,
                                 ring: table.choice == i || i == table.newTileIndex ? .solid
                                     : (n == pick ? .dashed : .none))
                            .overlay(alignment: .top) {
                                if i == table.newTileIndex && table.choice != i {
                                    Text("NEW")
                                        .font(MG.monoBold(max(6, min(10, tile * 0.3))))
                                        .padding(.horizontal, tile * 0.1)
                                        .padding(.vertical, tile * 0.04)
                                        .background(Lacquer.gold,
                                                    in: RoundedRectangle(cornerRadius: 3))
                                        .foregroundStyle(Color(red: 41/255, green: 35/255, blue: 20/255))
                                        .offset(y: -tile * 0.33)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                    .disabled(table.phase != .player)
                }
            }
        } else {
            HStack(spacing: gap) {
                ForEach(Array(table.hands[p].enumerated()), id: \.offset) { _, n in
                    TileView(tile: table.phase == .ended ? n : nil, width: tile)
                }
            }
        }
    }

    // MARK: - the line under the table, and the bar under that

    @ViewBuilder private func coachLine(width: CGFloat) -> some View {
        /* The slot holds the room so the board does not move when the advice runs to two
           lines; the box inside it hugs whatever is said. */
        VStack(spacing: 0) {
            if let (lead, rest) = table.coachLine() {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("Coach")
                        .font(MG.mono(10))
                        .tracking(1.4)
                        .textCase(.uppercase)
                        .foregroundStyle(Lacquer.gold)
                        .fixedSize()
                    (lead.isEmpty ? Text(rest) : Text(lead).bold() + Text(" — ") + Text(rest))
                        .webType(MG.display(12.5), lineHeight: 18.125, over: MG.uiDisplay(12.5))
                        .foregroundStyle(Lacquer.tipSay)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 10)
                .background(Color.white.opacity(0.06),
                            in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .strokeBorder(Lacquer.tipLine)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(width: width, height: 59, alignment: .top)
    }

    private func actionBar(width: CGFloat) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                if table.phase == .offer, let offer = table.offer {
                    ForEach(offer.options) { option in
                        pill(option.name) { table.claim(option); Haptics.tap() }
                    }
                    pill("Pass", ghost: true) { table.pass() }
                }
                if table.canDeclareWin { pill("Win") { table.declareSelfDraw() } }
                if table.phase == .ended {
                    if table.match.winner == nil {
                        pill("Next hand") { Sound.wash(); table.nextHand() }
                    } else {
                        pill("New match") { table.newMatch() }
                    }
                    pill("Review", ghost: true) { reviewOpen = true }
                }
            }
            Text(table.statusLine)
                .webType(MG.mono(13), lineHeight: 19.5, over: MG.uiMono(13))
                .tracking(0.26)
                .foregroundStyle(Lacquer.status)
                .multilineTextAlignment(.center)
                .frame(width: width)
        }
        .frame(width: width)
        .frame(minHeight: 89, alignment: .top)
    }

    private func pill(_ title: String, ghost: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(MG.mono(11))
                .tracking(11 * 0.07)
                .textCase(.uppercase)
                .padding(.vertical, 7)
                .padding(.horizontal, 19)
                .frame(minHeight: 38)
                .background(ghost ? .clear : Color(red: 1, green: 0.957, blue: 0.882), in: Capsule())
                .overlay {
                    if ghost {
                        Capsule().strokeBorder(Color(red: 243/255, green: 196/255, blue: 168/255)
                            .opacity(0.48))
                    }
                }
                .foregroundStyle(ghost ? Lacquer.tipSay
                                       : Color(red: 100/255, green: 27/255, blue: 18/255))
                .fixedSize()
        }
    }
}

enum Haptics {
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func thud() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
}
