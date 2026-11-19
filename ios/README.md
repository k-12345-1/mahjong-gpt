# MahjongGPT for iOS

The same game as the web app, written again in Swift and SwiftUI so it can be shipped
through the App Store. No web view anywhere: the rules, the scoring and the coach are
Swift, and the screens are SwiftUI.

It is also meant to *look* like the web app on a phone, and not approximately. Every
size, colour, weight and gap in `Views/` was read off the running site at 402x874 with
`getComputedStyle` rather than guessed from the stylesheet, and the two faces the site
serves -- Instrument Serif and JetBrains Mono -- are the same woff2 files, converted to
TTF and carried in `Fonts/` with their OFL licences. Where the CSS scales with the
viewport the Swift scales with it; where it pins a pixel, so does the Swift. Safari hands
a page a viewport that already clears the status bar and the toolbars, so the app treats
its safe area as that viewport, which is what keeps the two in step.

## Running it

```sh
open ios/MahjongGPT.xcodeproj
```

Pick a simulator and press run. From the command line:

```sh
xcodebuild -project ios/MahjongGPT.xcodeproj -scheme MahjongGPT \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

Deployment target is iOS 17. The brief is how the site looks on a phone, so the app is an
iPhone app in portrait -- an iPad would get a stretched phone layout, which is both wrong
and a known reason for rejection. It needs no network at all: there is no account, no
server and nothing is sent anywhere.

## The engine's own check

```sh
./ios/Checks/run.sh
```

It compiles the five pure-Swift engine files and runs the assertions in `Checks/main.swift`
— the counterpart of `test-scoring.mjs` and `test-coach.mjs` on the web side, and the
reason the port can be trusted to count a hand the same way.

## Layout

| path | what it is |
| --- | --- |
| `MahjongGPT/Engine/Tiles.swift` | the 42 faces, and what each one is called |
| `MahjongGPT/Engine/Hand.swift` | four sets and a pair: winning, partitioning, distance from ready |
| `MahjongGPT/Engine/Scoring.swift` | `faanFor` — the Hong Kong "new chapter" faan table |
| `MahjongGPT/Engine/Coach.swift` | what to throw, what the hand could still be worth, which hand it is becoming |
| `MahjongGPT/Engine/Deal.swift` | how the deal and the round pass round the table |
| `MahjongGPT/Engine/Table.swift` | the table itself: the wall, the turns, the claims, the match |
| `MahjongGPT/Engine/Sound.swift` | the tiles, synthesised rather than recorded, and the calls spoken |
| `MahjongGPT/Views/Theme.swift` | the colours, the two faces, and the ground -- the numbers read off the page |
| `MahjongGPT/Views/Icons.swift` | the site's own SVG paths, parsed and stroked, so a button is the button on the page |
| `MahjongGPT/Views/` | the four screens and the tile |
| `MahjongGPT/Fonts/` | Instrument Serif and JetBrains Mono, converted from the woff2 the site serves, with their licences |
| `MahjongGPT/Content/Lessons.swift` | the school: 16 lessons, tapped rather than dragged |
| `MahjongGPT/Content/Book.swift` | the coach's offline book, generated from the web app's own `gpt.mjs` |
| `MahjongGPT/Assets.xcassets` | the rendered tiles, the felt, and the app icon |

## Before it can go to the App Store

Everything in the project that does not need an Apple account is already set: the icon,
the launch screen, the orientations, the privacy manifest (`PrivacyInfo.xcprivacy`,
declaring UserDefaults and no tracking at all), the version and build number.

What is left needs the account, and so needs you:

1. **Signing.** Open the target's Signing & Capabilities tab and pick your team. The
   bundle identifier is `com.mahjonggpt.MahjongGPT` — change it to one you own.
2. **App Store Connect.** Make the app record, then Product ▸ Archive ▸ Distribute.
3. **Screenshots** for a 6.9" iPhone. No iPad set is needed while the target is iPhone only.
4. **The privacy questionnaire.** The honest answers are "no data collected" and "no
   tracking", which is what the manifest in the project says too.
5. **The name.** "GPT" is OpenAI's trademark and Apple has rejected app names that use it.
   The app's display name is set in one place — `INFOPLIST_KEY_CFBundleDisplayName` in the
   project — if you would rather not find out the hard way.

## What is not here yet

The chat answers from the offline book, the same one the published web app uses; the
model-backed version only ever ran in the Claude artifact. Giving the app a real model
would mean a small server of your own to hold the key, since a key shipped inside an app
is a key you have given away.

The dragon on the hero is a still. On the site it is a three.js sculpt swimming behind the
letters; the frame in `Assets.xcassets/hero-dragon` was captured straight out of that
canvas with its alpha, so it is the same creature in the same place at the same size, but
it does not move. Making it swim again means a 3D port, not a styling pass.
