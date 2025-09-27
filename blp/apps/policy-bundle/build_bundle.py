"""Builds a signed OPA bundle for distribution."""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import shutil
import subprocess
import tarfile
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
DEFAULT_OUTPUT = ROOT / "dist"


def iter_policy_files() -> Iterable[Path]:
  """Yield every Rego policy in the source tree."""

  for path in SRC.glob("**/*.rego"):
    if "tests" in path.parts:
      continue
    yield path


def create_bundle(output_dir: Path, version: str) -> Path:
  """Create the gzipped bundle and return the archive path."""

  bundle_path = output_dir / f"policy-bundle-{version}.tar.gz"
  bundle_path.parent.mkdir(parents=True, exist_ok=True)

  with tarfile.open(bundle_path, "w:gz") as tar:
    manifest = {
      "revision": version,
      "roots": [""],
    }
    manifest_bytes = json.dumps(manifest).encode("utf-8")
    manifest_info = tarfile.TarInfo("/.manifest")
    manifest_info.size = len(manifest_bytes)
    tar.addfile(manifest_info, fileobj=_bytes_reader(manifest_bytes))

    for policy in iter_policy_files():
      relative = policy.relative_to(SRC)
      data = policy.read_bytes()
      info = tarfile.TarInfo(str(relative))
      info.size = len(data)
      tar.addfile(info, fileobj=_bytes_reader(data))

  return bundle_path


def compute_sha256(bundle_path: Path) -> str:
  digest = hashlib.sha256()
  digest.update(bundle_path.read_bytes())
  return digest.hexdigest()


def write_checksum(bundle_path: Path, checksum: str) -> Path:
  checksum_path = bundle_path.with_name(bundle_path.name + ".sha256")
  checksum_path.write_text(f"{checksum}  {bundle_path.name}\n", encoding="utf-8")
  return checksum_path


def write_metadata(bundle_path: Path, version: str, checksum: str, signed: bool) -> Path:
  metadata = {
    "version": version,
    "bundle": bundle_path.name,
    "checksum": {
      "algorithm": "sha256",
      "value": checksum,
    },
    "signed": signed,
  }
  metadata_path = bundle_path.with_name(bundle_path.name + ".json")
  metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
  return metadata_path


def _bytes_reader(data: bytes):
  from io import BytesIO

  return BytesIO(data)


def sign_bundle(bundle_path: Path, signing_key: str) -> Path:
  """Generate an HMAC signature for the bundle using the key provided."""

  digest = hmac.new(signing_key.encode("utf-8"), digestmod=hashlib.sha256)
  digest.update(bundle_path.read_bytes())
  signature = base64.b64encode(digest.digest())
  sig_path = bundle_path.with_suffix(bundle_path.suffix + ".sig")
  sig_path.write_bytes(signature)
  return sig_path


def run_tests() -> None:
  """Execute the policy unit tests before bundling."""

  if shutil.which("opa") is None:
    raise SystemExit(
      "opa executable not found in PATH; install OPA to run tests or rerun with --skip-tests"
    )

  subprocess.run(["opa", "test", str(SRC)], check=True)


def build(output: Path, version: str, signing_key: str | None, skip_tests: bool) -> None:
  """Create and optionally sign the policy bundle."""

  if not skip_tests:
    run_tests()

  bundle_path = create_bundle(output, version)
  checksum = compute_sha256(bundle_path)
  checksum_path = write_checksum(bundle_path, checksum)
  metadata_path = write_metadata(bundle_path, version, checksum, bool(signing_key))

  signature_path = None
  if signing_key:
    signature_path = sign_bundle(bundle_path, signing_key)

  print(
    json.dumps(
      {
        "bundle": str(bundle_path),
        "checksum": str(checksum_path),
        "metadata": str(metadata_path),
        "signed": bool(signing_key),
        "signature": str(signature_path) if signature_path else None,
      }
    )
  )


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Build and sign OPA policy bundle")
  parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
  parser.add_argument("--version", default="dev")
  parser.add_argument("--signing-key", dest="signing_key")
  parser.add_argument("--skip-tests", action="store_true", help="skip running opa test before bundling")
  return parser.parse_args()


if __name__ == "__main__":
  args = parse_args()
  build(args.output, args.version, args.signing_key, args.skip_tests)
