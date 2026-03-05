import asyncio
import queue
import sys
import threading
import traceback
import time
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional

from backend.hiperdex_scraper import HiperdexScraper

app = FastAPI(title="Hiperdex Scraper Backend")

import os
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


class OutputRedirector:
    """Redirects stdout to a queue for real-time log streaming."""
    def __init__(self, q):
        self.q = q
    def write(self, buf):
        for line in buf.split('\n'):
            line = line.strip('\r ')
            if line:
                self.q.put({"type": "log", "data": line})
    def flush(self):
        pass


class ScraperRequest(BaseModel):
    url: str
    series_name: Optional[str] = ""
    start_chapter: int = 1
    end_chapter: int = 0
    download_enabled: bool = True
    concurrent_enabled: bool = True
    delay: float = 1.0
    download_workers: int = 5
    verbose: bool = False
    output_dir: Optional[str] = "downloads"
    upscale_enabled: bool = True
    upscale_ratio: int = 2
    denoise_level: int = 1
    upscale_workers: int = 3
    waifu2x_path: Optional[str] = ""
    resize_enabled: bool = True
    resize_width: int = 1600
    resize_quality: int = 95
    slice_enabled: bool = False
    slice_height: int = 2400


# Global state
global_state = {
    "is_running": False,
    "thread": None,
    "scraper_instance": None,
    "q": queue.Queue(),
    "abort_event": threading.Event(),
    # Session counter: each run gets a unique ID so stale "done" signals
    # from an aborted thread are silently ignored by the UI.
    "session_id": 0,
}


def _check_waifu2x(custom_path: str = "") -> dict:
    """Check if waifu2x-ncnn-vulkan is reachable."""
    search = [
        custom_path,
        r'D:\Personal Works\Experimental\scrap\waifu2x_backend\waifu2x-ncnn-vulkan.exe',
        './waifu2x_backend/waifu2x-ncnn-vulkan.exe',
        './waifu2x-ncnn-vulkan.exe',
        'waifu2x-ncnn-vulkan',
    ]
    for p in search:
        if not p:
            continue
        try:
            path = Path(p)
            if path.exists():
                return {"status": "found", "path": str(path.resolve())}
        except Exception:
            pass
    return {"status": "not_found", "path": ""}


@app.get("/waifu2x-status")
async def waifu2x_status(path: str = ""):
    return JSONResponse(_check_waifu2x(path))


@app.get("/browse-folder")
async def browse_folder():
    """Open native Windows folder picker dialog."""
    import threading
    result = {"path": ""}

    def _pick():
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            folder = filedialog.askdirectory(
                title="Select Output Folder",
                initialdir=os.path.abspath("downloads")
            )
            root.destroy()
            if folder:
                result["path"] = folder
        except Exception:
            pass

    t = threading.Thread(target=_pick)
    t.start()
    t.join(timeout=120)
    return JSONResponse({"path": result["path"]})


@app.get("/browse-file")
async def browse_file():
    """Open native Windows file picker dialog for waifu2x exe."""
    import threading
    result = {"path": ""}

    def _pick():
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            filepath = filedialog.askopenfilename(
                title="Select waifu2x-ncnn-vulkan.exe",
                filetypes=[("Executable", "*.exe"), ("All files", "*.*")],
                initialdir=os.path.abspath(".")
            )
            root.destroy()
            if filepath:
                result["path"] = filepath
        except Exception:
            pass

    t = threading.Thread(target=_pick)
    t.start()
    t.join(timeout=120)
    return JSONResponse({"path": result["path"]})


@app.post("/start")
async def start_scraper(req: ScraperRequest):
    if global_state["is_running"]:
        return {"status": "error", "message": "Scraper is already running!"}

    # Clear queue and reset abort flag
    while not global_state["q"].empty():
        global_state["q"].get()
    global_state["abort_event"].clear()

    # Bump session id so any lingering "done" from old thread is ignored
    global_state["session_id"] += 1
    session_id = global_state["session_id"]

    def download_progress(completed, total, filename, chapter_num=None, speed_mbps=0.0):
        global_state["q"].put({
            "type": "dl_prog",
            "completed": completed,
            "total": total,
            "filename": filename,
            "chapter": chapter_num,
            "speed": round(speed_mbps, 2),
            "session": session_id,
        })

    def upscale_progress(completed, total, filename, chapter_num=None):
        global_state["q"].put({
            "type": "up_prog",
            "completed": completed,
            "total": total,
            "filename": filename,
            "chapter": chapter_num,
            "session": session_id,
        })

    callbacks = {
        'download_progress': download_progress,
        'upscale_progress': upscale_progress,
    }

    try:
        scraper = HiperdexScraper(
            series_url=req.url.strip(),
            output_dir=req.output_dir.strip() if req.output_dir else "downloads",
            delay=req.delay,
            verbose=req.verbose,
            upscale=req.upscale_enabled,
            upscale_ratio=req.upscale_ratio,
            denoise_level=req.denoise_level,
            waifu2x_path=req.waifu2x_path.strip() if req.waifu2x_path else None,
            resize=req.resize_enabled,
            resize_width=req.resize_width,
            resize_quality=req.resize_quality,
            slice_images=req.slice_enabled,
            slice_height=req.slice_height,
            concurrent=req.concurrent_enabled,
            max_download_workers=req.download_workers,
            max_upscale_workers=req.upscale_workers,
            callbacks=callbacks,
            abort_event=global_state["abort_event"],
        )
        global_state["scraper_instance"] = scraper
    except Exception as e:
        return {"status": "error", "message": f"Initialization failed: {e}"}

    def scraper_thread():
        original_stdout = sys.stdout
        sys.stdout = OutputRedirector(global_state["q"])
        try:
            end_val = None if req.end_chapter == 0 else req.end_chapter
            scraper.download_series(
                series_name=req.series_name.strip() if req.series_name else None,
                start_chapter=req.start_chapter,
                end_chapter=end_val,
            )
        except Exception as e:
            err_msg = traceback.format_exc()
            print(f"Error in scraper: {e}\n{err_msg}")
        finally:
            sys.stdout = original_stdout
            # Only send "done" if this thread's session is still the current one
            if global_state["session_id"] == session_id:
                global_state["q"].put({"type": "done", "session": session_id})
                global_state["is_running"] = False

    global_state["is_running"] = True
    thread = threading.Thread(target=scraper_thread, daemon=True)
    global_state["thread"] = thread
    thread.start()

    return {"status": "ok", "message": "Scraper started", "session": session_id}


@app.post("/abort")
async def abort_scraper():
    if not global_state["is_running"]:
        return {"status": "error", "message": "No scraper is running."}

    # Signal the abort event — scraper checks this between downloads
    global_state["abort_event"].set()

    # Stop the upscale background worker if active
    inst = global_state["scraper_instance"]
    if inst and getattr(inst, "worker", None) and inst.worker.is_running:
        inst.worker.stop()

    # Bump session so the thread's final "done" is ignored (UI already handled)
    global_state["session_id"] += 1
    global_state["is_running"] = False
    global_state["q"].put({"type": "done", "session": global_state["session_id"]})

    return {"status": "ok", "message": "Abort signal sent."}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(0.1)
            msgs = []
            while not global_state["q"].empty() and len(msgs) < 30:
                msgs.append(global_state["q"].get_nowait())
            for msg in msgs:
                await websocket.send_json(msg)
    except (WebSocketDisconnect, Exception):
        pass


@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
