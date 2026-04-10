#!/usr/bin/env python3
"""
Generate TTS audio via RunNode /v1/audio/speech API.

Full flow:
  1. Submit task -> POST /v1/audio/speech  (returns task_id)
  2. Poll status -> GET /api/runnode/task/self  (find task by newapi_task_id)
  3. When status==2, download from result_url

Usage:
    python generate_tts.py --text "hello world" --output hello.mp3
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_MODEL = "runnode/Qwen3-TTS-1.7B"
SUPPORTED_MODELS = ("runnode/Qwen3-TTS-1.7B",)
SUPPORTED_FORMATS = ("mp3", "wav", "ogg", "opus", "aac", "flac")
DEFAULT_FORMAT = "mp3"
DEFAULT_VOICE = "alloy"


class ConfigError(RuntimeError):
    pass


def load_config() -> tuple[str, str]:
    cfg_path = Path.home() / ".openclaw" / "openclaw.json"
    try:
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise ConfigError(f"Cannot read openclaw.json: {e}")

    prov = cfg.get("models", {}).get("providers", {}).get("custom-runnodec", {})
    base_url = prov.get("baseUrl", "").strip().rstrip("/")
    api_key = prov.get("apiKey", "").strip()
    if not base_url or not api_key:
        raise ConfigError("custom-runnodec.baseUrl or apiKey missing in openclaw.json")
    return base_url, api_key


def submit_task(base: str, api_key: str, text: str, model: str,
                voice: str, response_format: str, speed: float) -> str:
    """Submit TTS task, return newapi_task_id."""
    url = f"{base}/v1/audio/speech"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "text": text,
        "voice": voice,
        "response_format": response_format,
        "speed": speed,
    }
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers=headers, method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    task_id = result.get("id")
    if not task_id:
        raise RuntimeError(f"No task id in response: {result}")
    return task_id


def poll_for_completion(api_key: str, newapi_task_id: str, max_wait: int = 300) -> str:
    """Poll /api/runnode/task/self until status==2, return result_url."""
    poll_url = "https://api.runnode.cn/api/runnode/task/self"
    headers = {"Authorization": f"Bearer {api_key}"}
    waited = 0
    interval = 5

    while waited < max_wait:
        time.sleep(interval)
        waited += interval

        req = urllib.request.Request(poll_url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"  [poll] request failed: {e}, retrying...")
            continue

        for item in data.get("data", {}).get("items", []):
            if item.get("newapi_task_id") == newapi_task_id:
                status = item.get("status")
                result_url = item.get("result_url")
                if status == 2 and result_url:
                    return result_url
                if status in (3, 4, 5):  # failed / cancelled / error
                    raise RuntimeError(f"Task failed (status={status}): {item.get('error_message')}")
                # status 0=pending, 1=running, 2=done
                print(f"  [poll] status={status}, waited {waited}s...")
                break
        else:
            print(f"  [poll] task not in list yet, waited {waited}s...")

    raise RuntimeError(f"Timeout after {max_wait}s — task did not complete.")


def download(url: str) -> bytes:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def generate_tts(
    text: str,
    model: str = DEFAULT_MODEL,
    voice: str = DEFAULT_VOICE,
    response_format: str = DEFAULT_FORMAT,
    speed: float = 1.0,
    output_path: str | None = None,
) -> Path:
    base, api_key = load_config()
    # Strip /v1 suffix for task/self API
    if base.endswith("/v1") or base.endswith("/v2"):
        base = base.rsplit("/", 1)[0]

    print("----- TTS: RunNode /v1/audio/speech -----")
    print(f"  Model={model}, Voice={voice}, Format={response_format}, Speed={speed}")
    print(f"  Text={text[:50]}{'...' if len(text) > 50 else ''}")

    # Step 1: submit
    task_id = submit_task(base, api_key, text, model, voice, response_format, speed)
    print(f"  Submitted: newapi_task_id={task_id}")

    # Step 2: poll
    print("  Polling for completion...")
    result_url = poll_for_completion(api_key, task_id)
    print(f"  Completed: {result_url[:70]}...")

    # Step 3: download
    print("  Downloading audio...")
    audio_bytes = download(result_url)

    out = Path(output_path).expanduser().resolve() if output_path \
        else Path.cwd() / f"tts-{int(time.time())}.{response_format}"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(audio_bytes)
    print(f"  Saved: {out} ({len(audio_bytes):,} bytes)")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="TTS via RunNode /v1/audio/speech")
    ap.add_argument("-t", "--text", required=True, help="Text to synthesize")
    ap.add_argument("-m", "--model", default=DEFAULT_MODEL, choices=SUPPORTED_MODELS)
    ap.add_argument("-v", "--voice", default=DEFAULT_VOICE)
    ap.add_argument("-f", "--format", dest="response_format",
                    default=DEFAULT_FORMAT, choices=SUPPORTED_FORMATS)
    ap.add_argument("-s", "--speed", type=float, default=1.0)
    ap.add_argument("-o", "--output", help="Output file path")
    args = ap.parse_args()

    if not args.text.strip():
        print("Error: --text is empty", file=sys.stderr)
        return 1

    try:
        out = generate_tts(
            text=args.text.strip(),
            model=args.model,
            voice=args.voice,
            response_format=args.response_format,
            speed=args.speed,
            output_path=args.output,
        )
        print(f"\nMEDIA:{out}")
        return 0
    except ConfigError as e:
        print(f"Config error: {e}", file=sys.stderr)
        return 1
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
