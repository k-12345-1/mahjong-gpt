import SwiftUI
import UIKit

/* Every number in this file was read off the web app running at 402x874 -- a phone --
   with getComputedStyle, not guessed from the stylesheet. Where the CSS scales with the
   viewport the Swift scales with it too; where the CSS pins a pixel value, so does this. */

enum Lacquer {
    /// --lacquer: the flat ground the hero stands on, with no grain over it
    static let lacquer = Color(red: 156/255, green: 4/255, blue: 0/255)
    /// what the ground reads as once the grain is laid over it
    static let ground = Color(red: 156/255, green: 9/255, blue: 4/255)
    static let felt = Color(red: 16/255, green: 56/255, blue: 43/255)
    static let deep = Color(red: 88/255, green: 6/255, blue: 4/255)

    static let cream = Color(red: 255/255, green: 250/255, blue: 240/255)   // --cream
    static let chalk = Color(red: 233/255, green: 230/255, blue: 230/255)   // --chalk
    static let gold = Color(red: 249/255, green: 215/255, blue: 130/255)
    static let say = Color(red: 255/255, green: 243/255, blue: 228/255)     // lesson prose
    static let ask = Color(red: 255/255, green: 217/255, blue: 201/255)     // lesson prompt
    static let tipSay = Color(red: 255/255, green: 241/255, blue: 219/255)
    static let status = Color(red: 255/255, green: 241/255, blue: 226/255)
    static let choice = Color(red: 255/255, green: 233/255, blue: 221/255)
    static let warm = Color(red: 255/255, green: 222/255, blue: 208/255)    // --muted
    static let ink = Color(red: 32/255, green: 32/255, blue: 32/255)        // the top bar's icons

    static let choiceLine = Color(red: 255/255, green: 199/255, blue: 168/255).opacity(0.3)
    static let tipLine = Color(red: 243/255, green: 196/255, blue: 168/255).opacity(0.24)
    static let youLine = Color(red: 255/255, green: 199/255, blue: 168/255).opacity(0.25)
    static let askLine = Color(red: 255/255, green: 217/255, blue: 198/255)
    static let compass = Color(red: 243/255, green: 220/255, blue: 192/255).opacity(0.47)
    static let compassLit = Color(red: 249/255, green: 215/255, blue: 130/255).opacity(0.753)
}

/* The two faces the site serves, carried in the bundle: the same woff2 files, converted.
   fixedSize, because the web does not resize its type for Dynamic Type either and the
   brief here is that the app reads exactly as the page does. */
enum MG {
    static let displayName = "InstrumentSerif-Regular"
    static let monoName = "JetBrainsMono-Medium"
    static let monoBoldName = "JetBrainsMono-SemiBold"

    static func display(_ size: CGFloat) -> Font { .custom(displayName, fixedSize: size) }
    static func mono(_ size: CGFloat) -> Font { .custom(monoName, fixedSize: size) }
    static func monoBold(_ size: CGFloat) -> Font { .custom(monoBoldName, fixedSize: size) }

    static func uiDisplay(_ size: CGFloat) -> UIFont {
        UIFont(name: displayName, size: size) ?? .systemFont(ofSize: size)
    }
    static func uiMono(_ size: CGFloat) -> UIFont {
        UIFont(name: monoName, size: size) ?? .monospacedSystemFont(ofSize: size, weight: .medium)
    }

    /// CSS line-height sets the whole line box; SwiftUI only adds to it. This is the difference.
    static func leading(_ target: CGFloat, over font: UIFont) -> CGFloat {
        max(0, target - font.lineHeight)
    }
}

extension View {
    /// `font: Npx / Mpx` as the browser computes it
    func webType(_ font: Font, lineHeight: CGFloat, over ui: UIFont) -> some View {
        self.font(font).lineSpacing(MG.leading(lineHeight, over: ui))
    }

    /// The ground the whole app stands on: one flat lacquer with the grain tiled over it.
    func lacquerGround(grain: Bool = true) -> some View {
        ZStack {
            Lacquer.lacquer
            if grain {
                Image("grain").resizable(resizingMode: .tile)
            }
            self
        }
        .ignoresSafeArea()
    }
}

/* .eyebrow on the web: 11px mono, uppercase, .15em of tracking. The places that use a
   different size pass it in. */
struct Eyebrow: ViewModifier {
    var size: CGFloat = 11
    var tracking: CGFloat = 0.15
    func body(content: Content) -> some View {
        content
            .font(MG.mono(size))
            .tracking(size * tracking)
            .textCase(.uppercase)
    }
}

extension View {
    func eyebrow(size: CGFloat = 11, tracking: CGFloat = 0.15) -> some View {
        modifier(Eyebrow(size: size, tracking: tracking))
    }
}
