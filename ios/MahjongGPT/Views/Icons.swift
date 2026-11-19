import SwiftUI

/* The site draws its controls as SVG in a 24x24 box. Rather than find near-enough SF
   Symbols, the same path data is carried over and drawn here, so a button in the app is
   the button on the page: same strokes, same weight, same round caps. */
/// a point on an ellipse, and the tangent there -- the two things an arc-to-Bézier needs
private func onArc(_ t: CGFloat, _ cx: CGFloat, _ cy: CGFloat, _ rx: CGFloat, _ ry: CGFloat,
                   _ cosPhi: CGFloat, _ sinPhi: CGFloat) -> CGPoint {
    let c = cos(t), s = sin(t)
    return CGPoint(x: cx + rx * c * cosPhi - ry * s * sinPhi,
                   y: cy + rx * c * sinPhi + ry * s * cosPhi)
}

private func slope(_ t: CGFloat, _ rx: CGFloat, _ ry: CGFloat,
                   _ cosPhi: CGFloat, _ sinPhi: CGFloat) -> CGPoint {
    let c = cos(t), s = sin(t)
    return CGPoint(x: -rx * s * cosPhi - ry * c * sinPhi,
                   y: -rx * s * sinPhi + ry * c * cosPhi)
}

struct SVGPath: Shape {
    let d: String
    var viewBox: CGFloat = 24

    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / viewBox
        var path = Path()
        var cursor = CGPoint.zero
        var start = CGPoint.zero
        var command: Character = "M"
        var numbers: [CGFloat] = []
        var token = ""

        func flushNumber() {
            if let value = Double(token) { numbers.append(CGFloat(value)) }
            token = ""
        }

        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * scale, y: rect.minY + y * scale)
        }

        /* An elliptical arc written the way SVG writes it -- end point, radii and two
           flags -- turned into the centre form and then into Béziers, which is the one
           way to draw it without guessing at the sweep direction. */
        func arc(rx rxIn: CGFloat, ry ryIn: CGFloat, rotation: CGFloat,
                 largeArc: Bool, sweep: Bool, to end: CGPoint) {
            var rx = abs(rxIn), ry = abs(ryIn)
            guard rx > 0, ry > 0, cursor != end else {
                path.addLine(to: point(end.x, end.y)); cursor = end; return
            }
            let phi: CGFloat = rotation * .pi / 180
            let cosPhi = cos(phi), sinPhi = sin(phi)
            let dx2 = (cursor.x - end.x) / 2
            let dy2 = (cursor.y - end.y) / 2
            let x1p = cosPhi * dx2 + sinPhi * dy2
            let y1p = -sinPhi * dx2 + cosPhi * dy2
            let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
            if lambda > 1 {
                let grow = sqrt(lambda)
                rx *= grow
                ry *= grow
            }
            let rxs = rx * rx, rys = ry * ry
            let numerator = rxs * rys - rxs * y1p * y1p - rys * x1p * x1p
            let denominator = rxs * y1p * y1p + rys * x1p * x1p
            var factor = sqrt(max(0, numerator / max(denominator, 0.000001)))
            if largeArc == sweep { factor = -factor }
            let cxp = factor * rx * y1p / ry
            let cyp = -factor * ry * x1p / rx
            let cx = cosPhi * cxp - sinPhi * cyp + (cursor.x + end.x) / 2
            let cy = sinPhi * cxp + cosPhi * cyp + (cursor.y + end.y) / 2

            let theta1 = atan2((y1p - cyp) / ry, (x1p - cxp) / rx)
            let theta2 = atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx)
            var delta = theta2 - theta1
            if !sweep && delta > 0 { delta -= 2 * .pi }
            if sweep && delta < 0 { delta += 2 * .pi }

            let steps = max(1, Int(ceil(abs(delta) / (.pi / 2))))
            let step = delta / CGFloat(steps)
            let alpha = 4.0 / 3.0 * tan(step / 4)
            var theta = theta1
            for _ in 0..<steps {
                let next = theta + step
                let p1 = onArc(theta, cx, cy, rx, ry, cosPhi, sinPhi)
                let p2 = onArc(next, cx, cy, rx, ry, cosPhi, sinPhi)
                let d1 = slope(theta, rx, ry, cosPhi, sinPhi)
                let d2 = slope(next, rx, ry, cosPhi, sinPhi)
                path.addCurve(to: point(p2.x, p2.y),
                              control1: point(p1.x + alpha * d1.x, p1.y + alpha * d1.y),
                              control2: point(p2.x - alpha * d2.x, p2.y - alpha * d2.y))
                theta = next
                cursor = p2
            }
        }

        func run() {
            switch command {
            case "M", "m":
                for i in stride(from: 0, to: numbers.count - 1, by: 2) {
                    var p = CGPoint(x: numbers[i], y: numbers[i + 1])
                    if command == "m" { p = CGPoint(x: cursor.x + p.x, y: cursor.y + p.y) }
                    if i == 0 { path.move(to: point(p.x, p.y)); start = p }
                    else { path.addLine(to: point(p.x, p.y)) }
                    cursor = p
                }
            case "L", "l":
                for i in stride(from: 0, to: numbers.count - 1, by: 2) {
                    var p = CGPoint(x: numbers[i], y: numbers[i + 1])
                    if command == "l" { p = CGPoint(x: cursor.x + p.x, y: cursor.y + p.y) }
                    path.addLine(to: point(p.x, p.y)); cursor = p
                }
            case "H", "h":
                for value in numbers {
                    let p = CGPoint(x: command == "h" ? cursor.x + value : value, y: cursor.y)
                    path.addLine(to: point(p.x, p.y)); cursor = p
                }
            case "V", "v":
                for value in numbers {
                    let p = CGPoint(x: cursor.x, y: command == "v" ? cursor.y + value : value)
                    path.addLine(to: point(p.x, p.y)); cursor = p
                }
            case "A", "a":
                for i in stride(from: 0, to: numbers.count - 6, by: 7) {
                    var end = CGPoint(x: numbers[i + 5], y: numbers[i + 6])
                    if command == "a" { end = CGPoint(x: cursor.x + end.x, y: cursor.y + end.y) }
                    arc(rx: numbers[i], ry: numbers[i + 1], rotation: numbers[i + 2],
                        largeArc: numbers[i + 3] != 0, sweep: numbers[i + 4] != 0, to: end)
                }
            case "Z", "z":
                path.closeSubpath(); cursor = start
            default: break
            }
            numbers = []
        }

        for ch in d {
            if ch.isLetter {
                flushNumber(); run(); command = ch
                if ch == "Z" || ch == "z" { run() }
            } else if ch == "-" && !token.isEmpty && token.last != "e" {
                flushNumber(); token = "-"
            } else if ch == "." && token.contains(".") {
                flushNumber(); token = "."
            } else if ch == "," || ch == " " {
                flushNumber()
            } else {
                token.append(ch)
            }
        }
        flushNumber(); run()
        return path
    }
}

