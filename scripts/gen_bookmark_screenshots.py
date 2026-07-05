#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_bookmark_screenshots.py
────────────────────────────────────────────────────────────────────────────
Generate bookmark screenshot images from bookmarks.json.

For every bookmark the script:
  1. Locates the chapter images (from folder OR .cbz file).
  2. Uses `scrollRatio` to determine which image(s) are visible at that
     scroll position (simulating the vertical-scroll reader).
  3. Composites the visible slice into a single output JPEG and saves it to:
         <output_dir>/<mangaTitle>/screenshot-<ts>.jpg

Usage
-----
    python gen_bookmark_screenshots.py [options]

Options
-------
  --bookmarks       Path to bookmarks.json
                    (default: Critical/bookmarks.json)
  --manga           Root manga folder
                    (default: manga/)
  --meta            Path to data/meta.json
                    (default: data/meta.json)
  --output          Where to write screenshots
                    (default: data/bookmark/saved)
  --update-json     Write new thumbnail paths back into bookmarks.json
  --quality         JPEG quality 1-95  (default: 70)
  --width           Output image width in px  (default: 540)
  --viewport-ratio  Fraction of full height used as viewport  (default: 0.30)
  --only-missing    Skip bookmarks whose screenshot already exists on disk
  --filter-manga    Only process entries whose mangaTitle contains this string
  --filter-chapter  Only process entries whose chapterId contains this string
  --dry-run         Print actions without writing anything
