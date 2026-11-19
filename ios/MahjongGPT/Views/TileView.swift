import SwiftUI

/* One tile, drawn from the art the site serves, with the same 11.5%/8.8% corner. The
   board gives its tiles no shadow at all; the school and the chat put one under theirs,
   so the shadow is asked for rather than assumed. */
struct TileView: View {
    enum Ring { case none, solid, dashed }

    let tile: Int?
    var width: CGFloat
    var lifted = false
    var marked = false
    /// a solid ring is the tile you picked up or just drew; the coach's pick is dashed
    var ring: Ring = .none
    var shadow: CGFloat = 0
    var labelled = true

    private var height: CGFloat { width * 272 / 208 }

    var body: some View {
        Image(tile.map(Tiles.image) ?? "tile-back")
            .resizable()
            .interpolation(.high)
            .frame(width: width, height: height)
            .shadow(color: shadow > 0 ? Color(red: 58/255, green: 4/255, blue: 2/255).opacity(0.53) : .clear,
                    radius: shadow, y: shadow * 0.6)
            .overlay {
                /* outline: 2px #f9d782, offset 2 -- the same ring the board draws, solid
                   for a tile in hand and dashed for the one the coach would throw. */
                if effectiveRing != .none {
                    RoundedRectangle(cornerRadius: width * 0.115, style: .continuous)
                        .strokeBorder(Lacquer.gold, style: StrokeStyle(
                            lineWidth: 2, dash: effectiveRing == .dashed ? [3, 2.5] : []))
                        .padding(-3)
                }
            }
            .offset(y: lifted ? -width * 0.19 : 0)
            .animation(.easeOut(duration: 0.16), value: lifted)
            .accessibilityLabel(labelled ? (tile.map(Tiles.name) ?? "face down tile") : "")
    }

    private var effectiveRing: Ring {
        if ring != .none { return ring }
        return marked ? .dashed : .none
    }
}
