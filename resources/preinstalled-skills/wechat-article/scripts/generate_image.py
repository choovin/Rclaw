#!/usr/bin/env python3
"""
Generate images using Doubao/RunNode image models via OpenAI-compatible API.

Usage:
    python generate_image.py --prompt "your image description" --filename "output.jpg" [--resolution 2K|3K]

Supported models:
    Primary:   doubao-seedream-5-0-260128 (direct URL, synchronous)
    Fallback:  doubao-seedream-4-5-251128 (direct URL, synchronous, requires ≥ 1920x1920)
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SUPPORTED_OUTPUT_RESOLUTIONS = ["2K", "3K"]

# Default model (primary)
MODEL_NAME = "doubao-seedream-5-0-260128"
# Fallback model
FALLBACK_MODEL = "doubao-seedream-4-5-251128"
# API base URL (from openclaw.json -> custom-runnodec.baseUrl)
API_BASE_URL = "https://api.runnode.cn/v1"

# Doubao size map (must be ≥ 3,686,400 total pixels)
DOUB_AO_SIZE_MAP = {
    "2K": "1920x1920",
    "3K": "1920x1920",
}
DOUB_AO_AR_SIZE_MAP = {
    "1:1":  "1920x1920",
    "16:9": "2560x1440",
    "9:16": "1440x2560",
    "4:3":  "2218x1664",
    "3:4":  "1664x2218",
    "2:3":  "1920x1920",
    "3:2":  "1920x1920",
    "21:9": "2560x1440",
}


class ConfigError(RuntimeError):
    """Raised when openclaw.json is missing or invalid."""


def load_openclaw_config() -> tuple[str, str]:
    """Load API key and base URL from openclaw.json."""
    config_path = Path.home() / ".openclaw" / "openclaw.json"
    try:
        raw = config_path.read_text(encoding="utf-8")
        config = json.loads(raw)
    except FileNotFoundError as error:
        raise ConfigError(f"Missing openclaw.json at {config_path}") from error
    except json.JSONDecodeError as error:
        raise ConfigError(f"Invalid JSON in {config_path}: {error}") from error

    provider = config.get("models", {}).get("providers", {}).get("custom-runnodec", {})
    base_url = provider.get("baseUrl", "").strip().rstrip("/")
    api_key = provider.get("apiKey", "").strip()

    if not base_url:
        raise ConfigError("custom-runnodec.baseUrl not found in openclaw.json")
    if not api_key:
        raise ConfigError("custom-runnodec.apiKey not found in openclaw.json")

    return base_url, api_key


def submit_request(base_url: str, api_key: str, model: str, prompt: str, size: str) -> str:
    """Submit image generation request.
    - Doubao: returns direct URL synchronously (no task_id)
    - RunNode: returns task_id for async polling
    """
    url = f"{base_url}/images/generations"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; OpenClaw/1.0)",
    }
    payload = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": size,
        "response_format": "url",
    }
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read()
            try:
                result = json.loads(raw.decode("utf-8"))
            except json.JSONDecodeError as je:
                print(f"JSON parse error: {je}, raw first 100 bytes: {raw[:100]}", file=sys.stderr)
                raise
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"API error ({error.code}): {error.read().decode(errors='replace')}") from error

    # Doubao: data[0].url returned directly (no task_id)
    if result.get("data"):
        direct_url = result["data"][0].get("url")
        if direct_url:
            print(f"  Direct URL received [{model}]: {direct_url[:60]}...")
            return f"direct:{direct_url}"

    # Async task ID path
    task_id = result.get("id")
    if not task_id:
        raise RuntimeError(f"No task id in response: {result}")
    print(f"  Task queued: {task_id}")
    return task_id


def poll_result(base_url: str, api_key: str, task_id: str) -> str:
    """Poll until image URL is ready."""
    url = f"{base_url}/images/generations/{task_id}"
    headers = {"Authorization": f"Bearer {api_key}"}
    for attempt in range(1, 21):
        request = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"Polling error ({error.code}): {error.read().decode(errors='replace')}") from error

        data = result.get("data", [])
        status = result.get("status", "")

        if data:
            image_url = data[0].get("url") or data[0].get("b64_json")
            if image_url:
                return image_url

        if status in ("failed", "error"):
            raise RuntimeError(f"Image generation failed: {result}")

        print(f"  [{attempt}/20] status={status}, waiting 5s...")
        time.sleep(5)

    raise RuntimeError("Timeout after 20 polls.")


def download_file(url: str, output_path: Path) -> tuple[Path, str]:
    """Download file from URL, auto-detect format."""
    request = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            raw_data = response.read()
            content_type = response.headers.get("Content-Type", "")
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Download failed ({error.code}): {error.read().decode(errors='replace')}") from error

    if "png" in content_type or ".png" in url:
        fmt = ".png"
    elif "jpeg" in content_type or "jpg" in content_type or ".jpg" in url:
        fmt = ".jpg"
    else:
        fmt = ".png"

    stem = output_path.stem or "output"
    final_path = output_path.parent / f"{stem}{fmt}"
    final_path.write_bytes(raw_data)
    return final_path, fmt


def choose_output_resolution(requested_resolution: str | None) -> str:
    if requested_resolution in SUPPORTED_OUTPUT_RESOLUTIONS:
        return requested_resolution
    return "2K"


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate images using Doubao models (primary: doubao-seedream-5-0-260128, fallback: doubao-seedream-4-5-251128)"
    )
    parser.add_argument("--prompt", "-p", required=True, help="Image description/prompt")
    parser.add_argument("--filename", "-f", required=True, help="Output filename (e.g., output.jpg)")
    parser.add_argument(
        "--resolution", "-r",
        choices=SUPPORTED_OUTPUT_RESOLUTIONS,
        default=None,
        help="Output resolution: 2K or 3K.",
    )
    parser.add_argument(
        "--aspect-ratio", "-a",
        choices=["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"],
        default=None,
        help="Aspect ratio (maps to Doubao size requirements ≥ 1920x1920).",
    )
    parser.add_argument(
        "--model", "-m",
        default=MODEL_NAME,
        help=f"Model name (default: {MODEL_NAME}).",
    )

    args = parser.parse_args()
    output_path = Path(args.filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        base_url, api_key = load_openclaw_config()
        # Use full API_BASE_URL constant to avoid config path issues
        api_base = API_BASE_URL

        primary_model = args.model or MODEL_NAME
        fallback_model = FALLBACK_MODEL

        output_resolution = choose_output_resolution(args.resolution)
        ar = args.aspect_ratio
        if ar and ar in DOUB_AO_AR_SIZE_MAP:
            size = DOUB_AO_AR_SIZE_MAP[ar]
        else:
            size = DOUB_AO_SIZE_MAP.get(output_resolution, "1920x1920")

        print(f"Generating image: primary={primary_model}, fallback={fallback_model}, size={size}")
        print(f"API: {API_BASE_URL}/images/generations")

        last_error = None
        for attempt_model in [primary_model, fallback_model]:
            if attempt_model != primary_model:
                print(f"  [Fallback] Retrying with {attempt_model} ...")
            try:
                result_data = submit_request(api_base, api_key, attempt_model, args.prompt, size)
                if result_data.startswith("direct:"):
                    image_url = result_data[7:]
                else:
                    image_url = poll_result(api_base, api_key, result_data)
                last_error = None
                break
            except RuntimeError as e:
                last_error = e
                print(f"  Model {attempt_model} failed: {e}")
                continue

        if last_error is not None:
            raise last_error

        print(f"  Downloading: {image_url}")
        final_path, fmt = download_file(image_url, output_path)
        print(f"\nImage saved: {final_path}")
        print(f"MEDIA:{final_path}")
        return 0

    except ConfigError as error:
        print(f"Config error: {error}", file=sys.stderr)
        return 1
    except RuntimeError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except Exception as error:
        print(f"Unexpected error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
