"""Guided launcher checks: local processes/fake credentials only, no provider requests."""
import contextlib
import importlib.util
import io
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

file = pathlib.Path(__file__).resolve().parents[1] / "hosting/launch.py"
spec = importlib.util.spec_from_file_location("hosting_launch", file)
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class LauncherTests(unittest.TestCase):
    def test_defaults_are_nonsecret_and_existing_config_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            file = pathlib.Path(directory) / "config.local.json"
            self.assertEqual(launcher.load_defaults(file), {"text": {"kind": "disabled"}, "image": {"kind": "disabled"}})
            saved = file.read_bytes()
            launcher.load_defaults(file)
            self.assertEqual(file.read_bytes(), saved)

    def test_hidden_credentials_are_explicitly_entered_not_inherited(self):
        descriptors = [{"variable": "AUTH", "kind": "bearer-key", "label": "text"}, {"variable": "GATEWAY", "kind": "raw-key", "label": "gateway"}]
        with patch.dict(os.environ, {"MY_EXISTING_API_KEY": "must-not-use-existing-value"}):
            values = iter(["fake-entered-key", "fake-gateway-key"])
            result = launcher.collect_secrets(descriptors, ask_secret=lambda _: next(values))
            self.assertEqual(result["AUTH"], "Bearer fake-entered-key")
            self.assertEqual(result["GATEWAY"], "fake-gateway-key")
            self.assertNotIn("MY_EXISTING_API_KEY", launcher.child_environment())

    def test_empty_secret_and_noninteractive_prompt_fail_without_echo(self):
        with self.assertRaises(RuntimeError):
            launcher.collect_secrets([{"variable": "AUTH", "kind": "raw-key", "label": "key"}], ask_secret=lambda _: "")
        with patch.object(sys.stdin, "isatty", return_value=False), patch.object(launcher.getpass, "getpass") as prompt:
            with self.assertRaises(RuntimeError):
                launcher.hidden_input("key")
            prompt.assert_not_called()

    def test_mocked_guided_flow_starts_local_proxy_and_saves_no_credentials(self):
        node = launcher.node_executable()
        handoff = {"version": 1, "provider": "runpod_lb", "url": "http://127.0.0.1:9/v1/chat/completions", "model": "ember-qwen-27b"}
        real_start = launcher.start_session
        real_collect = launcher.collect_secrets
        with tempfile.TemporaryDirectory() as directory:
            target = pathlib.Path(directory) / "config.local.json"
            capture = io.StringIO()
            with patch.object(sys, "argv", ["launch.py"]), patch.object(launcher, "CONFIG", target), patch.object(launcher, "load_defaults", side_effect=lambda: {"text": {"kind": "disabled"}, "image": {"kind": "disabled"}}), patch.object(launcher, "choose_handoff", return_value=handoff), patch.object(launcher, "collect_secrets", side_effect=lambda descriptors: real_collect(descriptors, ask_secret=lambda _: "fake-session-value")), patch.object(launcher, "start_session", side_effect=lambda n, c, s: real_start(n, c, s, port=0)), patch.object(launcher.webbrowser, "open") as browser, patch("builtins.input", return_value=""), contextlib.redirect_stdout(capture):
                self.assertEqual(launcher.main(), 0)
            saved = target.read_text(encoding="utf-8")
            self.assertNotIn("fake-session-value", saved)
            self.assertNotIn("fake-session-value", capture.getvalue())
            self.assertEqual(json.loads(saved)["text"]["model"], "ember-qwen-27b")
            self.assertEqual(len(list(pathlib.Path(directory).iterdir())), 1)
            self.assertTrue(browser.call_args.args[0].endswith("/launch"))

    def test_invalid_handoff_is_rejected_before_secret_prompt(self):
        with self.assertRaises(RuntimeError):
            launcher.prepare(launcher.node_executable(), {"text": {"kind": "disabled"}, "image": {"kind": "disabled"}}, {"version": 1, "provider": "openai", "url": "https://not-valid.example/v1/chat/completions?api_key=fake", "model": "ember-qwen-27b"})

    def test_current_demo_export_contract_when_checkout_is_available(self):
        demo = launcher.ROOT.parent.parent / "task-2/model-hosting-demo"
        if not (demo / "hosting/setup_core.py").is_file():
            self.skipTest("Separate demo checkout is not available on this host.")
        sys.path.insert(0, str(demo))
        previous_bytecode = sys.dont_write_bytecode
        sys.dont_write_bytecode = True  # Keep the sibling checkout strictly read-only.
        try:
            from hosting.setup_core import Session
            with tempfile.TemporaryDirectory(dir=launcher.ROOT / "test-output") as directory:
                session = Session(local=directory, mock=True)
                exported = session.handoff("runpod-serverless", port=9001)
                value = launcher.prepare(launcher.node_executable(), {"text": {"kind": "disabled"}, "image": {"kind": "disabled"}}, exported)
                self.assertEqual(value["config"]["text"]["baseUrl"], exported["base_url"])
                self.assertEqual(value["credentials"][0]["variable"], "EMBER_LAUNCH_RELAY_AUTHORIZATION")
                self.assertEqual(len(session.transport.calls), 0)
        finally:
            sys.dont_write_bytecode = previous_bytecode
            sys.path.remove(str(demo))


if __name__ == "__main__":
    unittest.main()
