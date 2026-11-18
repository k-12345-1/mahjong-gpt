import SwiftUI

enum Screen: String, CaseIterable {
    case home, play, learn, chat
    var title: String {
        switch self {
        case .home: "HOME"
        case .play: "PLAY"
        case .learn: "LEARN TO PLAY"
        case .chat: "MAHJONG GPT"
        }
    }
}

struct RootView: View {
    @Environment(Table.self) private var table
    @State private var screen: Screen = .home
    @State private var menuOpen = false
    @State private var settingsOpen = false
    @State private var soundLevel = 2
    @State private var learn = LearnState()
    @State private var chat = ChatState()

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Lacquer.ground.ignoresSafeArea()

            Group {
                switch screen {
                case .home: HomeView(go: { screen = $0 })
                case .play: TableView(settingsOpen: $settingsOpen)
                case .learn: LearnView(state: $learn)
                case .chat: ChatView(state: $chat)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            topBar
                .padding(.top, 10)
                .padding(.trailing, 12)
        }
        .overlay { if menuOpen { menu } }
        .sheet(isPresented: $settingsOpen) { SettingsSheet() }
        .onAppear { Sound.load(); soundLevel = Sound.level }
        .animation(.easeInOut(duration: 0.22), value: screen)
    }

    /* One bar in the corner holding the menu and whatever the screen in front needs. A
       button that does not belong on this screen closes up instead of disappearing, so the
       bar changes width in a movement rather than a jump. */
    private var topBar: some View {
        HStack(spacing: 0) {
            barButton("speaker.wave.2", label: "Sound") {
                Sound.level = (Sound.level + 1) % 3
                soundLevel = Sound.level
                Sound.clack()
            }
            .overlay(alignment: .bottom) { volumeBars.padding(.bottom, 5) }

            if screen == .play {
                barButton("gearshape", label: "Match settings") { settingsOpen = true }
            }
            if screen == .learn {
                barButton("chevron.left", label: "Previous lesson") { learn.back() }
                    .disabled(!learn.canGoBack)
                barButton("chevron.right", label: "Next lesson") { learn.on() }
            }
            if screen == .chat {
                barButton("arrow.clockwise", label: "Start a new chat") { chat.reset() }
            }
            barButton("line.3.horizontal", label: "Open menu") { menuOpen = true }
        }
        .background(.white, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func barButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .frame(width: 44, height: 44)
        }
        .tint(Color(red: 0.16, green: 0.09, blue: 0.08))
        .accessibilityLabel(label)
    }

    /// the level shown as bars, filling up as it is turned up
    private var volumeBars: some View {
        HStack(spacing: 2) {
            ForEach(0..<2) { i in
                Capsule()
                    .fill(Color(red: 0.16, green: 0.09, blue: 0.08).opacity(soundLevel > i ? 0.85 : 0.17))
                    .frame(width: 3.5, height: CGFloat(4 + i * 3))
            }
        }
        .frame(width: 44, alignment: .center)
        .allowsHitTesting(false)
    }

    private var menu: some View {
        ZStack(alignment: .topTrailing) {
            Lacquer.ground.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 18) {
                ForEach(Screen.allCases, id: \.self) { item in
                    Button(item.title) {
                        screen = item
                        menuOpen = false
                    }
                    .font(.display(44))
                    .foregroundStyle(Lacquer.cream)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(.horizontal, 34)

            Button { menuOpen = false } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 19, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .background(.white, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .tint(Color(red: 0.16, green: 0.09, blue: 0.08))
            .padding(.top, 10)
            .padding(.trailing, 12)
            .accessibilityLabel("Close menu")
        }
        .transition(.opacity)
    }
}

/* The hero: the wordmark, and the three ways in. */
struct HomeView: View {
    var go: (Screen) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer(minLength: 0)
            Text("香港 · HONG KONG")
                .eyebrow()
                .foregroundStyle(Lacquer.warm)
            Text("MahjongGPT")
                .font(.display(62))
                .tracking(-3)
                .foregroundStyle(Lacquer.cream)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
                .padding(.top, 6)
            Text("Hong Kong mahjong, a coach that reads your hand, and a school that teaches the game a screen at a time.")
                .font(.mono(11))
                .tracking(0.6)
                .textCase(.uppercase)
                .lineSpacing(4)
                .foregroundStyle(Lacquer.warm)
                .padding(.top, 14)
                .frame(maxWidth: 320, alignment: .leading)

            VStack(alignment: .leading, spacing: 10) {
                ForEach([Screen.play, .learn, .chat], id: \.self) { item in
                    Button { go(item) } label: {
                        HStack {
                            Text(item.title)
                            Spacer()
                            Image(systemName: "arrow.right")
                        }
                        .font(.mono(12, weight: .semibold))
                        .tracking(1.4)
                        .padding(.vertical, 14)
                        .padding(.horizontal, 16)
                        .frame(maxWidth: 360)
                        .background(Lacquer.cream.opacity(item == .play ? 1 : 0))
                        .foregroundStyle(item == .play ? Lacquer.deep : Lacquer.cream)
                        .overlay {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .strokeBorder(item == .play ? .clear : Lacquer.hairline)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    }
                }
            }
            .padding(.top, 30)
            Spacer(minLength: 0)
            Text("麻雀 · DESIGN PROTOTYPE")
                .eyebrow()
                .foregroundStyle(Lacquer.warm.opacity(0.7))
                .padding(.bottom, 8)
        }
        .padding(.horizontal, 26)
        .padding(.top, 70)
    }
}
