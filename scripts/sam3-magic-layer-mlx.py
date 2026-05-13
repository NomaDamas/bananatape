#!/usr/bin/env python3
"""mlx_sam3 adapter for BananaTape Magic Layer (Apple Silicon).

Bridges Deekshith-Dade/mlx_sam3 (MLX SAM3 port for M-series Macs) to
BananaTape's /api/magic-layer JSON contract:

  {"segments": [{"id", "label", "score", "bbox":{"x","y","width","height"},
                 "maskDataUrl": "data:image/png;base64,..."}]}

BananaTape's auto-installer calls this script with:
  --input <png path>  --output <json path>  [--prompts a,b,c]
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import time
from pathlib import Path
from typing import Iterable

import numpy as np
import mlx.core as mx
from PIL import Image

from sam3 import build_sam3_image_model
from sam3.model.sam3_image_processor import Sam3Processor


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run mlx_sam3 and emit BananaTape Magic Layer segments JSON.")
    parser.add_argument("positional_input", nargs="?", help="Input image path (fallback positional form).")
    parser.add_argument("positional_output", nargs="?", help="Output JSON path (fallback positional form).")
    parser.add_argument("--input", dest="input_path", help="Input image path.")
    parser.add_argument("--output", dest="output_path", help="Output JSON path.")
    parser.add_argument(
        "--prompts",
        default="person,animal,cat,dog,bird,plant,flower,tree,food,product,bottle,cup,chair,table,car,building,text,logo",
        help="Comma-separated SAM 3 concept prompts to try. Specific nouns work much better than generic 'object'.",
    )
    parser.add_argument("--score-threshold", type=float, default=0.25, help="Minimum SAM 3 score to keep after model inference.")
    parser.add_argument("--max-segments", type=int, default=24, help="Maximum number of segments to emit.")
    parser.add_argument("--confidence-threshold", type=float, default=0.2, help="Sam3Processor confidence threshold before post-filtering.")
    parser.add_argument("--min-area-ratio", type=float, default=0.002, help="Drop masks smaller than this fraction of the image.")
    parser.add_argument("--max-area-ratio", type=float, default=0.75, help="Drop masks larger than this fraction of the image.")
    parser.add_argument("--nms-iou", type=float, default=0.72, help="Drop lower-scoring boxes with IoU above this value.")
    parser.add_argument("--debug", action="store_true", help="Print debug info to stderr.")
    return parser.parse_args()


def to_numpy(arr) -> np.ndarray:
    if isinstance(arr, mx.array):
        return np.asarray(arr)
    if hasattr(arr, "detach"):
        return arr.detach().cpu().numpy()
    return np.asarray(arr)


def mask_to_data_url(mask_array, target_w: int, target_h: int) -> str:
    arr = to_numpy(mask_array)
    while arr.ndim > 2:
        arr = arr.squeeze(axis=0) if arr.shape[0] == 1 else arr[0]
    alpha = (arr > 0).astype("uint8") * 255
    image = Image.fromarray(alpha, mode="L")
    if image.size != (target_w, target_h):
        image = image.resize((target_w, target_h), resample=Image.NEAREST)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def box_to_xywh(box) -> dict[str, float]:
    arr = to_numpy(box).astype(float).flatten()
    if arr.size != 4:
        raise ValueError(f"Expected 4 box values, got {arr.size}")
    x1, y1, x2, y2 = arr.tolist()
    return {"x": x1, "y": y1, "width": max(1.0, x2 - x1), "height": max(1.0, y2 - y1)}


def score_at(scores, index: int) -> float:
    if scores is None:
        return 1.0
    arr = to_numpy(scores)
    if arr.size == 0:
        return 1.0
    return float(arr.flat[index])


def binary_mask(mask_array) -> np.ndarray:
    arr = to_numpy(mask_array)
    while arr.ndim > 2:
        arr = arr.squeeze(axis=0) if arr.shape[0] == 1 else arr[0]
    return arr > 0


def mask_bbox(mask_array, fallback_box) -> dict[str, float]:
    mask = binary_mask(mask_array)
    ys, xs = np.nonzero(mask)
    if xs.size == 0 or ys.size == 0:
        return box_to_xywh(fallback_box)
    x1 = float(xs.min())
    y1 = float(ys.min())
    x2 = float(xs.max() + 1)
    y2 = float(ys.max() + 1)
    return {"x": x1, "y": y1, "width": max(1.0, x2 - x1), "height": max(1.0, y2 - y1)}


def area_ratio(box: dict[str, float], image_size: tuple[int, int]) -> float:
    target_w, target_h = image_size
    return (box["width"] * box["height"]) / max(1.0, float(target_w * target_h))


def iou(a: dict[str, float], b: dict[str, float]) -> float:
    ax2 = a["x"] + a["width"]
    ay2 = a["y"] + a["height"]
    bx2 = b["x"] + b["width"]
    by2 = b["y"] + b["height"]
    ix1 = max(a["x"], b["x"])
    iy1 = max(a["y"], b["y"])
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter <= 0:
        return 0.0
    union = a["width"] * a["height"] + b["width"] * b["height"] - inter
    return inter / max(union, 1e-6)


def dedupe_segments(segments: list[dict], nms_iou: float, max_segments: int) -> list[dict]:
    ordered = sorted(segments, key=lambda s: (float(s.get("score", 0)), s["bbox"]["width"] * s["bbox"]["height"]), reverse=True)
    kept: list[dict] = []
    for segment in ordered:
        if any(iou(segment["bbox"], existing["bbox"]) >= nms_iou for existing in kept):
            continue
        kept.append(segment)
        if len(kept) >= max_segments:
            break
    return kept


def iter_prompt_segments(processor, state, prompt: str, threshold: float, image_size: tuple[int, int], min_area_ratio: float, max_area_ratio: float, log) -> Iterable[dict]:
    output = processor.set_text_prompt(prompt=prompt, state=state)
    masks = output.get("masks")
    boxes = output.get("boxes")
    scores = output.get("scores")

    if masks is None or boxes is None:
        log(f"[prompt={prompt}] no masks/boxes in output")
        return

    masks_np = to_numpy(masks)
    boxes_np = to_numpy(boxes)
    n = boxes_np.shape[0] if boxes_np.ndim >= 2 else 0
    log(f"[prompt={prompt}] {n} candidate(s)")

    target_w, target_h = image_size

    for index in range(n):
        score = score_at(scores, index)
        if score < threshold:
            log(f"  - skip idx={index} score={score:.3f} < {threshold}")
            continue
        try:
            box = boxes_np[index]
            mask = masks_np[index]
            bbox = mask_bbox(mask, box)
            ratio = area_ratio(bbox, image_size)
            if ratio < min_area_ratio or ratio > max_area_ratio:
                log(f"  - skip idx={index} area_ratio={ratio:.4f} outside [{min_area_ratio}, {max_area_ratio}]")
                continue
            yield {
                "id": f"{prompt.replace(' ', '-')}-{index + 1}",
                "label": prompt,
                "score": score,
                "bbox": bbox,
                "maskDataUrl": mask_to_data_url(mask, target_w, target_h),
            }
        except Exception as exc:
            log(f"  - error idx={index}: {exc}")


def main() -> int:
    args = parse_args()
    input_path = Path(args.input_path or args.positional_input or "")
    output_path = Path(args.output_path or args.positional_output or "")
    if not input_path.is_file():
        print(f"input path does not exist: {input_path}", file=sys.stderr)
        return 2
    if not output_path:
        print("output path is required", file=sys.stderr)
        return 2

    def log(msg: str) -> None:
        if args.debug:
            print(msg, file=sys.stderr, flush=True)

    t0 = time.time()
    log(f"loading image: {input_path}")
    image = Image.open(input_path).convert("RGB")
    target_w, target_h = image.size
    log(f"image size: {target_w}x{target_h}")

    log("loading mlx_sam3 model (weights cached after first run)...")
    model = build_sam3_image_model()
    processor = Sam3Processor(model, confidence_threshold=args.confidence_threshold)
    log(f"model ready in {time.time()-t0:.1f}s")

    t1 = time.time()
    state = processor.set_image(image)
    log(f"set_image done in {time.time()-t1:.2f}s")

    candidates: list[dict] = []
    prompts = [p.strip() for p in args.prompts.split(",") if p.strip()]
    log(f"prompts: {prompts}")

    for prompt in prompts:
        for segment in iter_prompt_segments(
            processor,
            state,
            prompt,
            args.score_threshold,
            (target_w, target_h),
            args.min_area_ratio,
            args.max_area_ratio,
            log,
        ):
            candidates.append(segment)

    segments = dedupe_segments(candidates, args.nms_iou, args.max_segments)
    log(f"kept {len(segments)} of {len(candidates)} candidate(s) after NMS")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps({"segments": segments}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log(f"wrote {len(segments)} segment(s) to {output_path} in {time.time()-t0:.1f}s total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
