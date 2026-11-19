import SwiftUI
import CoreText

@main
struct MahjongGPTApp: App {
    @State private var table = Table()

    init() { Self.registerFonts() }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(table)
                .preferredColorScheme(.dark)   /* color-scheme:dark, as the page declares */
        }
    }

    /* The two faces the site serves, carried in the bundle and registered on launch. The
       Info.plist route takes an array, which a build setting cannot spell, so this is the
       honest way to do it from a generated plist. */
    private static func registerFonts() {
        for name in ["InstrumentSerif-Regular", "JetBrainsMono-Medium", "JetBrainsMono-SemiBold"] {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else {
                assertionFailure("\(name).ttf is not in the bundle")
                continue
            }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}
