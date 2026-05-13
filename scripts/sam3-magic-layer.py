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
        default="person,animal,cat,dog,bird,plant,flower,tree,food,product,bottle,cup,chair,table,car,building,text,logo",
        help="Comma-separated SAM 3 concept prompts to try. Specific nouns work much better than generic 'object'.",
    )
    parser.add_argument("--score-threshold", type=float, default=0.25, help="Minimum SAM 3 score to keep after model inference.")
    parser.add_argument("--max-segments", type=int, default=24, help="Maximum number of segments to emit.")
    parser.add_argument("--min-area-ratio", type=float, default=0.002, help="Drop masks smaller than this fraction of the image.")
    parser.add_argument("--max-area-ratio", type=float, default=0.75, help="Drop masks larger than this fraction of the image.")
    parser.add_argument("--nms-iou", type=float, default=0.72, help="Drop lower-scoring boxes with IoU above this value.")
    parser.add_argument("--layout-segments", type=int, default=8, help="Maximum no-dependency layout/color components to add for slide-like images.")
    parser.add_argument("--layout-distance-threshold", type=float, default=42.0, help="RGB distance from border-estimated background for layout component extraction.")
    return parser.parse_args()


def to_numpy(value):
    import numpy as np

    return value.detach().cpu().numpy() if hasattr(value, "detach") else np.asarray(value)


def data_url_from_mask(mask) -> str:
    import numpy as np
    from PIL import Image

    array = to_numpy(mask)
    while array.ndim > 2:
        array = array.squeeze(axis=0) if array.shape[0] == 1 else array[0]
    alpha = (array > 0).astype("uint8") * 255
    rgba = np.zeros((*alpha.shape, 4), dtype="uint8")
    rgba[..., :3] = 255
    rgba[..., 3] = alpha
    image = Image.fromarray(rgba, mode="RGBA")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def box_to_xywh(box) -> dict[str, float]:
    values = to_numpy(box).astype(float).flatten().tolist()
    if len(values) != 4:
        raise ValueError(f"Expected 4 box values, got {len(values)}")
    x1, y1, x2, y2 = [float(v) for v in values]
    return {"x": x1, "y": y1, "width": max(1.0, x2 - x1), "height": max(1.0, y2 - y1)}


def score_at(scores, index: int) -> float:
    if scores is None:
        return 1.0
    arr = to_numpy(scores)
    if arr.size == 0:
        return 1.0
    return float(arr.flat[index])


def binary_mask(mask) -> "object":
    arr = to_numpy(mask)
    while arr.ndim > 2:
        arr = arr.squeeze(axis=0) if arr.shape[0] == 1 else arr[0]
    return arr > 0


def mask_bbox(mask, fallback_box) -> dict[str, float]:
    import numpy as np

    mask_array = binary_mask(mask)
    ys, xs = np.nonzero(mask_array)
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


def intersection_area(a: dict[str, float], b: dict[str, float]) -> float:
    ax2 = a["x"] + a["width"]
    ay2 = a["y"] + a["height"]
    bx2 = b["x"] + b["width"]
    by2 = b["y"] + b["height"]
    ix1 = max(a["x"], b["x"])
    iy1 = max(a["y"], b["y"])
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    return max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)


def box_area(box: dict[str, float]) -> float:
    return max(0.0, box["width"]) * max(0.0, box["height"])


def containment_ratio(child: dict[str, float], parent: dict[str, float]) -> float:
    return intersection_area(child, parent) / max(box_area(child), 1e-6)


def suppress_nested_sam_parts(segments: list[dict]) -> list[dict]:
    kept: list[dict] = []
    for child in segments:
        if child.get("source") == "layout":
            kept.append(child)
            continue
        child_box = child["bbox"]
        child_area = box_area(child_box)
        suppress = False
        for parent in segments:
            if parent is child or parent.get("source") == "layout":
                continue
            parent_box = parent["bbox"]
            parent_area = box_area(parent_box)
            if parent_area < child_area * 1.35:
                continue
            if containment_ratio(child_box, parent_box) < 0.82:
                continue
            if float(parent.get("score", 0)) < float(child.get("score", 0)) * 0.35:
                continue
            suppress = True
            break
        if not suppress:
            kept.append(child)
    return kept


def dedupe_segments(segments: list[dict], nms_iou: float, max_segments: int) -> list[dict]:
    candidates = suppress_nested_sam_parts(segments)
    ordered = sorted(
        candidates,
        key=lambda s: (float(s.get("score", 0)), min(box_area(s["bbox"]), 1_000_000.0)),
        reverse=True,
    )
    kept: list[dict] = []
    for segment in ordered:
        if any(iou(segment["bbox"], existing["bbox"]) >= nms_iou for existing in kept):
            continue
        kept.append(segment)
        if len(kept) >= max_segments:
            break
    return kept


