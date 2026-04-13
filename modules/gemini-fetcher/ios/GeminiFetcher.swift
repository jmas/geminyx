import Foundation
import Network
import React

private func glog(_ message: String) {
    print("[GeminiFetcher]", message)
}

/// Ensures the React Native promise is settled at most once (avoids double resolve/reject).
private final class PromiseGate {
    private var settled = false
    private let lock = NSLock()

    func resolve(_ block: @escaping RCTPromiseResolveBlock, _ value: Any?) {
        lock.lock()
        defer { lock.unlock() }
        guard !settled else { return }
        settled = true
        block(value)
    }

    func reject(_ block: @escaping RCTPromiseRejectBlock, code: String, message: String, error: Error?) {
        lock.lock()
        defer { lock.unlock() }
        guard !settled else { return }
        settled = true
        block(code, message, error)
    }
}

@objc(GeminiFetcher)
class GeminiFetcher: NSObject {

    /// Max time from `fetch` until we cancel and reject (connection never ready, hung read, etc.).
    private static let overallTimeoutSeconds: TimeInterval = 60
    /// If the server sends a full header but never closes TCP (some proxies), treat response as done after this idle gap.
    private static let postHeaderIdleSeconds: TimeInterval = 3

    @objc
    func fetch(_ urlString: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        let gate = PromiseGate()
        var overallTimeoutWork: DispatchWorkItem?
        var idleAfterDataWork: DispatchWorkItem?

        func clearIdleTimer() {
            idleAfterDataWork?.cancel()
            idleAfterDataWork = nil
        }

        func clearOverallTimeout() {
            overallTimeoutWork?.cancel()
            overallTimeoutWork = nil
        }

        func tearDownTimers() {
            clearIdleTimer()
            clearOverallTimeout()
        }

        let resolveOnce: (Any?) -> Void = { value in
            tearDownTimers()
            gate.resolve(resolve, value)
        }

        let rejectOnce: (String, String, Error?) -> Void = { code, message, err in
            tearDownTimers()
            gate.reject(reject, code: code, message: message, error: err)
        }

        guard let url = URL(string: urlString), let host = url.host else {
            rejectOnce("invalid_url", "Invalid Gemini URL", nil)
            return
        }

        let port = NWEndpoint.Port(integerLiteral: UInt16(url.port ?? 1965))
        let hostEndpoint = NWEndpoint.hostPort(host: NWEndpoint.Host(host), port: port)

        let tlsOptions = NWProtocolTLS.Options()

        sec_protocol_options_set_verify_block(tlsOptions.securityProtocolOptions, { (_, _, completionHandler) in
            completionHandler(true)
        }, .main)

        let parameters = NWParameters(tls: tlsOptions)
        let connection = NWConnection(to: hostEndpoint, using: parameters)

        let overall = DispatchWorkItem {
            glog("overall timeout — cancelling \(host)")
            connection.cancel()
            rejectOnce("timeout", "Gemini request timed out", nil)
        }
        overallTimeoutWork = overall
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.overallTimeoutSeconds, execute: overall)

        connection.stateUpdateHandler = { state in
            switch state {
            case .setup:
                glog("state=setup host=\(host)")
            case .waiting(let error):
                glog("state=waiting host=\(host) err=\(String(describing: error))")
            case .preparing:
                glog("state=preparing host=\(host)")
            case .ready:
                glog("state=ready host=\(host)")
                self.sendRequest(
                    connection: connection,
                    urlString: urlString,
                    resolveOnce: resolveOnce,
                    rejectOnce: rejectOnce,
                    scheduleIdleResolve: { text in
                        clearIdleTimer()
                        let work = DispatchWorkItem {
                            guard Self.bufferHasHeaderLine(text) else { return }
                            glog("idle resolve (no TCP EOF) len=\(text.count)")
                            resolveOnce(text)
                            connection.cancel()
                        }
                        idleAfterDataWork = work
                        DispatchQueue.main.asyncAfter(deadline: .now() + Self.postHeaderIdleSeconds, execute: work)
                    },
                    clearIdleTimer: clearIdleTimer
                )
            case .failed(let error):
                glog("state=failed host=\(host) \(error.localizedDescription)")
                rejectOnce("connection_failed", error.localizedDescription, error)
            case .cancelled:
                glog("state=cancelled host=\(host)")
            @unknown default:
                glog("state=other host=\(host)")
            }
        }

        connection.start(queue: .main)
    }

    private static func bufferHasHeaderLine(_ text: String) -> Bool {
        text.range(of: "\r\n") != nil || text.firstIndex(of: "\n") != nil
    }

    private func sendRequest(
        connection: NWConnection,
        urlString: String,
        resolveOnce: @escaping (Any?) -> Void,
        rejectOnce: @escaping (String, String, Error?) -> Void,
        scheduleIdleResolve: @escaping (String) -> Void,
        clearIdleTimer: @escaping () -> Void
    ) {
        let requestString = "\(urlString)\r\n"
        guard let data = requestString.data(using: .utf8) else {
            rejectOnce("encode_failed", "Could not encode request", nil)
            return
        }

        connection.send(content: data, completion: .contentProcessed { error in
            if let error = error {
                rejectOnce("send_failed", error.localizedDescription, error)
                return
            }
            self.receiveResponse(
                connection: connection,
                accumulated: "",
                resolveOnce: resolveOnce,
                rejectOnce: rejectOnce,
                scheduleIdleResolve: scheduleIdleResolve,
                clearIdleTimer: clearIdleTimer
            )
        })
    }

    /// Accumulates chunks; resolves when TCP EOF (`isComplete`) or after idle once a full header line is present.
    private func receiveResponse(
        connection: NWConnection,
        accumulated: String,
        resolveOnce: @escaping (Any?) -> Void,
        rejectOnce: @escaping (String, String, Error?) -> Void,
        scheduleIdleResolve: @escaping (String) -> Void,
        clearIdleTimer: @escaping () -> Void
    ) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, isComplete, error in
            if let error = error {
                rejectOnce("receive_failed", error.localizedDescription, error)
                connection.cancel()
                return
            }

            var text = accumulated
            if let data = data, !data.isEmpty {
                clearIdleTimer()
                guard let chunk = String(data: data, encoding: .utf8) else {
                    rejectOnce("decode_failed", "Invalid UTF-8 in response", nil)
                    connection.cancel()
                    return
                }
                text += chunk
            }

            if isComplete {
                clearIdleTimer()
                resolveOnce(text)
                connection.cancel()
                return
            }

            if !text.isEmpty && Self.bufferHasHeaderLine(text) {
                scheduleIdleResolve(text)
            }

            self.receiveResponse(
                connection: connection,
                accumulated: text,
                resolveOnce: resolveOnce,
                rejectOnce: rejectOnce,
                scheduleIdleResolve: scheduleIdleResolve,
                clearIdleTimer: clearIdleTimer
            )
        }
    }
}
