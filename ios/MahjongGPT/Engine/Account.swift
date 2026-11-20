import Foundation
import Observation
import Security

/* An account, so where you left off follows you rather than the one phone.
   What it carries is exactly what the app already saves on its own: the table mid-hand,
   the lesson you reached, how loud it is. Nothing about how you played, no name, nothing
   else -- there is nothing else to carry. The same row the web app reads, over the same
   two endpoints, with URLSession rather than a package: for one sign-in and one row of
   JSON a dependency would be more to carry than the code it saves.
   Signed out, or with no project behind it, every call here returns at once and the app
   is the app it was -- the saves stay on the phone and no account appears in the menu. */

/// What travels, and the two names it goes by.
enum Carried: CaseIterable {
    case table, school, sound

    /* The table is the one value whose shape differs between the two apps -- the web keeps
       its own fields, this one keeps turnSeconds -- so it travels under a key of its own
       and comes back only to another phone. The school and the sound are the same two
       values on both, so those do cross between the web and here. */
    var remote: String {
        switch self {
        case .table: "mahjong-table-v1.ios"
        case .school: "mahjong-school"
        case .sound: "mahjong-volume"
        }
    }

    /// what UserDefaults calls it on this phone
    var local: String {
        switch self {
        case .table: "mahjong-table-v1"
        case .school: "mahjong-school"
        case .sound: "mahjong-sound"
        }
    }
}

/* A refresh token is a credential: it can be spent for a new session, and with one of
   those an account can be deleted. UserDefaults is a plist that goes into an unencrypted
   backup as it stands, so the session lives here instead. */
private enum Keychain {
    static func read() -> Data? {
        var query = base
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var found: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &found) == errSecSuccess else { return nil }
        return found as? Data
    }

    static func write(_ data: Data) {
        if SecItemCopyMatching(base as CFDictionary, nil) == errSecSuccess {
            SecItemUpdate(base as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        } else {
            var add = base
            add[kSecValueData as String] = data
            /* reachable in the background after the phone has been unlocked once, which is
               what a save that goes up while the app is being put away needs */
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    static func clear() { SecItemDelete(base as CFDictionary) }

    private static var base: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.mahjonggpt.account",
         kSecAttrAccount as String: "supabase-session"]
    }
}

@MainActor @Observable final class Account {
    /* The project this talks to. The publishable key belongs in the app -- that is what it
       is for; it carries no rights of its own, because every row is reached through a
       policy comparing auth.uid() to the row's owner, and anon has no policy at all. */
    static let project = ""
    static let publishable = ""
    static var configured: Bool { !project.isEmpty && !publishable.isEmpty }

    /* One account for the whole app, because the two places that save -- the sound switch
       and the school's own step -- are a static enum and a plain struct, neither of which
       has anywhere to hold an injected one. */
    static let shared = Account()

    private(set) var email: String?
    private(set) var note = ""
    private(set) var noteIsTrouble = false
    private(set) var busy = false
    /// bumped when a pull has put something new in the store, so the screens can re-read
    private(set) var landed = 0

    var signedIn: Bool { email != nil }

    private var session: Session?
    private var pending: Set<Carried> = []
    private var waiting: Task<Void, Never>?

    private init() {
        guard Self.configured, let data = Keychain.read(),
              let kept = try? JSONDecoder().decode(Session.self, from: data) else { return }
        session = kept
        email = kept.email
    }

    // MARK: - carrying it both ways