"""

import argparse
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from typing import Optional

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── dependency check ──────────────────────────────────────────────────────────
try:
    from PIL import Image
except ImportError:
    print("[ERROR] Pillow is not installed. Run:  pip install Pillow")
    sys.exit(1)

# ── helpers ───────────────────────────────────────────────────────────────────
_NS_RE = re.compile(r"(\d+)")

def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in _NS_RE.split(s)]

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".avif"}

def is_image_name(name: str) -> bool:
    return Path(name).suffix.lower() in IMAGE_EXT


# ── CBZ helper ────────────────────────────────────────────────────────────────
class CbzImage:
    """Lazy-read image from a CBZ (zip) archive."""
    def __init__(self, zf: zipfile.ZipFile, name: str):
        self._zf = zf
        self.name = name

    def open(self) -> Image.Image:
        with self._zf.open(self.name) as f:
            return Image.open(io.BytesIO(f.read()))

    def size(self) -> tuple:
        with self._zf.open(self.name) as f:
            im = Image.open(io.BytesIO(f.read()))
            return im.size


def load_cbz_entries(cbz_path: Path) -> tuple:
    """Return (zf, [CbzImage, ...]) sorted naturally."""
    zf = zipfile.ZipFile(cbz_path, "r")
    names = sorted(
        [n for n in zf.namelist() if is_image_name(n) and not n.startswith("__MACOSX")],
        key=lambda n: natural_key(Path(n).name)
    )
    return zf, [CbzImage(zf, n) for n in names]


# ── chapter resolution ────────────────────────────────────────────────────────
def resolve_manga_dir(manga_id: str, manga_title: str,
                      manga_root: Path, meta: dict) -> Optional[Path]:
    """
    Find the folder that holds the manga (not individual chapters).
    Tries:
      1. sourcePath from meta.json
      2. manga_root / manga_id
      3. manga_root / manga_id without trailing "(N)" suffix
      4. manga_root / manga_title
    """
    for key in (manga_id, manga_title):
        entry = meta.get(key) or {}
        sp = (entry.get("sourcePath") or "").strip().strip('"')
        if sp:
            p = Path(sp)
            if p.is_dir():
                return p

    candidates = [manga_id, manga_title]
    # Strip trailing " (2)" / " (3)" etc.
    clean = re.sub(r"\s*\(\d+\)$", "", manga_id).strip()
    if clean != manga_id:
        candidates.append(clean)

    for name in candidates:
        p = manga_root / name
        if p.is_dir():
            return p

    return None


def get_chapter_images(manga_dir: Path, chapter_id: str):
    """
    Return a list of image sources for a chapter.
    Sources can be Path objects (folder) or CbzImage objects.
    Also returns an optional ZipFile handle that must be closed later.
    """
    zf_handle = None

    # 1. Folder chapter
    folder = manga_dir / chapter_id
    if folder.is_dir():
        imgs = sorted(
            [f for f in folder.iterdir() if f.is_file() and is_image_name(f.name)],
            key=lambda f: natural_key(f.name)
        )
        return imgs, zf_handle

    # 2. CBZ chapter
    cbz = manga_dir / (chapter_id + ".cbz")
    if cbz.is_file():
        zf_handle, imgs = load_cbz_entries(cbz)
        return imgs, zf_handle

    return [], None


def open_image(src) -> Image.Image:
    """Open from Path or CbzImage."""
    if isinstance(src, Path):
        return Image.open(src)
    return src.open()   # CbzImage


def image_size(src) -> tuple:
    if isinstance(src, Path):
        with Image.open(src) as im:
            return im.size
    return src.size()


# ── rendering ─────────────────────────────────────────────────────────────────
def render_slice(images: list,
                 scroll_ratio: float,
                 out_width: int = 540,
                 viewport_ratio: float = 0.30) -> Optional[Image.Image]:
    """
    Composite the portion of the chapter visible at `scroll_ratio`
    into a single PIL image of width `out_width`.

    The reader stores:
        scrollRatio = (scrollTop + clientHeight/2) / scrollHeight
    So:
        scrollTop = scrollRatio * scrollHeight - clientHeight/2
    """
    if not images:
        return None

    # --- pass 1: collect sizes --------------------------------------------------
    sizes = []
    for src in images:
        try:
            sizes.append(image_size(src))
        except Exception:
            sizes.append((800, 1200))

    ref_w = sizes[0][0] or 800
    # Scaled heights (all images treated as same width = ref_w)
    abs_h = [max(1, int(h * ref_w / w)) if w > 0 else int(h) for w, h in sizes]
    total_h = sum(abs_h)

    if total_h <= 0:
        return None

    # --- viewport in pixels ---------------------------------------------------
    vp_h = max(1, int(total_h * viewport_ratio))
    center_y = int(scroll_ratio * total_h)
    scroll_top = max(0, center_y - vp_h // 2)
    scroll_top = min(scroll_top, total_h - vp_h)
    scroll_top = max(0, scroll_top)
    scroll_bot = scroll_top + vp_h

    # --- output canvas --------------------------------------------------------
    scale = out_width / ref_w
    canvas_h = max(1, int(vp_h * scale))
    canvas = Image.new("RGB", (out_width, canvas_h), (0, 0, 0))

    # --- pass 2: paint --------------------------------------------------------
    y = 0
    for i, src in enumerate(images):
        img_top = y
        img_bot = y + abs_h[i]

        inter_top = max(img_top, scroll_top)
        inter_bot = min(img_bot, scroll_bot)

        if inter_bot > inter_top:
            try:
                with open_image(src) as im:
                    im_w, im_h = im.size
                    if im_w <= 0 or im_h <= 0:
                        y = img_bot
                        continue

                    sy_scale = im_h / abs_h[i] if abs_h[i] > 0 else 1
                    sy = int((inter_top - img_top) * sy_scale)
                    sh = max(1, int((inter_bot - inter_top) * sy_scale))
                    crop = im.crop((0, sy, im_w, sy + sh))

                    dst_y = int((inter_top - scroll_top) * scale)
                    dst_h = max(1, int(crop.height * scale * (ref_w / im_w)))
                    resized = crop.resize((out_width, dst_h), Image.LANCZOS)
                    canvas.paste(resized, (0, dst_y))
            except Exception:
                pass

        y = img_bot
        if y >= scroll_bot:
            break

    return canvas


# ── main ──────────────────────────────────────────────────────────────────────
def main():
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent   # scripts/ → project root

    p = argparse.ArgumentParser(description="Generate bookmark screenshots")
    p.add_argument("--bookmarks",
                   default=str(project_root / "Critical" / "bookmarks.json"))
    p.add_argument("--manga",
                   default=str(project_root / "manga"))
    p.add_argument("--meta",
                   default=str(project_root / "data" / "meta.json"))
    p.add_argument("--output",
                   default=str(project_root / "data" / "bookmark" / "saved"))
    p.add_argument("--update-json", action="store_true",
                   help="Write updated thumbnail paths back to bookmarks.json")
    p.add_argument("--quality", type=int, default=70)
    p.add_argument("--width",   type=int, default=540)
    p.add_argument("--viewport-ratio", type=float, default=0.30)
    p.add_argument("--only-missing", action="store_true")
    p.add_argument("--filter-manga",   default="")
    p.add_argument("--filter-chapter", default="")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    bookmarks_path = Path(args.bookmarks)
    manga_root     = Path(args.manga)
    meta_path      = Path(args.meta)
    output_root    = Path(args.output)

    if not bookmarks_path.exists():
        print(f"[ERROR] bookmarks.json not found: {bookmarks_path}")
        sys.exit(1)

    with open(bookmarks_path, "r", encoding="utf-8") as f:
        bookmarks = json.load(f)

    meta = {}
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)

    print(f"[INFO] Loaded {len(bookmarks)} bookmarks")
    print(f"[INFO] Manga root : {manga_root}")
    print(f"[INFO] Output dir : {output_root}")
    print()

    filtered = list(bookmarks)
    if args.filter_manga:
        filtered = [b for b in filtered
                    if args.filter_manga.lower() in (b.get("mangaTitle") or "").lower()]
    if args.filter_chapter:
        filtered = [b for b in filtered
                    if args.filter_chapter.lower() in (b.get("chapterId") or "").lower()]

    print(f"[INFO] Entries to process: {len(filtered)}")
    print()

    ok = skip = fail = 0
    updated_bm = {b["id"]: b for b in bookmarks}

    for bm in filtered:
        bm_id       = bm.get("id", "?")
        manga_id    = bm.get("mangaId", "")
        manga_title = bm.get("mangaTitle", manga_id)
        chapter_id  = bm.get("chapterId", "")
        scroll_r    = float(bm.get("scrollRatio") or 0.0)
        ts          = bm.get("ts", 0)

        label = f"{manga_title} / {chapter_id}  (ratio={scroll_r:.3f})"

        # ── find manga folder ─────────────────────────────────────────────────
        manga_dir = resolve_manga_dir(manga_id, manga_title, manga_root, meta)
        if manga_dir is None:
            print(f"  [MISS] Manga folder not found -- {label}")
            fail += 1
            continue

        # ── find chapter images ───────────────────────────────────────────────
        images, zf_handle = get_chapter_images(manga_dir, chapter_id)
        if not images:
            print(f"  [MISS] No images found in chapter -- {label}")
            fail += 1
            if zf_handle:
                zf_handle.close()
            continue

        # ── output path ───────────────────────────────────────────────────────
        safe_series = re.sub(r'[<>:"/\\|?*\x00-\x1F]', " ", manga_title).strip()
        safe_series = re.sub(r"\s+", " ", safe_series)
        out_dir  = output_root / safe_series
        out_file = out_dir / f"screenshot-{ts}.jpg"

        if args.only_missing and out_file.exists():
            if zf_handle:
                zf_handle.close()
            skip += 1
            continue

        if args.dry_run:
            print(f"  [DRY] {label}")
            print(f"         -> {out_file}   ({len(images)} chapter images)")
            if zf_handle:
                zf_handle.close()
            ok += 1
            continue

        # ── render ────────────────────────────────────────────────────────────
        try:
            img = render_slice(images, scroll_r,
                               out_width=args.width,
                               viewport_ratio=args.viewport_ratio)
            if img is None:
                raise ValueError("render_slice returned None")

            out_dir.mkdir(parents=True, exist_ok=True)
            img.save(str(out_file), "JPEG", quality=args.quality, optimize=True)

            print(f"  [OK]  {label}")
            print(f"         -> {out_file}")

            if args.update_json and bm_id in updated_bm:
                updated_bm[bm_id]["thumbnail"] = (
                    f"/api/bookmark/image/{safe_series}/{out_file.name}"
                )

            ok += 1
        except Exception as e:
            print(f"  [ERR] {label}")
            print(f"        {e}")
            fail += 1
        finally:
            if zf_handle:
                zf_handle.close()

    # ── write updated bookmarks.json ──────────────────────────────────────────
    if args.update_json and not args.dry_run and ok > 0:
        updated_list = [updated_bm.get(b["id"], b) for b in bookmarks]
        with open(bookmarks_path, "w", encoding="utf-8") as f:
            json.dump(updated_list, f, ensure_ascii=False, indent=2)
        print()
        print("[INFO] bookmarks.json updated with new thumbnail paths")

    # ── summary ───────────────────────────────────────────────────────────────
    print()
    print("-" * 52)
    print(f"  Success  : {ok}")
    print(f"  Skipped  : {skip}")
    print(f"  Failed   : {fail}")
    print("-" * 52)


if __name__ == "__main__":
    main()
