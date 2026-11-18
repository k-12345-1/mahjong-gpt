import SwiftUI

/* The lacquer table, carried over from the web app: one flat red everywhere, ivory kept
   for type, tiles and controls, and the gold reserved for what the table is telling you. */
enum Lacquer {
    static let ground = Color(red: 156/255, green: 9/255, blue: 4/255)
    static let deep = Color(red: 88/255, green: 6/255, blue: 4/255)
    static let felt = Color(red: 121/255, green: 11/255, blue: 7/255)
    static let cream = Color(red: 255/255, green: 250/255, blue: 240/255)
    static let warm = Color(red: 255/255, green: 222/255, blue: 208/255)
    static let gold = Color(red: 249/255, green: 215/255, blue: 130/255)
    static let hairline = Color.white.opacity(0.22)
}

extension Font {
    /* Instrument Serif set the display type on the web. iOS has no Didone to hand, so the
       nearest thing the system ships with carries it: a serif at a large size with the
       same tight letter-spacing. */
    static func display(_ size: CGFloat) -> Font {
        .system(size: size, weight: .regular, design: .serif)
    }
    static func mono(_ size: CGFloat, weight: Font.Weight = .medium) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }
}

struct Eyebrow: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.mono(11))
            .tracking(1.6)
            .textCase(.uppercase)
    }
}

extension View {
    func eyebrow() -> some View { modifier(Eyebrow()) }

    /* The one ground the whole app stands on, edge to edge and under the bars too. */
    func lacquerBackground() -> some View {
        background(Lacquer.ground.ignoresSafeArea())
    }
}
