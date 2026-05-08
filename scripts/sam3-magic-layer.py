#!/usr/bin/env python3
"""SAM 3 wrapper for BananaTape Magic Layer.

This script adapts Meta's official `facebookresearch/sam3` Python API to the
JSON contract expected by BananaTape's `/api/magic-layer` route.

Requirements are intentionally external to BananaTape's npm package:
  - Python 3.12+
  - a working SAM 3 installation (`pip install -e .` from facebookresearch/sam3)
  - accepted/downloadable SAM 3 checkpoints through the official mechanism
  - a PyTorch runtime supported by the SAM 3 package

Example:
  python3 scripts/sam3-magic-layer.py --input image.png --output segments.json \
    --prompts text,logo,person,product,object
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from pathlib import Path
from typing import Iterable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run SAM 3 and emit BananaTape Magic Layer segments JSON.")
    parser.add_argument("positional_input", nargs="?", help="Input image path (fallback positional form).")
    parser.add_argument("positional_output", nargs="?", help="Output JSON path (fallback positional form).")
    parser.add_argument("--input", dest="input_path", help="Input image path.")
    parser.add_argument("--output", dest="output_path", help="Output JSON path.")
    parser.add_argument(
        "--prompts",
        default="text,logo,person,product,object,foreground",
        help="Comma-separated SAM 3 concept prompts to try.",
    )
    parser.add_argument("--score-threshold", type=float, default=0.35, help="Minimum SAM 3 score to keep.")
    parser.add_argument("--max-segments", type=int, default=24, help="Maximum number of segments to emit.")
    return parser.parse_args()


def data_url_from_mask(mask) -> str:
    import numpy as np
    from PIL import Image

    array = mask.detach().cpu().numpy() if hasattr(mask, "detach") else np.asarray(mask)
    if array.ndim > 2:
      array = array.squeeze()
    alpha = (array > 0).astype("uint8") * 255
    image = Image.fromarray(alpha, mode="L")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def box_to_xywh(box) -> dict[str, float]:
    values = box.detach().cpu().tolist() if hasattr(box, "detach") else list(box)
    if len(values) != 4:
        raise ValueError(f"Expected 4 box values, got {len(values)}")
    x1, y1, x2, y2 = [float(v) for v in values]
    return {"x": x1, "y": y1, "width": max(1.0, x2 - x1), "height": max(1.0, y2 - y1)}


def score_at(scores, index: int) -> float:
    if scores is None:
        return 1.0
    value = scores[index]
    if hasattr(value, "detach"):
        return float(value.detach().cpu().item())
    return float(value)


def iter_prompt_segments(processor, state, prompt: str, threshold: float) -> Iterable[dict]:
    output = processor.set_text_prompt(state=state, prompt=prompt)
    masks = output.get("masks", [])
    boxes = output.get("boxes", [])
    scores = output.get("scores")

    for index, (mask, box) in enumerate(zip(masks, boxes)):
        score = score_at(scores, index)
        if score < threshold:
            continue
        yield {
            "id": f"{prompt.replace(' ', '-')}-{index + 1}",
            "label": prompt,
            "score": score,
            "bbox": box_to_xywh(box),
            "maskDataUrl": data_url_from_mask(mask),
        }


def main() -> int:
    args = parse_args()
    input_path = Path(args.input_path or args.positional_input or "")
    output_path = Path(args.output_path or args.positional_output or "")
    if not input_path.is_file() or not output_path:
        print("input and output paths are required", file=sys.stderr)
        return 2

    try:
        from PIL import Image
        from sam3.model_builder import build_sam3_image_model
        from sam3.model.sam3_image_processor import Sam3Processor
    except Exception as exc:  # pragma: no cover - depends on external SAM 3 env
        print(f"SAM 3 Python dependencies are not available: {exc}", file=sys.stderr)
        return 3

    model = build_sam3_image_model()
    processor = Sam3Processor(model)
    image = Image.open(input_path).convert("RGB")
    state = processor.set_image(image)

    seen: set[tuple[int, int, int, int]] = set()
    segments: list[dict] = []
    prompts = [prompt.strip() for prompt in args.prompts.split(",") if prompt.strip()]
    for prompt in prompts:
        for segment in iter_prompt_segments(processor, state, prompt, args.score_threshold):
            box = segment["bbox"]
            key = (round(box["x"]), round(box["y"]), round(box["width"]), round(box["height"]))
            if key in seen:
                continue
            seen.add(key)
            segments.append(segment)
            if len(segments) >= args.max_segments:
                break
        if len(segments) >= args.max_segments:
            break

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({"segments": segments}, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if segments else 4


if __name__ == "__main__":
    raise SystemExit(main())
