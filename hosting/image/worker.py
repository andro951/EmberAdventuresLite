"""Krea 2 Turbo inference-only HTTP/RunPod worker; no account management or downloads at build."""
import hmac
import json
import os
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL = "krea/Krea-2-Turbo"
MODEL_FILES = ["model_index.json", "transformer/**", "text_encoder/**", "vae/**", "tokenizer/**", "scheduler/**", "processor/**"]
BACKEND = "http://127.0.0.1:30001"
FIELDS = {"model", "prompt", "negative_prompt", "size", "n", "response_format", "output_format", "num_inference_steps", "guidance_scale", "seed"}


def validate(payload):
    if not isinstance(payload, dict) or set(payload) - FIELDS:
        raise ValueError("Unknown image request fields.")
    required = FIELDS - {"seed"}
    if required - set(payload):
        raise ValueError("Missing image request fields.")
    if payload["model"] != MODEL or payload["n"] != 1 or payload["response_format"] != "b64_json" or payload["output_format"] != "png":
        raise ValueError("Use Krea 2 Turbo, n=1, b64_json and PNG output.")
    if not isinstance(payload["prompt"], str) or not payload["prompt"].strip() or not isinstance(payload["negative_prompt"], str):
        raise ValueError("Image prompt strings are required.")
    size = payload["size"]
    if not isinstance(size, str) or len(size.split("x")) != 2 or not all(s.isdigit() and int(s) > 0 for s in size.split("x")):
        raise ValueError("size must be WIDTHxHEIGHT.")
    if payload["num_inference_steps"] != 8 or payload["guidance_scale"] != 1.0:
        raise ValueError("This Turbo worker requires 8 steps and SGLang guidance_scale=1.0.")
    if "seed" in payload and (type(payload["seed"]) is not int or payload["seed"] < 0):
        raise ValueError("seed must be a nonnegative integer.")
    return payload


def generate(payload):
    validate(payload)
    request = urllib.request.Request(BACKEND + "/v1/images/generations", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    # No live-job deadline, retries or model-control endpoints. Failure is explicit.
    with urllib.request.urlopen(request) as response:
        data = json.load(response)
    if not isinstance(data.get("data"), list) or not data["data"] or not isinstance(data["data"][0].get("b64_json"), str):
        raise RuntimeError("Image runtime returned no base64 result.")
    return {"data": [{"b64_json": data["data"][0]["b64_json"]}]}


def ready():
    try:
        with urllib.request.urlopen(BACKEND + "/health", timeout=5) as response:
            return response.status == 200
    except Exception:
        return False


class ImageHandler(BaseHTTPRequestHandler):
    lock = threading.Lock()

    def log_message(self, *args):
        pass  # No prompts, authorization headers or signed URL query data in logs.

    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/ping":
            self.send_response(200 if ready() else 204)
            self.end_headers()
        else:
            self.send_json(404, {"error": "Not found."})

    def do_POST(self):
        if self.path != "/v1/images/generations":
            self.send_json(404, {"error": "Not found."})
            return
        token = os.environ.get("EMBER_IMAGE_TOKEN", "")
        if token and not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + token):
            self.send_json(401, {"error": "Unauthorized."})
            return
        if not self.lock.acquire(blocking=False):
            self.send_json(409, {"error": "Image generation already pending."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 2 * 1024 * 1024:
                self.send_json(413, {"error": "Invalid request length."})
                return
            payload = validate(json.loads(self.rfile.read(length)))
            result = generate(payload)
            self.send_json(200, result)
        except ValueError:
            self.send_json(400, {"error": "Invalid Krea image request."})
        except Exception:
            print("Krea image generation failed; check worker readiness.", file=sys.stderr)
            self.send_json(502, {"error": "Image runtime failed; outcome may be uncertain. Inspect worker before retrying."})
        finally:
            self.lock.release()


def main():
    mode = os.environ.get("EMBER_IMAGE_MODE", "http")
    if mode not in {"http", "runpod", "upstream"}:
        raise ValueError("EMBER_IMAGE_MODE must be http, runpod or upstream.")
    if mode == "http" and not os.environ.get("EMBER_IMAGE_TOKEN") and os.environ.get("EMBER_PROVIDER_AUTH") != "runpod":
        raise ValueError("HTTP mode needs EMBER_IMAGE_TOKEN, or EMBER_PROVIDER_AUTH=runpod behind the authenticated RunPod gateway.")
    model_path = os.environ.get("EMBER_MODEL_PATH")
    if not model_path:
        from huggingface_hub import snapshot_download
        model_path = snapshot_download(repo_id=MODEL, revision=os.environ.get("EMBER_MODEL_REVISION", "98e0fe118d17c9e3547fbb2e25acdbae2cadf7c7"), token=os.environ.get("HF_TOKEN"), allow_patterns=MODEL_FILES)
    if mode == "upstream":
        # Official container + read-only mounted script: no custom build/publication.
        # Publish its container port to host loopback only; use an SSH tunnel.
        os.execvp("sglang", ["sglang", "serve", "--model-path", model_path, "--model-id", "Krea-2-Turbo", "--served-model-name", MODEL, "--num-gpus", "1", "--host", "0.0.0.0", "--port", "30000"])
    child = subprocess.Popen(["sglang", "serve", "--model-path", model_path, "--model-id", "Krea-2-Turbo", "--served-model-name", MODEL, "--num-gpus", "1", "--host", "127.0.0.1", "--port", "30001"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    def stop(*_args):
        child.terminate()
        raise SystemExit(0)
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        if mode == "runpod":
            while not ready():
                if child.poll() is not None:
                    raise RuntimeError("SGLang exited before readiness; verify GPU/driver, model access and cache.")
                time.sleep(2)
            import runpod
            def handler(job):
                try:
                    return generate(job["input"])
                except Exception:
                    raise RuntimeError("Krea image worker failed. Verify input, model access, GPU memory and runtime readiness.") from None
            runpod.serverless.start({"handler": handler})
        else:
            server = ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "30000"))), ImageHandler)
            def monitor():
                child.wait()
                print("SGLang process exited; stopping image gateway.", file=sys.stderr)
                server.shutdown()
            threading.Thread(target=monitor, daemon=True).start()
            server.serve_forever()
    finally:
        if child.poll() is None:
            child.terminate()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Krea worker startup failed. Verify gated-model access, pinned runtime, GPU/driver compatibility and cache space.", file=sys.stderr)
        sys.exit(1)
