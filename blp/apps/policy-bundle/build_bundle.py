"""Builds a signed OPA bundle for distribution."""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import tarfile
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
DEFAULT_OUTPUT = ROOT / "dist"


def iter_policy_files() -> Iterable[Path]:
  """Yield every Rego policy in the source tree."""

  return SRC.glob("**/*.rego")


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


def build(output: Path, version: str, signing_key: str | None) -> None:
  """Create and optionally sign the policy bundle."""

  bundle_path = create_bundle(output, version)
  if signing_key:
    sign_bundle(bundle_path, signing_key)
  print(json.dumps({"bundle": str(bundle_path), "signed": bool(signing_key)}))


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Build and sign OPA policy bundle")
  parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
  parser.add_argument("--version", default="dev")
  parser.add_argument("--signing-key", dest="signing_key")
  return parser.parse_args()


if __name__ == "__main__":
  args = parse_args()
  build(args.output, args.version, args.signing_key)
