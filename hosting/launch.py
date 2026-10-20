"""Guided local launcher. Connects existing endpoints only; credentials stay in process memory."""
import argparse
import getpass
import json
import os
import pathlib
import queue
import shutil
import subprocess
import sys
import threading
import warnings
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG = ROOT / "hosting/config.local.json"
BRIDGE = ROOT / "hosting/session-server.cjs"


def node_executable():
    node = shutil.which("node")
    if node:
        return node
    user = os.environ.get("USERPROFILE", "")
    bundled = pathlib.Path(user) / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"
    if bundled.is_file():
        return str(bundled)
    raise RuntimeError("Node.js 20+ was not found. Install Node or launch from the existing Codex runtime; no provider was contacted.")


def child_environment():
    # Do not import existing API-key variables or NODE_OPTIONS into the session.
    return {key: os.environ[key] for key in ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA"] if key in os.environ}


def load_defaults(file=CONFIG):
    if not file.exists():
        file.write_text(json.dumps({"text": {"kind": "disabled"}, "image": {"kind": "disabled"}}, indent=2) + "\n", encoding="utf-8")
    try:
        return json.loads(file.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        raise RuntimeError("Cannot read the ignored non-secret hosting/config.local.json. Existing data was not replaced.") from None


def prepare(node, config, handoff):
    result = subprocess.run([node, str(BRIDGE), "--prepare"], input=json.dumps({"config": config, "handoff": handoff}) + "\n", capture_output=True, text=True, cwd=ROOT, env=child_environment(), timeout=15)
    try:
        value = json.loads(result.stdout)
        if result.returncode or "config" not in value:
            raise ValueError()
        return value
    except ValueError:
        raise RuntimeError("Endpoint handoff/configuration was rejected. Use the documented non-secret handoff schema and a complete Chat Completions URL without keys or query parameters.") from None


def read_handoff(file):
    try:
        return json.loads(pathlib.Path(file.strip().strip('"')).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise RuntimeError("Cannot read that endpoint handoff JSON. Select the demo's non-secret export, not a credential file.") from None


def choose_handoff(file, ask=input):
    if file:
        return read_handoff(file)
    file = ask("Paste/drop the demo endpoint handoff JSON path (or Enter for guided URL entry): ").strip()
    if file:
        return read_handoff(file)
    choice = ask("Endpoint: 1 = RunPod load balancer, 2 = Vast proxy, 3 = dedicated/OpenAI compatible [1]: ").strip() or "1"
    if choice not in {"1", "2", "3"}:
        raise RuntimeError("Choose 1, 2 or 3; no provider request was sent.")
    return {"version": 1, "provider": {"1": "runpod_lb", "2": "vast", "3": "openai"}[choice], "url": ask("Complete /v1/chat/completions URL (no key): ").strip(), "model": ask("Served model alias [ember-qwen-27b]: ").strip() or "ember-qwen-27b"}


def hidden_input(label):
    if not sys.stdin.isatty():
        raise RuntimeError("Hidden secret entry requires an interactive console. Reopen Start Hosted Lite.bat; keys were not requested or read from files/environment.")
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        try:
            return getpass.getpass(label)
        except getpass.GetPassWarning:
            raise RuntimeError("This console cannot hide secret entry. Use a normal Windows console; no echoed fallback is allowed.") from None


def collect_secrets(descriptors, ask_secret=hidden_input):
    secrets = {}
    for item in descriptors:
        kind = item["kind"]
        instruction = "raw key, without Bearer" if kind == "bearer-key" else "full Authorization header, e.g. Bearer ... or Basic ..." if kind == "authorization-header" else "raw secret"
        value = ask_secret(f'{item["label"]} ({instruction}; hidden, session only): ')
        if not value.strip() or "\r" in value or "\n" in value:
            raise RuntimeError("A required session credential was empty or invalid; nothing was saved.")
        secrets[item["variable"]] = "Bearer " + value if kind == "bearer-key" else value
    return secrets


def start_session(node, config, secrets, port=51840):
    process = subprocess.Popen([node, str(BRIDGE)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, cwd=ROOT, env=child_environment(), creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0)
    output = queue.Queue()
    def read_output():
        for line in process.stdout:
            output.put(line)
        output.put(None)
    reader = threading.Thread(target=read_output, daemon=True)
    process._ember_reader = reader
    reader.start()
    try:
        process.stdin.write(json.dumps({"config": config, "secrets": secrets, "port": port}) + "\n")
        process.stdin.flush()
        line = output.get(timeout=15)  # Local startup only; never an inference/job deadline.
        value = json.loads(line) if line else {}
        if not value.get("ready"):
            raise RuntimeError("Local proxy did not start. Check the configuration and whether port 51840 is already in use. No provider request was sent.")
        return process, value["url"]
    except (ValueError, queue.Empty, OSError):
        stop_session(process)
        raise RuntimeError("Local proxy startup failed. No credential value was logged or saved.") from None
    except Exception:
        stop_session(process)
        raise


def stop_session(process):
    if process.poll() is None:
        try:
            process.stdin.write("shutdown\n")
            process.stdin.flush()
            process.stdin.close()
            process.wait(timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            process.terminate()
            process.wait(timeout=5)
    reader = getattr(process, "_ember_reader", None)
    if reader:
        reader.join(timeout=2)
    for stream in [process.stdin, process.stdout]:
        if stream and not stream.closed:
            stream.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("handoff", nargs="?", help="Non-secret endpoint handoff JSON")
    args = parser.parse_args()
    process = None
    secrets = {}
    try:
        print("Ember Adventures Lite - local hosted text setup")
        print("Connects an existing endpoint. Does not provision resources or test inference.")
        node = node_executable()
        handoff = choose_handoff(args.handoff)
        value = prepare(node, load_defaults(), handoff)
        if handoff.get("mock") is True:
            print("LOCAL MOCK demo relay: rehearsal only; no paid service/model quality is verified.")
        # Only validated non-secret endpoint/config fields are persisted.
        CONFIG.write_text(json.dumps(value["config"], indent=2) + "\n", encoding="utf-8")
        secrets = collect_secrets(value["credentials"])
        process, url = start_session(node, value["config"], secrets)
        print("Local proxy started. Secrets are session-only; image live validation remains pending.")
        print("In the browser, click 'Open Lite with hosted text'.")
        webbrowser.open(url)
        print("If the browser did not open:", url)
        input("Press Enter here to stop the LOCAL proxy (paid endpoints require the demo's separate shutdown): ")
        return 0
    except (KeyboardInterrupt, EOFError):
        print("\nStopping the local session.")
        return 0
    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
        # Only our static messages are displayed; no third-party stderr/body or credential.
        print(str(error) if isinstance(error, RuntimeError) else "Local setup failed. Check Python/Node and file access; no secrets were saved.")
        return 1
    finally:
        if process:
            stop_session(process)
        secrets.clear()
        print("Local session ended. No persistent credentials were created; cloud resources were not stopped.")


if __name__ == "__main__":
    raise SystemExit(main())
