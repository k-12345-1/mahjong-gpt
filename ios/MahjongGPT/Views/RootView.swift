import SwiftUI

enum Screen: String, CaseIterable {
    case home, play, learn, chat
    /// the labels the game shell's own menu uses
    var title: String {
        switch self {
        case .home: "HOME"
        case .play: "PLAY"
        case .learn: "LEARN TO PLAY"
        case .chat: "MAHJONG GPT"
        }
    }
}

/* Where the site pins things in the corner. Safari hands the page a viewport that already
   starts below the status bar, so `env(safe-area-inset-top)` is 0 there and the game
   screens sit 2.5vw down. An app gets the whole screen, so the same distance is measured
   from the bottom of the status bar instead -- which is what `top` is for below. */
func corner(_ width: CGFloat) -> CGFloat { width * 0.025 }
/// the hero's own corner, which the stylesheet gives a 16px floor
let heroCorner: CGFloat = 16

struct RootView: View {
    @Environment(Table.self) private var table
    @State private var screen: Screen = .home
    @State private var menuOpen = false
    @State private var settingsOpen = false
    @State private var soundLevel = 2
    @State private var learn = LearnState()
    @State private var chat = ChatState()
    @Environment(\.scenePhase) private var phase
    private let account = Account.shared

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack(alignment: .topTrailing) {
                /* The hero stands on the flat lacquer; everything else has the grain
                   over it, exactly as the two stylesheets have it. */
                Color.clear.lacquerGround(grain: screen != .home)

                switch screen {
                case .home: HeroView(width: w, height: h)
                case .play: TableView(settingsOpen: $settingsOpen)
                case .learn: LearnView(state: $learn, width: w)
                case .chat: ChatView(state: $chat, width: w)
                }

                if screen == .home {
                    bar([.menu]) { _ in menuOpen = true }
                        .padding(.top, heroCorner).padding(.trailing, heroCorner)
                } else {
                    topBar
                        .padding(.top, corner(w)).padding(.trailing, corner(w))
                }
            }
            .frame(width: w, height: h)
            .overlay { if settingsOpen { SettingsCard { settingsOpen = false } } }
            .overlay { if menuOpen { menu(width: w, height: h) } }
        }
        .onAppear { Sound.load(); soundLevel = Sound.level }
        /* Signed in, the row is read once on the way in -- and the moment it puts
           something new in the store, the three places that read the store re-read it. */
        .task { if Account.configured { await account.pull() } }
        .onChange(of: account.landed) { _, _ in
            table.reload()
            learn.resume()
            Sound.load()
            soundLevel = Sound.level
        }
        /* Being put away is the one moment a save that is still waiting cannot wait. */
        .onChange(of: phase) { _, now in
            if now != .active { Task { await account.flush() } }
        }
    }

    // MARK: - the bar in the corner

    private enum BarButton { case sound, settings, back, on, again, menu }

    /* One bar in the corner holding the menu and whatever the screen in front needs.
       44pt buttons in a white box with an 8pt corner, as the site has it. */
    private var topBar: some View {
        var buttons: [BarButton] = [.sound]
        if screen == .play { buttons.append(.settings) }
        if screen == .learn { buttons += [.back, .on] }
        if screen == .chat { buttons.append(.again) }
        buttons.append(.menu)
        return bar(buttons) { which in
            switch which {
            case .sound:
                Sound.level = (Sound.level + 1) % 3
                soundLevel = Sound.level
                Sound.clack()
            case .settings: settingsOpen = true
            case .back: learn.back()
            case .on: learn.on()
            case .again: chat.reset()
            case .menu: menuOpen = true
            }
        }
    }

    private func bar(_ buttons: [BarButton], tap: @escaping (BarButton) -> Void) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(buttons.enumerated()), id: \.offset) { _, which in
                Button { tap(which) } label: {
                    glyph(for: which)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .foregroundStyle(Lacquer.ink)
                .disabled(which == .back && !learn.canGoBack)
                .opacity(which == .back && !learn.canGoBack ? 0.3 : 1)
                .accessibilityLabel(label(for: which))
            }
        }
        .background(.white, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    @ViewBuilder private func glyph(for which: BarButton) -> some View {
        /* 42% of the button, which is what the stylesheet gives the svg */
        let size: CGFloat = 44 * 0.42
        switch which {
        case .sound: Glyph(paths: Icon.sound(level: soundLevel), size: size)
        case .settings: Glyph(paths: [Icon.gear], size: size,
                              circle: CGRect(x: 12 - 2.9, y: 12 - 2.9, width: 5.8, height: 5.8))
        case .back: Glyph(paths: Icon.back, size: size)
        case .on: Glyph(paths: Icon.on, size: size)
        case .again: Glyph(paths: Icon.again, size: size)
        case .menu: Glyph(paths: Icon.menu, size: size)
        }
    }

    private func label(for which: BarButton) -> String {
        switch which {
        case .sound: ["Sound off", "Sound low", "Sound full"][soundLevel] + ", tap to change"
        case .settings: "Match settings"
        case .back: "Previous lesson"
        case .on: "Next lesson"
        case .again: "Start a new chat"
        case .menu: "Open menu"
        }
    }

    // MARK: - the full-screen menu

    private func menu(width w: CGFloat, height h: CGFloat) -> some View {
        /* font-size:clamp(2rem,12vw,9vh); the list is centred and the gap is 2.2vh */
        let size = min(max(32, w * 0.12), h * 0.09)
        return ZStack(alignment: .topTrailing) {
            Color.clear.lacquerGround()
            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 0)
                VStack(alignment: .leading, spacing: h * 0.022) {
                    ForEach(Screen.allCases, id: \.self) { item in
                        Button(item.title) {
                            screen = item
                            menuOpen = false
                        }
                        .font(MG.display(size))
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                        .foregroundStyle(.white)
                    }
                }
                Spacer(minLength: 0)
                /* With no project behind it there is no account anywhere in the app, and
                   the links sit in the middle of the screen as they always did. */
                if Account.configured { AccountBlock() }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.bottom, 24)

            Button { menuOpen = false } label: {
                Glyph(paths: Icon.close, size: 44 * 0.42)
                    .frame(width: 44, height: 44)
                    .background(.white, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .foregroundStyle(Lacquer.ink)
            .padding(.top, heroCorner).padding(.trailing, heroCorner)
            .accessibilityLabel("Close menu")
        }
    }
}

