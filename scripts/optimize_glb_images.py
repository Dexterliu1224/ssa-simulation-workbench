#!/usr/bin/env python3
import argparse
import json
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps


JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def align4(data: bytes, pad: bytes = b"\x00") -> bytes:
    return data + pad * ((4 - len(data) % 4) % 4)


def read_glb(path: Path):
    data = path.read_bytes()
    magic, version, total_length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2 or total_length != len(data):
        raise ValueError(f"{path} is not a valid GLB v2 file")

    offset = 12
    gltf = None
    bin_chunk = b""
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == JSON_CHUNK:
            gltf = json.loads(chunk.rstrip(b" \t\r\n\x00").decode("utf-8"))
        elif chunk_type == BIN_CHUNK:
            bin_chunk = chunk

    if gltf is None:
        raise ValueError(f"{path} has no JSON chunk")
    return gltf, bin_chunk


def write_glb(path: Path, gltf, bin_chunk: bytes):
    json_bytes = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_padded = align4(json_bytes, b" ")
    bin_padded = align4(bin_chunk, b"\x00")
    total_length = 12 + 8 + len(json_padded) + 8 + len(bin_padded)
    out = bytearray()
    out += struct.pack("<III", 0x46546C67, 2, total_length)
    out += struct.pack("<II", len(json_padded), JSON_CHUNK)
    out += json_padded
    out += struct.pack("<II", len(bin_padded), BIN_CHUNK)
    out += bin_padded
    path.write_bytes(out)


def image_has_alpha(image: Image.Image) -> bool:
    if image.mode not in ("RGBA", "LA"):
        return False
    alpha = image.getchannel("A")
    return alpha.getextrema()[0] < 255


def optimize_image(raw: bytes, mime_type: str, max_size: int, quality: int):
    try:
        image = Image.open(BytesIO(raw))
        image = ImageOps.exif_transpose(image)
    except Exception:
        return raw, mime_type, "kept"

    original_size = image.size
    if max(image.size) > max_size:
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    out = BytesIO()
    has_alpha = image_has_alpha(image)
    if has_alpha:
        if image.mode != "RGBA":
            image = image.convert("RGBA")
        image.save(out, format="PNG", optimize=True)
        new_mime = "image/png"
    else:
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        image.save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
        new_mime = "image/jpeg"

    candidate = out.getvalue()
    if len(candidate) >= len(raw) * 0.98:
        return raw, mime_type, "kept"
    mode = "png" if has_alpha else "jpeg"
    resized = "resized" if image.size != original_size else "same-size"
    return candidate, new_mime, f"{mode}/{resized}"


def optimize_glb(path: Path, max_size: int, quality: int):
    gltf, bin_chunk = read_glb(path)
    buffer_views = gltf.get("bufferViews", [])
    images = gltf.get("images", [])
    replacements = {}
    report = []

    for image_index, image in enumerate(images):
        view_index = image.get("bufferView")
        if view_index is None or view_index >= len(buffer_views):
            continue
        view = buffer_views[view_index]
        start = view.get("byteOffset", 0)
        end = start + view.get("byteLength", 0)
        original = bin_chunk[start:end]
        optimized, new_mime, note = optimize_image(
            original,
            image.get("mimeType", "image/png"),
            max_size=max_size,
            quality=quality,
        )
        if optimized != original:
            replacements[view_index] = optimized
            image["mimeType"] = new_mime
        report.append((image_index, len(original), len(optimized), note))

    if not replacements:
        return report, False

    new_bin = bytearray()
    for index, view in enumerate(buffer_views):
        start = view.get("byteOffset", 0)
        end = start + view.get("byteLength", 0)
        blob = replacements.get(index, bin_chunk[start:end])
        new_bin += b"\x00" * ((4 - len(new_bin) % 4) % 4)
        view["byteOffset"] = len(new_bin)
        view["byteLength"] = len(blob)
        new_bin += blob

    if gltf.get("buffers"):
        gltf["buffers"][0]["byteLength"] = len(new_bin)

    write_glb(path, gltf, bytes(new_bin))
    return report, True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--max-size", type=int, default=1536)
    parser.add_argument("--quality", type=int, default=78)
    args = parser.parse_args()

    for file_path in args.files:
        before = file_path.stat().st_size
        report, changed = optimize_glb(file_path, args.max_size, args.quality)
        after = file_path.stat().st_size
        print(f"{file_path}: {before / 1048576:.2f} MB -> {after / 1048576:.2f} MB ({'changed' if changed else 'kept'})")
        for image_index, original, optimized, note in sorted(report, key=lambda row: row[1], reverse=True)[:8]:
            print(f"  image {image_index}: {original / 1048576:.2f} MB -> {optimized / 1048576:.2f} MB {note}")


if __name__ == "__main__":
    main()
