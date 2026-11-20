import SwiftUI

/* Signing in sits at the foot of the menu, which is the one piece of chrome every screen
   has -- the same place, and the same small mono type, as on the web. The form is there
   when you are signed out and the two plain words when you are in, so the block never
   grows a row you cannot use. */
struct AccountBlock: View {
    private let account = Account.shared
    @State private var email = ""
    @State private var password = ""
    @State private var arming = false

    private let line = Color(red: 1, green: 0.878, blue: 0.796).opacity(0.33)
    private let dim = Color(red: 1, green: 0.851, blue: 0.788)

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            small(account.signedIn ? (account.email ?? "") : "Carry your game between devices")
                .foregroundStyle(Lacquer.cream)

            if account.signedIn { mine } else { form }

            if !account.note.isEmpty {
                small(account.note)
                    .foregroundStyle(account.noteIsTrouble
                                     ? Color(red: 1, green: 0.765, blue: 0.698)
                                     : Color(red: 1, green: 0.914, blue: 0.714))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: 330, alignment: .leading)
        .disabled(account.busy)
        .opacity(account.busy ? 0.6 : 1)
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 7) {
            field { TextField("", text: $email, prompt: ghost("Email")) }
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            field { SecureField("", text: $password, prompt: ghost("Password")) }
                .textContentType(.password)
            HStack(spacing: 7) {
                press("Sign in", filled: true) {
                    Task { await account.signIn(email: email, password: password) }
                }
                press("Make one") {
                    Task { await account.signUp(email: email, password: password) }
                }
            }
        }
    }

    private var mine: some View {
        HStack(spacing: 7) {
            press("Sign out") { Task { await account.signOut() } }
            /* Gone is gone, so it takes two presses: the first says what the second does. */
            press(arming ? "Delete for good?" : "Delete account", warn: true) {
                if arming {
                    arming = false
                    Task { await account.deleteAccount() }
                } else {
                    arming = true
                }
            }
        }
        .task(id: arming) {
            guard arming else { return }
            try? await Task.sleep(for: .seconds(5))
            if !Task.isCancelled { arming = false }
        }
    }

    // MARK: - the parts

    private func small(_ text: String) -> Text {
        /* the web sets these in CSS, where text-transform leaves the string alone; here
           the case is in the string, so the result is still a Text and can be styled */
        Text(text.uppercased()).font(MG.mono(11)).tracking(0.99)
    }

    private func ghost(_ text: String) -> Text {
        small(text).foregroundColor(dim.opacity(0.55))
    }

    private func field<Content: View>(@ViewBuilder _ control: () -> Content) -> some View {
        control()
            .font(MG.mono(11))
            .tracking(0.66)
            .foregroundStyle(Lacquer.cream)
            .tint(Lacquer.cream)
            .padding(.vertical, 9)
            .padding(.horizontal, 10)
            .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 5))
            .overlay { RoundedRectangle(cornerRadius: 5).strokeBorder(line) }
    }

    private func press(_ title: String, filled: Bool = false, warn: Bool = false,
                       tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            small(title)
                .foregroundStyle(filled ? Color(red: 88/255, green: 6/255, blue: 10/255)
                                        : (warn ? Color(red: 1, green: 0.788, blue: 0.733)
                                                : Lacquer.cream))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .padding(.horizontal, 8)
                .background(filled ? Lacquer.cream : Color.clear,
                            in: RoundedRectangle(cornerRadius: 5))
                .overlay {
                    RoundedRectangle(cornerRadius: 5)
                        .strokeBorder(filled ? Lacquer.cream
                                             : (warn ? line.opacity(0.7) : line))
                }
        }
    }
}
