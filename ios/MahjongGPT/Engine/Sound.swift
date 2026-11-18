import AVFoundation

/* The tiles are not recordings. A clack is a short burst of noise through a bandpass with
   a fast decay -- the same thing the web app builds in WebAudio -- so the app carries no
   audio files and every tile can land at a slightly different pitch. */
@MainActor
enum Sound {
    /// 0 silent, 1 soft, 2 full -- the control steps up and wraps, as it does on the web
    static var level = 2 {
        didSet { UserDefaults.standard.set(level, forKey: "mahjong-sound") }
    }

    private static let engine = AVAudioEngine()
    private static let player = AVAudioPlayerNode()
    private static var clackBuffer: AVAudioPCMBuffer?
    private static var knockBuffer: AVAudioPCMBuffer?
    private static var started = false
    private static let speech = AVSpeechSynthesizer()

    static func load() {
        level = UserDefaults.standard.object(forKey: "mahjong-sound") as? Int ?? 2
    }

    private static func start() {
        guard !started else { return }
        started = true
        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        clackBuffer = burst(format: format, seconds: 0.09, centre: 2400, bite: 0.55)
        knockBuffer = burst(format: format, seconds: 0.16, centre: 900, bite: 0.3)
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        try? engine.start()
        player.play()
    }

    /// noise shaped by a one-pole resonator, with an exponential decay over the top
    private static func burst(format: AVAudioFormat, seconds: Double,
                              centre: Double, bite: Double) -> AVAudioPCMBuffer? {
        let frames = AVAudioFrameCount(format.sampleRate * seconds)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
              let channel = buffer.floatChannelData?[0] else { return nil }
        buffer.frameLength = frames
        let w = 2 * Double.pi * centre / format.sampleRate
        let r = 0.986
        var y1 = 0.0, y2 = 0.0
        for i in 0..<Int(frames) {
            let noise = Double.random(in: -1...1)
            let y = noise * (1 - r) + 2 * r * cos(w) * y1 - r * r * y2
            y2 = y1; y1 = y
            let decay = exp(-Double(i) / (format.sampleRate * seconds * bite))
            channel[i] = Float(max(-1, min(1, y * decay * 3.2)))
        }
        return buffer
    }

    private static func play(_ buffer: AVAudioPCMBuffer?, gain: Float) {
        guard level > 0, let buffer else { return }
        start()
        player.volume = gain * (level == 1 ? 0.4 : 1)
        player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
    }

    /// a tile landing on the table
    static func clack(_ gain: Float = 0.8) { play(clackBuffer, gain: gain) }
    /// a set going face up: lower, heavier
    static func meld() { play(knockBuffer, gain: 0.9) }

    /// the tiles pushed around between hands
    static func wash(seconds: Double = 2.6) {
        guard level > 0 else { return }
        let until = Date().addingTimeInterval(seconds)
        func again() {
            guard Date() < until else { return }
            clack(Float.random(in: 0.35...0.85))
            DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(Int.random(in: 40...150))) {
                MainActor.assumeIsolated { again() }
            }
        }
        again()
    }

    /// the call said out loud, the way it is at a table
    static func say(_ word: String) {
        guard level > 0 else { return }
        let line = AVSpeechUtterance(string: word)
        line.rate = 0.46
        line.volume = level == 1 ? 0.5 : 0.9
        speech.speak(line)
    }
}