/* The hero: the name, nothing else. 23.3vw of Instrument Serif on two lines, with the
   gold dragon swimming across the join. */
struct HeroView: View {
    let width: CGFloat
    let height: CGFloat

    var body: some View {
        let size = width * 0.233
        ZStack {
            VStack(spacing: 0) {
                line("MAHJONG", size: size)
                line("GPT", size: size)
            }
            /* the dragon is drawn over the letters, as z-index:3 puts it on the page */
            Image("hero-dragon")
                .resizable()
                .scaledToFit()
                .frame(width: width * 0.5435)
                .position(x: width * 0.395, y: height * 0.497)
        }
        .frame(width: width, height: height)
        .accessibilityElement()
        .accessibilityLabel("MahjongGPT")
    }

    /* The page sets the name a letter at a time, which throws away the font's own kerning,
       and then hands four pairs the space back by hand. Setting it the same way here is
       what makes the two wordmarks the same width to the pixel. */
    private static let kern: [String: CGFloat] = ["MA": 0.063, "AH": 0.058, "HJ": 0.03, "PT": 0.02]

    private func line(_ word: String, size: CGFloat) -> some View {
        let letters = Array(word)
        return HStack(spacing: 0) {
            ForEach(Array(letters.enumerated()), id: \.offset) { i, ch in
                Text(String(ch))
                    .font(MG.display(size))
                    .tracking(-0.045 * size)
                    .padding(.leading, i == 0 ? 0
                             : (Self.kern[String(letters[i - 1]) + String(ch)] ?? 0) * size)
            }
        }
        .foregroundStyle(.white)
        .frame(height: size * 0.98, alignment: .center)
        .shadow(color: Color(red: 32/255, green: 2/255, blue: 0).opacity(0.42), radius: 13, y: 10)
        .shadow(color: Color(red: 32/255, green: 2/255, blue: 0).opacity(0.3), radius: 2, y: 2)
    }
}