def connected_components(mask: "object") -> list[tuple[int, int, int, int, int]]:
    import numpy as np

    h, w = mask.shape
    visited = np.zeros((h, w), dtype=bool)
    components: list[tuple[int, int, int, int, int]] = []
    ys, xs = np.nonzero(mask)
    for start_x, start_y in zip(xs.tolist(), ys.tolist()):
        if visited[start_y, start_x]:
            continue
        stack = [(start_x, start_y)]
        visited[start_y, start_x] = True
        min_x = max_x = start_x
        min_y = max_y = start_y
        area = 0
        while stack:
            x, y = stack.pop()
            area += 1
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if nx < 0 or ny < 0 or nx >= w or ny >= h or visited[ny, nx] or not mask[ny, nx]:
                    continue
                visited[ny, nx] = True
                stack.append((nx, ny))
        components.append((min_x, min_y, max_x + 1, max_y + 1, area))
    return components


def iter_layout_segments(image, image_size: tuple[int, int], max_segments: int, threshold: float, min_area_ratio: float, max_area_ratio: float) -> Iterable[dict]:
    import numpy as np
    from PIL import Image, ImageFilter

    target_w, target_h = image_size
    arr = np.asarray(image.convert("RGB"), dtype=np.float32)
    border = np.concatenate([arr[0, :, :], arr[-1, :, :], arr[:, 0, :], arr[:, -1, :]], axis=0)
    background = np.median(border, axis=0)
    distance = np.sqrt(((arr - background) ** 2).sum(axis=2))
    foreground = distance > threshold
    foreground_ratio = float(foreground.mean())
    if foreground_ratio < 0.005 or foreground_ratio > 0.78:
        return

    scale = min(1.0, 420.0 / max(target_w, target_h))
    small_w = max(1, int(round(target_w * scale)))
    small_h = max(1, int(round(target_h * scale)))
    small = Image.fromarray((foreground.astype("uint8") * 255), mode="L").resize((small_w, small_h), resample=Image.Resampling.NEAREST)
    kernel = max(3, int(round(19 * scale)))
    if kernel % 2 == 0:
        kernel += 1
    small = small.filter(ImageFilter.MaxFilter(kernel))
    small_mask = np.asarray(small) > 0

    components = []
    for sx1, sy1, sx2, sy2, _area in connected_components(small_mask):
        x1 = max(0, int(sx1 / scale) - 3)
        y1 = max(0, int(sy1 / scale) - 3)
        x2 = min(target_w, int(np.ceil(sx2 / scale)) + 3)
        y2 = min(target_h, int(np.ceil(sy2 / scale)) + 3)
        if x2 <= x1 or y2 <= y1:
            continue
        component_mask = np.zeros((target_h, target_w), dtype=bool)
        component_mask[y1:y2, x1:x2] = foreground[y1:y2, x1:x2]
        bbox = mask_bbox(component_mask, [x1, y1, x2, y2])
        ratio = area_ratio(bbox, image_size)
        layout_max_area_ratio = min(max_area_ratio, 0.45)
        if ratio < min_area_ratio or ratio > layout_max_area_ratio:
            continue
        components.append((bbox["width"] * bbox["height"], bbox, component_mask))

    components.sort(key=lambda item: item[0], reverse=True)
    emitted = 0
    for _area, bbox, component_mask in components:
        emitted += 1
        yield {
            "id": f"layout-{emitted}",
            "label": "layout element",
            "score": 0.45,
            "source": "layout",
            "bbox": bbox,
            "maskDataUrl": data_url_from_mask(component_mask),
        }
        if emitted >= max_segments:
            break


def iter_prompt_segments(processor, state, prompt: str, threshold: float, image_size: tuple[int, int], min_area_ratio: float, max_area_ratio: float) -> Iterable[dict]:
    output = processor.set_text_prompt(state=state, prompt=prompt)
    masks = output.get("masks", [])
    boxes = output.get("boxes", [])
    scores = output.get("scores")

    for index, (mask, box) in enumerate(zip(masks, boxes)):
        score = score_at(scores, index)
        if score < threshold:
            continue
        bbox = mask_bbox(mask, box)
        ratio = area_ratio(bbox, image_size)
        if ratio < min_area_ratio or ratio > max_area_ratio:
            continue
        yield {
            "id": f"{prompt.replace(' ', '-')}-{index + 1}",
            "label": prompt,
            "score": score,
            "source": "sam",
            "bbox": bbox,
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

    candidates: list[dict] = []
    prompts = [prompt.strip() for prompt in args.prompts.split(",") if prompt.strip()]
    image_size = image.size
    for prompt in prompts:
        for segment in iter_prompt_segments(processor, state, prompt, args.score_threshold, image_size, args.min_area_ratio, args.max_area_ratio):
            candidates.append(segment)

    if args.layout_segments > 0:
        candidates.extend(iter_layout_segments(image, image_size, args.layout_segments, args.layout_distance_threshold, args.min_area_ratio, args.max_area_ratio))

    segments = dedupe_segments(candidates, args.nms_iou, args.max_segments)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({"segments": segments}, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if segments else 4


if __name__ == "__main__":
    raise SystemExit(main())
