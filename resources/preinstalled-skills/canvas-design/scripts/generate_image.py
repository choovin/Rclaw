#!/usr/bin/env python3
"""
Generate / edit images using RunNode image models via OpenAI-compatible API.

Supported tasks:
  - Text-to-Image: /v1/images/generations  (runnode/z_image_turbo_bf16)
  - Image-to-Image: /v1/images/edits       (runnode/flux-2-klein-9b, fallback: qwen_image_edit_2511_fp8mixed)

Usage (text-to-image):
    python generate_image.py --prompt "your prompt" --filename "output.png" --resolution 2K

Usage (image-to-image / edits):
    python generate_image.py --prompt "modify the image" --filename "output.png" -i input.png --resolution 2K
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image as PILImage

TEXT_TO_IMAGE_MODEL = "runnode/z_image_turbo_bf16"
IMAGE_TO_IMAGE_MODEL = "runnode/flux-2-klein-9b"
IMAGE_TO_IMAGE_MODEL_FALLBACK = "runnode/qwen_image_edit_2511_fp8mixed"

MAX_INPUT_PIXELS = 2_560_000
SUPPORTED_OUTPUT_RESOLUTIONS = ["2K", "3K"]
SUPPORTED_ASPECT_RATIOS = [
    "1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9",
]
SIZE_MAP = {
    "2K": "1024x1024",
    "3K": "1024x1024",
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


def resize_image_if_needed(image: PILImage.Image) -> tuple[PILImage.Image, bool]:
    width, height = image.size
    if width * height <= MAX_INPUT_PIXELS:
        return image, False
    scale = (MAX_INPUT_PIXELS / float(width * height)) ** 0.5
    resized_width = max(1, int(width * scale))
    resized_height = max(1, int(height * scale))
    resized = image.resize((resized_width, resized_height), PILImage.Resampling.LANCZOS)
    return resized, True


def image_to_data_url(image_path: str) -> tuple[str, int]:
    """Load an image, resize if needed, return data URL and max dimension."""
    try:
        with PILImage.open(image_path) as image:
            copied = image.copy()
            image_format = (copied.format or "PNG").lower()
    except Exception as error:
        raise ConfigError(f"Error loading input image '{image_path}': {error}") from error

    processed_image, resized = resize_image_if_needed(copied)
    width, height = processed_image.size
    if resized:
        print(f"  Resized {image_path} -> {width}x{height}")

    mime_type = "image/png" if image_format == "png" else f"image/{image_format}"
    from io import BytesIO
    buffer = BytesIO()
    save_format = "PNG" if image_format == "png" else (processed_image.format or image_format).upper()
    processed_image.save(buffer, format=save_format)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}", max(width, height)


# ─── Text-to-Image ────────────────────────────────────────────────────────────

def submit_tti_request(base_url: str, api_key: str, model: str, prompt: str, size: str) -> str:
    """Submit text-to-image request, return task ID."""
    url = f"{base_url}/images/generations"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
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
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"API error ({error.code}): {error.read().decode(errors='replace')}") from error

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
        status = result.get("status")
        result_url = result.get("result_url")

        # Data present → success
        if data:
            image_url = data[0].get("url") or data[0].get("b64_json")
            if image_url:
                return image_url

        # Completed with result_url
        if result_url:
            return result_url

        if status in ("failed", "error"):
            raise RuntimeError(f"Image generation failed: {result}")

        print(f"  [{attempt}/20] status={status}, waiting 5s...")
        time.sleep(5)

    raise RuntimeError("Timeout after 20 polls.")


# ─── Image-to-Image (via /v1/images/generations with image input) ─────────────

def submit_i2i_request(base_url: str, api_key: str, model: str, image_url: str, prompt: str, size: str) -> str:
    """Submit image edit request via /images/edits, return task ID (async)."""
    url = f"{base_url}/images/edits"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "image": image_url,
        "prompt": prompt,
        "n": 1,
        "size": size,
    }
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"API error ({error.code}): {error.read().decode(errors='replace')}") from error

    task_id = result.get("id")
    if not task_id:
        raise RuntimeError(f"No task id in response: {result}")
    print(f"  Task queued: {task_id}")
    return task_id


# ─── Download ────────────────────────────────────────────────────────────────

def download_file(url: str, output_path: Path) -> Path:
    """Download file, auto-detect format from Content-Type or URL extension."""
    request = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            raw_data = response.read()
            content_type = response.headers.get("Content-Type", "")
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Download failed ({error.code}): {error.read().decode(errors='replace')}") from error

    fmt = ""
    if "png" in content_type or ".png" in url:
        fmt = ".png"
    elif "jpeg" in content_type or "jpg" in content_type or ".jpg" in url:
        fmt = ".jpg"
    else:
        fmt = ".png"

    stem = output_path.stem or "output"
    final_path = output_path.parent / f"{stem}{fmt}"
    final_path.write_bytes(raw_data)
    return final_path


# ─── Resolution ──────────────────────────────────────────────────────────────

def choose_output_resolution(requested_resolution: str | None) -> str:
    if requested_resolution in SUPPORTED_OUTPUT_RESOLUTIONS:
        return requested_resolution
    return "2K"


# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> int:
    import argparse as _argparse

    parser = _argparse.ArgumentParser(description="Generate or edit images using RunNode models")
    parser.add_argument("--prompt", "-p", required=True, help="Image description / edit instruction")
    parser.add_argument("--filename", "-f", required=True, help="Output filename (e.g., output.png)")
    parser.add_argument(
        "--resolution", "-r",
        choices=SUPPORTED_OUTPUT_RESOLUTIONS,
        default=None,
        help="Output resolution: 2K or 3K. Defaults to 2K.",
    )
    parser.add_argument(
        "--aspect-ratio", "-a",
        choices=SUPPORTED_ASPECT_RATIOS,
        default=None,
        help="Aspect ratio (accepted for compatibility).",
    )
    parser.add_argument(
        "--input-image", "-i",
        action="append", dest="input_images", metavar="IMAGE",
        help="Reference image(s) for image-to-image editing.",
    )
    parser.add_argument(
        "--model", "-m",
        default=None,
        help=f"Model name. Defaults to z_image_turbo_bf16 (tti) or flux-2-klein-9b (edit, fallback qwen_image_edit_2511_fp8mixed).",
    )

    args = parser.parse_args()
    output_path = Path(args.filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        base_url, api_key = load_openclaw_config()
        output_resolution = choose_output_resolution(args.resolution)
        size = SIZE_MAP.get(output_resolution, "1024x1024")

        if args.input_images:
            # Image-to-Image mode
            first_data_url, _ = image_to_data_url(args.input_images[0])
            primary_model = args.model or IMAGE_TO_IMAGE_MODEL
            fallback_model = IMAGE_TO_IMAGE_MODEL_FALLBACK
            print(f"Image-to-image mode: model={primary_model}, fallback={fallback_model}, resolution={output_resolution}")

            # Try primary model first
            task_id = submit_i2i_request(
                base_url, api_key, primary_model, first_data_url, args.prompt, size
            )
            try:
                image_url = poll_result(base_url, api_key, task_id)
            except RuntimeError:
                # Fallback to secondary model if primary fails
                print(f"  Primary model {primary_model} failed, retrying with {fallback_model}...")
                task_id = submit_i2i_request(
                    base_url, api_key, fallback_model, first_data_url, args.prompt, size
                )
                image_url = poll_result(base_url, api_key, task_id)
        else:
            # Text-to-Image mode
            model = args.model or TEXT_TO_IMAGE_MODEL
            print(f"Text-to-image mode: model={model}, resolution={output_resolution}")
            task_id = submit_tti_request(base_url, api_key, model, args.prompt, size)
            image_url = poll_result(base_url, api_key, task_id)

        print(f"  Downloading: {image_url}")
        final_path = download_file(image_url, output_path)

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
