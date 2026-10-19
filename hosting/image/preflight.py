"""Offline build-host check. Never pulls images, downloads models, or starts a GPU."""
import argparse
import json
import pathlib
import shutil
import subprocess

COMPRESSED_IMAGE_BYTES = 15792040319
DIFFUSERS_CACHE_BYTES = 35711708371  # Public repo metadata minus redundant root turbo.safetensors.
PLANNING_FREE_BYTES = 100 * 1024 ** 3


def check(directory, which=shutil.which, disk_usage=shutil.disk_usage, run=subprocess.run):
    free = disk_usage(directory).free
    docker = which("docker")
    daemon = False
    compose = False
    if docker:
        try:
            daemon = run([docker, "info", "--format", "{{.OSType}}"], capture_output=True, text=True, timeout=15).stdout.strip() == "linux"
            compose = run([docker, "compose", "version"], capture_output=True, timeout=15).returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            pass
    blockers = []
    if not docker:
        blockers.append("Docker CLI unavailable; use an existing Linux GPU host/builder. No runtime was installed.")
    elif not daemon:
        blockers.append("A reachable Linux Docker daemon was not verified.")
    if docker and not compose:
        blockers.append("Docker Compose plugin unavailable/unverified.")
    if free < COMPRESSED_IMAGE_BYTES:
        blockers.append("Free disk is below the compressed image alone; do not pull/build here.")
    elif free < PLANNING_FREE_BYTES:
        blockers.append("Below the conservative 100 GiB free-space planning budget for extraction, cache and build scratch; inspect actual host storage first.")
    return dict(path=str(pathlib.Path(directory).resolve()), freeBytes=free, compressedImageBytes=COMPRESSED_IMAGE_BYTES, diffusersCacheUpperBoundBytes=DIFFUSERS_CACHE_BYTES, planningFreeBytes=PLANNING_FREE_BYTES, dockerCli=bool(docker), linuxDaemon=daemon, composePlugin=compose, blockers=blockers, readyForPullOrBuild=not blockers, gpuCompatibility="not checked", remoteInference="not tested")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", default=".")
    args = parser.parse_args()
    result = check(args.path)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["readyForPullOrBuild"] else 2)
