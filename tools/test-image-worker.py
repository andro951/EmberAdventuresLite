"""Lightweight worker contract tests. No SGLang import, model load or provider request."""
import importlib.util
import io
import json
import pathlib
import unittest
from unittest.mock import patch

file = pathlib.Path(__file__).resolve().parents[1] / "hosting/image/worker.py"
spec = importlib.util.spec_from_file_location("image_worker", file)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class WorkerTests(unittest.TestCase):
    def payload(self):
        return dict(model=worker.MODEL, prompt="A fully clothed wizard at a castle", negative_prompt="nudity", size="1024x1024", n=1, response_format="b64_json", output_format="png", num_inference_steps=8, guidance_scale=1.0, seed=42)

    def test_sglang_turbo_semantics(self):
        self.assertEqual(worker.validate(self.payload())["guidance_scale"], 1.0)
        for key, value in [("guidance_scale", 0.0), ("num_inference_steps", 52), ("model", "other"), ("apiKey", "secret")]:
            payload = self.payload()
            payload[key] = value
            with self.assertRaises(ValueError):
                worker.validate(payload)

    def test_internal_image_request_and_response(self):
        for size in ["832x1216", "1024x1024"]:
            with self.subTest(size=size), patch.object(worker.urllib.request, "urlopen", return_value=io.BytesIO(json.dumps({"data": [{"b64_json": "aGVsbG8="}]}).encode())) as call:
                payload = self.payload()
                payload["size"] = size
                self.assertEqual(worker.generate(payload), {"data": [{"b64_json": "aGVsbG8="}]})
                request = call.call_args.args[0]
                self.assertEqual(request.full_url, "http://127.0.0.1:30001/v1/images/generations")
                self.assertEqual(json.loads(request.data)["seed"], 42)
                self.assertEqual(json.loads(request.data)["size"], size)
                self.assertNotIn("timeout", call.call_args.kwargs)

    def test_missing_result_fails(self):
        with patch.object(worker.urllib.request, "urlopen", return_value=io.BytesIO(b'{"data":[]}')):
            with self.assertRaises(RuntimeError):
                worker.generate(self.payload())

    def test_upstream_mode_needs_no_build_or_gateway(self):
        class ExecReached(Exception):
            pass
        with patch.dict(worker.os.environ, {"EMBER_IMAGE_MODE": "upstream", "EMBER_MODEL_PATH": "/fixture/model"}), patch.object(worker.os, "execvp", side_effect=ExecReached) as execute, patch.object(worker.subprocess, "Popen") as spawn:
            with self.assertRaises(ExecReached):
                worker.main()
            args = execute.call_args.args[1]
            self.assertEqual(args[:2], ["sglang", "serve"])
            self.assertIn("--served-model-name", args)
            self.assertIn("/fixture/model", args)
            spawn.assert_not_called()

    def test_preflight_catches_missing_runtime_and_insufficient_disk(self):
        from collections import namedtuple
        spec = importlib.util.spec_from_file_location("image_preflight", file.with_name("preflight.py"))
        preflight = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(preflight)
        disk = namedtuple("Disk", "total used free")(100, 90, 10)
        result = preflight.check(".", which=lambda _: None, disk_usage=lambda _: disk)
        self.assertFalse(result["readyForPullOrBuild"])
        self.assertFalse(result["dockerCli"])
        self.assertTrue(any("compressed image" in message for message in result["blockers"]))


if __name__ == "__main__":
    unittest.main()