    /* Called beside each local save. The table saves on every one of your turns and none
       of those is worth a request of its own, so they gather for a second and a half and
       go up together. */
    func push(_ key: Carried) {
        guard session != nil else { return }
        pending.insert(key)
        waiting?.cancel()
        waiting = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(1500))
            guard !Task.isCancelled else { return }
            await self?.flush()
        }
    }

    /// The school's step is kept in a plain struct with no actor of its own: this is its door in.
    nonisolated static func noteSchool() {
        Task { @MainActor in shared.push(.school) }
    }

    func flush() async {
        let keys = pending
        pending = []
        guard !keys.isEmpty, let bearer = await bearer() else { return }
        var patch: [String: String] = [:]
        for key in keys { if let value = Self.reading(key) { patch[key.remote] = value } }
        guard !patch.isEmpty,
              let body = try? JSONEncoder().encode(["patch": patch]) else { return }
        /* offline, or signed out underneath: the local save has already happened, and the
           next one carries the same table up again */
        _ = try? await Self.ask("/rest/v1/rpc/save_state", body: body, bearer: bearer)
    }

    /// Everything in the row that this phone can read, written in. True if anything moved.
    @discardableResult func pull() async -> Bool {
        guard let bearer = await bearer(),
              let data = try? await Self.ask("/rest/v1/saves?select=state",
                                             method: "GET", bearer: bearer),
              let rows = try? JSONDecoder().decode([Row].self, from: data),
              let state = rows.first?.state else { return false }
        var moved = false
        for key in Carried.allCases {
            guard let value = state[key.remote] else { continue }
            if Self.writing(value, key) { moved = true }
        }
        if moved { landed += 1 }
        return moved
    }

    // MARK: - signing in

    func signIn(email address: String, password: String) async {
        await attempt {
            try self.keep(await Self.ask("/auth/v1/token?grant_type=password",
                                         body: Self.credentials(address, password)))
            if await self.pull() == false { await self.flush() }
        }
    }

    func signUp(email address: String, password: String) async {
        await attempt {
            let reply = try await Self.ask("/auth/v1/signup",
                                           body: Self.credentials(address, password))
            if (try? JSONDecoder().decode(Reply.self, from: reply))?.access_token != nil {
                try self.keep(reply)
                /* a new account starts from whatever this phone already had */
                for key in Carried.allCases { self.pending.insert(key) }
                await self.flush()
                self.say("Account made.")
            } else {
                /* the project is set to confirm an address first */
                self.say("Check your email to confirm, then sign in.")
            }
        }
    }

    func signOut() async {
        waiting?.cancel()
        pending = []
        if let bearer = await bearer() {
            _ = try? await Self.ask("/auth/v1/logout", bearer: bearer)
        }
        forget()
        say("Signed out. This phone keeps the table it has.")
    }

    /* App Store review guideline 5.1.1(v): an app that lets you make an account has to let
       you delete it from inside the app. The save goes with the account. */
    func deleteAccount() async {
        await attempt {
            guard let bearer = await self.bearer() else { return }
            _ = try await Self.ask("/rest/v1/rpc/delete_account",
                                   body: Data("{}".utf8), bearer: bearer)
            self.forget()
            self.say("Account deleted.")
        }
    }

    // MARK: - the session

    private func bearer() async -> String? {
        guard let held = session else { return nil }
        if Date() < held.expires { return held.access }
        do {
            let body = try JSONEncoder().encode(["refresh_token": held.refresh])
            try keep(await Self.ask("/auth/v1/token?grant_type=refresh_token", body: body))
        } catch {
            forget()   /* the session is over; the app is still perfectly playable */
        }
        return session?.access
    }

    private func keep(_ data: Data) throws {
        let reply = try JSONDecoder().decode(Reply.self, from: data)
        guard let access = reply.access_token, let refresh = reply.refresh_token else {
            throw Trouble.said("That did not come back with a session.")
        }
        let held = Session(access: access, refresh: refresh,
                           /* a minute early, so no request goes out on a token that
                              expires while it is in flight */
                           expires: Date().addingTimeInterval(Double((reply.expires_in ?? 3600) - 60)),
                           email: reply.user?.email ?? session?.email ?? "")
        session = held
        email = held.email
        if let encoded = try? JSONEncoder().encode(held) { Keychain.write(encoded) }
    }

    private func forget() {
        session = nil
        email = nil
        Keychain.clear()
    }

    private func attempt(_ work: @escaping () async throws -> Void) async {
        busy = true
        say("")
        do { try await work() }
        catch { say(error.localizedDescription, trouble: true) }
        busy = false
    }

    private func say(_ text: String, trouble: Bool = false) {
        note = text
        noteIsTrouble = trouble
    }

    // MARK: - the two values' two shapes

    private static func reading(_ key: Carried) -> String? {
        let store = UserDefaults.standard
        guard store.object(forKey: key.local) != nil else { return nil }
        switch key {
        case .table:
            guard let data = store.data(forKey: key.local) else { return nil }
            return String(data: data, encoding: .utf8)
        case .school, .sound:
            return String(store.integer(forKey: key.local))
        }
    }

    private static func writing(_ value: String, _ key: Carried) -> Bool {
        let store = UserDefaults.standard
        switch key {
        case .table:
            guard let data = value.data(using: .utf8), store.data(forKey: key.local) != data
            else { return false }
            store.set(data, forKey: key.local)
        case .school, .sound:
            guard let number = Int(value),
                  store.object(forKey: key.local) == nil
                    || store.integer(forKey: key.local) != number else { return false }
            store.set(number, forKey: key.local)
        }
        return true
    }

    // MARK: - the wire

    private static func credentials(_ email: String, _ password: String) throws -> Data {
        try JSONEncoder().encode(["email": email, "password": password])
    }

    private static func ask(_ path: String, method: String = "POST",
                            body: Data? = nil, bearer: String? = nil) async throws -> Data {
        guard let url = URL(string: project + path) else { throw Trouble.said("No project set.") }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(publishable, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        if let bearer { request.setValue("Bearer " + bearer, forHTTPHeaderField: "authorization") }
        request.httpBody = body
        let (data, response) = try await URLSession.shared.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else {
            let said = (try? JSONDecoder().decode(Complaint.self, from: data))?.text
            throw Trouble.said(said ?? HTTPURLResponse.localizedString(forStatusCode: code))
        }
        return data
    }

    private struct Session: Codable {
        var access: String
        var refresh: String
        var expires: Date
        var email: String
    }

    private struct Reply: Decodable {
        let access_token: String?
        let refresh_token: String?
        let expires_in: Int?
        let user: Who?
        struct Who: Decodable { let email: String? }
    }

    private struct Row: Decodable { let state: [String: String] }

    private struct Complaint: Decodable {
        let error_description: String?
        let msg: String?
        let message: String?
        var text: String? { error_description ?? msg ?? message }
    }

    enum Trouble: LocalizedError {
        case said(String)
        var errorDescription: String? { if case .said(let what) = self { what } else { nil } }
    }
}