/// The same 24-box icons the site uses, stroked the way its SVGs are.
struct Glyph: View {
    let paths: [String]
    var strokeWidth: CGFloat = 2.2
    var size: CGFloat
    /// an unstroked circle in the middle, which only the gear has
    var circle: CGRect?

    var body: some View {
        let scale = size / 24
        ZStack {
            ForEach(Array(paths.enumerated()), id: \.offset) { _, d in
                SVGPath(d: d)
                    .stroke(style: StrokeStyle(lineWidth: strokeWidth * scale,
                                               lineCap: .round, lineJoin: .round))
            }
            if let circle {
                Circle()
                    .stroke(lineWidth: strokeWidth * scale)
                    .frame(width: circle.width * scale, height: circle.height * scale)
                    .offset(x: (circle.midX - 12) * scale, y: (circle.midY - 12) * scale)
            }
        }
        .frame(width: size, height: size)
    }
}

enum Icon {
    static let menu = ["M3 6h18M3 12h18M3 18h18"]
    static let close = ["M5 5l14 14M19 5 5 19"]
    static let speaker = "M4 9.5h3L11.5 6v12L7 14.5H4z"
    static let wave = "M15.5 9.2a4 4 0 010 5.6"
    static let loud = "M18.4 6.8a8 8 0 010 10.4"
    static let crossed = "M15.5 9.5l5 5m0-5l-5 5"
    static let gear = "M9.87 5.44 L9.85 2.85 L14.15 2.85 L14.13 5.44 L16.62 6.87 L18.85 5.57 L21.00 9.28 L18.75 10.57 L18.75 13.43 L21.00 14.72 L18.85 18.43 L16.62 17.13 L14.13 18.56 L14.15 21.15 L9.85 21.15 L9.87 18.56 L7.38 17.13 L5.15 18.43 L3.00 14.72 L5.25 13.43 L5.25 10.57 L3.00 9.28 L5.15 5.57 L7.38 6.87 Z"
    static let back = ["M14.5 5.5L8 12l6.5 6.5"]
    static let on = ["M9.5 5.5L16 12l-6.5 6.5"]
    static let again = ["M20.5 12a8.5 8.5 0 1 1-2.49-6.01", "M20.5 4.2v4.6h-4.6"]

    static func sound(level: Int) -> [String] {
        var out = [speaker, level > 0 ? wave : crossed]
        if level > 1 { out.append(loud) }
        return out
    }
}
