import SwiftUI

/// One tile, drawn from the same art the web app serves. `tile` nil is a tile face down.
struct TileView: View {
    let tile: Int?
    var width: CGFloat
    var lifted = false
    var marked = false

    var body: some View {
        Image(tile.map(Tiles.image) ?? "tile-back")
            .resizable()
            .interpolation(.high)
            .aspectRatio(208.0 / 272.0, contentMode: .fit)
            .frame(width: width)
            .shadow(color: .black.opacity(0.42), radius: width * 0.08, y: width * 0.055)
            .overlay {
                /* the tile the coach would throw is marked on the tile itself, so the
                   advice is read where the decision is made */
                if marked {
                    RoundedRectangle(cornerRadius: width * 0.14, style: .continuous)
                        .strokeBorder(Lacquer.gold, lineWidth: max(1.5, width * 0.055))
                        .padding(-width * 0.04)
                }
            }
            .offset(y: lifted ? -width * 0.18 : 0)
            .animation(.spring(duration: 0.22), value: lifted)
            .accessibilityLabel(tile.map(Tiles.name) ?? "face down tile")
    }
}
