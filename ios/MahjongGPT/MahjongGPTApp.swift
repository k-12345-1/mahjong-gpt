import SwiftUI

@main
struct MahjongGPTApp: App {
    @State private var table = Table()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(table)
                .preferredColorScheme(.dark)
        }
    }
}
