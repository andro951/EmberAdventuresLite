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
        with patch.object(worker.urllib.request, "urlopen", return_value=io.BytesIO(json.dumps({"data": [{"b64_json": "aGVsbG8="}]}).encode())) as call:
            self.assertEqual(worker.generate(self.payload()), {"data": [{"b64_json": "aGVsbG8="}]})
            request = call.call_args.args[0]
            self.assertEqual(request.full_url, "http://127.0.0.1:30001/v1/images/generations")
            self.assertEqual(json.loads(request.data)["seed"], 42)
            self.assertNotIn("timeout", call.call_args.kwargs)

    def test_missing_result_fails(self):
        with patch.object(worker.urllib.request, "urlopen", return_value=io.BytesIO(b'{"data":[]}')):
            with self.assertRaises(RuntimeError):
                worker.generate(self.payload())


if __name__ == "__main__":
    unittest.main()
