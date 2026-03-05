#!/usr/bin/env python3
"""
Hiperdex Manga Scraper - Concurrent Edition
Download manga series dan konversi ke format CBZ
With concurrent download + upscale processing
"""

import os
import re
import time
import zipfile
import requests
import subprocess
import threading
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import argparse
from PIL import Image
import io
from queue import Queue
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed


class UpscaleWorker:
    """Background worker untuk process upscale queue"""
    
    def __init__(self, scraper, max_upscale_workers=3, verbose=False):
        self.scraper = scraper
        self.max_upscale_workers = max_upscale_workers
        self.verbose = verbose
        self.queue = Queue()
        self.is_running = False
        self.thread = None
        self.lock = threading.Lock()
        
    def start(self):
        """Start background worker thread"""
        if self.is_running:
            return
        
        self.is_running = True
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()
        if self.verbose:
            print("🔧 Upscale worker started")
    
    def stop(self):
        """Stop worker dan tunggu sampai selesai"""
        if not self.is_running:
            return
        
        self.queue.put(None)  # Poison pill
        if self.thread:
            self.thread.join()
        self.is_running = False
        if self.verbose:
            print("🛑 Upscale worker stopped")
    
    def add_job(self, chapter_data):
        """Tambahkan chapter ke upscale queue"""
        self.queue.put(chapter_data)
        print(f"  📥 Chapter {chapter_data['num']} added to upscale queue (queue size: {self.queue.qsize()})")
    
    def _worker(self):
        """Worker thread yang process upscale jobs"""
        while self.is_running:
            job = self.queue.get()
            
            if job is None:  # Poison pill
                self.queue.task_done()
                break
            
            # Check abort before starting heavy work
            if self.scraper.abort_event.is_set():
                self.queue.task_done()
                break
            
            try:
                self._process_chapter(job)
            except Exception as e:
                print(f"❌ Error processing chapter {job['num']}: {e}")
            finally:
                self.queue.task_done()
    
    def _process_chapter(self, job):
        """Process satu chapter: upscale -> resize -> slice -> CBZ"""
        chapter_num = job['num']
        chapter_title = job['title']
        series_name = job['series']
        temp_dir = job['temp_dir']
        images = job['images']
        
        print(f"\n{'─'*60}")
        print(f"🎨 [Worker] Processing Chapter {chapter_num}: {chapter_title}")
        print(f"{'─'*60}")
        
        # Upscale with parallel processing
        if self.scraper.upscale and images:
            print(f"  🔧 Upscaling {len(images)} images (x{self.scraper.upscale_ratio}) with {self.max_upscale_workers} parallel workers...")
            upscaled = 0
            
            # Use ThreadPoolExecutor for parallel upscaling
            with ThreadPoolExecutor(max_workers=self.max_upscale_workers) as executor:
                # Submit all upscale jobs
                future_to_img = {
                    executor.submit(self.scraper.upscale_image, img_path): img_path
                    for img_path in images
                }
                
                # Collect results as they complete
                completed = 0
                for future in as_completed(future_to_img):
                    img_path = future_to_img[future]
                    completed += 1
                    try:
                        success = future.result()
                        if success:
                            upscaled += 1
                        
                        if hasattr(self.scraper, 'callbacks') and 'upscale_progress' in self.scraper.callbacks:
                            self.scraper.callbacks['upscale_progress'](completed, len(images), img_path.name, chapter_num)
                            
                        if not self.verbose:
                            print(f"  🎨 Upscaling {completed}/{len(images)}...", end='\r')
                    except Exception as e:
                        print(f"\n  ⚠️  Upscale error: {e}")
            
            print(f"  ✅ Upscaled {upscaled}/{len(images)} images" + " "*20)
            
            # Re-scan temp_dir after upscale
            images = sorted(temp_dir.glob('*'))
            images = [p for p in images if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.gif', '.webp')]
        
        # Resize
        if self.scraper.resize and images:
            print(f"  📐 Resizing {len(images)} images to max {self.scraper.resize_width}px...")
            resized = 0
            for idx, img_path in enumerate(images, 1):
                if not self.verbose:
                    print(f"  📐 Resizing {idx}/{len(images)}...", end='\r')
                if self.scraper.resize_image(img_path):
                    resized += 1
            print(f"  ✅ Resized {resized}/{len(images)} images" + " "*20)
            
            # Re-scan after resize
            images = sorted(temp_dir.glob('*'))
            images = [p for p in images if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.gif')]
        
        # Slice
        if self.scraper.slice_images and images:
            print(f"  ✂️  Slicing {len(images)} images (max {self.scraper.slice_height}px per piece)...")
            sliced_images = []
            for idx, img_path in enumerate(images, 1):
                if not self.verbose:
                    print(f"  ✂️  Slicing {idx}/{len(images)}...", end='\r')
                result = self.scraper.slice_image(img_path)
                sliced_images.extend(result)
            images = sorted(sliced_images)
            print(f"  ✅ Total {len(images)} images after slicing" + " "*20)
        
        # Create CBZ
        if images:
            self.scraper.create_cbz(chapter_title, images, series_name)
            
            # Cleanup
            for img_path in images:
                try:
                    img_path.unlink()
                except:
                    pass
            try:
                temp_dir.rmdir()
            except:
                pass
            
            print(f"✅ Chapter {chapter_num} fully processed!")
    
    def wait_completion(self):
        """Tunggu sampai semua jobs selesai"""
        self.queue.join()


class HiperdexScraper:
    def __init__(self, series_url, output_dir="downloads", delay=1.0, verbose=False, 
                 upscale=False, upscale_ratio=2, denoise_level=1, waifu2x_path=None,
                 resize=False, resize_width=1600, resize_quality=95,
                 slice_images=False, slice_height=2400,
                 concurrent=True, max_download_workers=5, max_upscale_workers=3,
                 callbacks=None, abort_event=None):
        """
        Initialize scraper with concurrent processing support
        
        Args:
            concurrent: Enable concurrent download + upscale (default: True)
            max_download_workers: Number of parallel download threads (default: 5)
            max_upscale_workers: Number of parallel upscale processes (default: 3)
                                 Recommended: 1-3 for 8GB VRAM, 3-5 for 12GB+, 5-10 for 16GB+
        """
        self.series_url = series_url
        self.output_dir = Path(output_dir)
        self.delay = delay
        self.verbose = verbose
        self.upscale = upscale
        self.upscale_ratio = upscale_ratio
        self.denoise_level = denoise_level
        self.waifu2x_path = waifu2x_path
        self.resize = resize
        self.resize_width = resize_width
        self.resize_quality = resize_quality
        self.slice_images = slice_images
        self.slice_height = slice_height
        self.concurrent = concurrent  # independent of upscale
        self.max_download_workers = max_download_workers
        self.max_upscale_workers = max_upscale_workers
        self.callbacks = callbacks or {}
        import threading as _threading
        self.abort_event = abort_event if abort_event is not None else _threading.Event()

        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': series_url
        })

        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Upscale background worker — only when BOTH concurrent AND upscale are on
        self.worker = None
        if self.concurrent and self.upscale:
            self.worker = UpscaleWorker(self, max_upscale_workers, verbose)

        # Resolve waifu2x path
        if self.upscale:
            self.waifu2x_path = self._find_waifu2x()

    def _find_waifu2x(self):
        """Cari waifu2x-ncnn-vulkan executable — resolves paths relative to CWD."""
        # Resolve an explicitly provided path first
        if self.waifu2x_path:
            p = Path(self.waifu2x_path)
            if not p.is_absolute():
                p = Path.cwd() / p
            if p.exists():
                print(f"✅ Waifu2x found: {p}")
                return str(p)
        
        # Auto-detect common locations
        common_paths = [
            Path.cwd() / 'waifu2x_backend' / 'waifu2x-ncnn-vulkan.exe',
            Path.cwd() / 'waifu2x-ncnn-vulkan.exe',
        ]
        
        for p in common_paths:
            if p.exists():
                print(f"✅ Waifu2x auto-detected: {p}")
                return str(p)
        
        # Last resort: check if it's on PATH
        try:
            result = subprocess.run(
                ['waifu2x-ncnn-vulkan', '--help'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5
            )
            if result.returncode == 0:
                print("✅ Waifu2x found on system PATH")
                return 'waifu2x-ncnn-vulkan'
        except Exception:
            pass
        
        print("❌ WARNING: waifu2x-ncnn-vulkan not found!")
        print("   Place waifu2x-ncnn-vulkan.exe inside the 'waifu2x_backend/' folder.")
        print("   Upscaling will be skipped!")
        return None
    
    def upscale_image(self, input_path, output_path=None):
        """Upscale gambar menggunakan waifu2x-ncnn-vulkan"""
        if not self.waifu2x_path:
            return False
        
        if output_path is None:
            output_path = input_path.parent / f"{input_path.stem}_upscaled{input_path.suffix}"
        
        cmd = [
            str(self.waifu2x_path),
            '-i', str(input_path),
            '-o', str(output_path),
            '-s', str(self.upscale_ratio),
            '-n', str(self.denoise_level),
            '-f', 'jpg',
        ]
        
        try:
            if self.verbose:
                print(f"    🔧 Upscaling: {input_path.name} (x{self.upscale_ratio})...")
            
            result = subprocess.run(
                cmd,
                stdout=subprocess.DEVNULL if not self.verbose else None,
                stderr=subprocess.DEVNULL if not self.verbose else None,
                timeout=300
            )
            
            if result.returncode == 0 and output_path.exists():
                if output_path != input_path:
                    input_path.unlink()
                    output_path.rename(input_path)
                
                if self.verbose:
                    print(f"    ✅ Upscaled: {input_path.name}")
                return True
            else:
                if self.verbose:
                    print(f"    ⚠️  Upscale failed: {input_path.name}")
                return False
                
        except subprocess.TimeoutExpired:
            print(f"    ⚠️  Upscale timeout: {input_path.name}")
            return False
        except Exception as e:
            if self.verbose:
                print(f"    ⚠️  Upscale error: {e}")
            return False

    def resize_image(self, img_path):
        """Resize gambar ke max width"""
        try:
            with Image.open(img_path) as img:
                original_width, original_height = img.size

                if original_width <= self.resize_width:
                    if self.verbose:
                        print(f"    ⏭️  Skip resize: {img_path.name}")
                    return True

                ratio = self.resize_width / original_width
                new_height = int(original_height * ratio)

                if self.verbose:
                    print(f"    🔧 Resize: {original_width}x{original_height} → {self.resize_width}x{new_height}")

                resized = img.resize((self.resize_width, new_height), Image.LANCZOS)

                if resized.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', resized.size, (255, 255, 255))
                    if resized.mode == 'P':
                        resized = resized.convert('RGBA')
                    background.paste(resized, mask=resized.split()[-1] if resized.mode in ('RGBA', 'LA') else None)
                    resized = background
                elif resized.mode != 'RGB':
                    resized = resized.convert('RGB')

                save_path = img_path.with_suffix('.jpg')
                resized.save(save_path, 'JPEG', quality=self.resize_quality, optimize=True)

                if save_path != img_path:
                    img_path.unlink()

                if self.verbose:
                    print(f"    ✅ Resized: {img_path.name}")
                return True

        except Exception as e:
            print(f"    ⚠️  Resize error: {e}")
            return False

    def slice_image(self, img_path):
        """Potong gambar panjang jadi beberapa bagian"""
        try:
            with Image.open(img_path) as img:
                width, height = img.size

                if height <= self.slice_height:
                    if self.verbose:
                        print(f"    ⏭️  Skip slice: {img_path.name}")
                    return [img_path]

                slices = []
                top = 0
                part = 0
                stem = img_path.stem

                while top < height:
                    bottom = min(top + self.slice_height, height)
                    cropped = img.crop((0, top, width, bottom))

                    if cropped.mode != 'RGB':
                        bg = Image.new('RGB', cropped.size, (255, 255, 255))
                        if cropped.mode == 'RGBA':
                            bg.paste(cropped, mask=cropped.split()[3])
                        else:
                            bg.paste(cropped.convert('RGB'))
                        cropped = bg

                    suffix = chr(ord('a') + part)
                    slice_path = img_path.parent / f"{stem}{suffix}.jpg"
                    cropped.save(slice_path, 'JPEG', quality=self.resize_quality, optimize=True)
                    slices.append(slice_path)

                    top += self.slice_height
                    part += 1

                img_path.unlink()

                if self.verbose:
                    print(f"    ✂️  Sliced {img_path.name} → {len(slices)} parts")

                return slices

        except Exception as e:
            print(f"    ⚠️  Slice error: {e}")
            return [img_path]

    def get_page(self, url):
        """Fetch halaman dengan error handling"""
        try:
            time.sleep(self.delay)
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            print(f"❌ Error mengakses {url}: {e}")
            return None
    
    def save_chapter_html(self, chapter_url, chapter_num):
        """Simpan HTML chapter untuk debugging"""
        debug_dir = self.output_dir / "debug"
        debug_dir.mkdir(exist_ok=True)
        
        response = self.get_page(chapter_url)
        if response:
            html_file = debug_dir / f"chapter_{chapter_num}.html"
            with open(html_file, 'w', encoding='utf-8') as f:
                f.write(response.text)
            print(f"  💾 HTML saved: {html_file}")
            return html_file
        return None
    
    def sanitize_filename(self, filename):
        """Bersihkan nama file dari karakter tidak valid"""
        filename = re.sub(r'[<>:"/\\|?*]', '', filename)
        filename = filename.strip()
        return filename
    
    def get_chapter_list(self):
        """Ambil daftar semua chapter dari halaman series"""
        print(f"📖 Fetching chapter list from: {self.series_url}")
        
        response = self.get_page(self.series_url)
        if not response:
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        chapters = []
        
        chapter_links = soup.select('a[href*="chapter"]')
        
        if not chapter_links:
            chapter_links = soup.select('.chapter-link, .wp-manga-chapter a, li.wp-manga-chapter a')
        
        for link in chapter_links:
            chapter_url = link.get('href')
            chapter_title = link.get_text(strip=True)
            
            if chapter_url:
                chapter_url = urljoin(self.series_url, chapter_url)
                chapters.append({
                    'title': chapter_title,
                    'url': chapter_url
                })
        
        chapters.reverse()
        
        print(f"✅ Found {len(chapters)} chapters")
        return chapters
    
    def get_images_from_chapter(self, chapter_url):
        """Ambil semua URL gambar dari sebuah chapter"""
        print(f"  📄 Opening chapter: {chapter_url}")
        
        response = self.get_page(chapter_url)
        if not response:
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        images = []
        
        img_tags = soup.select('img.wp-manga-chapter-img, .reading-content img, #readerarea img, .page-break img, .chapter-images img')
        
        if not img_tags:
            content_area = soup.select_one('.entry-content, .reading-content, #readerarea, .chapter-content')
            if content_area:
                img_tags = content_area.find_all('img')
        
        for img in img_tags:
            img_url = (img.get('src') or 
                      img.get('data-src') or 
                      img.get('data-lazy-src') or 
                      img.get('data-original') or
                      img.get('data-cfsrc'))
            
            if img_url:
                img_url = img_url.strip()
                
                if not img_url or img_url.startswith('data:') or 'placeholder' in img_url.lower():
                    continue
                
                if ' ' in img_url:
                    parts = img_url.split()
                    for part in reversed(parts):
                        if part.startswith('http') and ('r2d2storage.com' in part or 'cdn' in part or any(ext in part for ext in ['.jpg', '.png', '.webp', '.gif'])):
                            img_url = part
                            break
                    else:
                        for part in reversed(parts):
                            if part.startswith('http'):
                                img_url = part
                                break
                
                if img_url.startswith(chapter_url):
                    img_url = img_url.replace(chapter_url, '').lstrip('/ ')
                    if not img_url.startswith('http'):
                        continue
                
                if img_url.startswith('//'):
                    img_url = 'https:' + img_url
                
                if not img_url.startswith('http'):
                    if self.verbose:
                        print(f"  ⚠️  Skipping invalid URL: {img_url}")
                    continue
                
                images.append(img_url)
                if self.verbose:
                    print(f"  🖼️  Image {len(images)}: {img_url}")
        
        print(f"  ✅ Found {len(images)} images")
        return images
    
    def download_image(self, img_url, save_path, max_retries=3):
        """Download gambar dengan retry dan auto-convert WebP, with speed tracking"""
        for attempt in range(max_retries):
            if self.abort_event.is_set():
                return False
            try:
                headers = self.session.headers.copy()
                headers['Referer'] = self.series_url
                
                time.sleep(self.delay)
                t_start = time.time()
                response = self.session.get(img_url, headers=headers, timeout=30)
                response.raise_for_status()
                
                img_data = response.content
                elapsed = max(time.time() - t_start, 0.001)
                speed_mbps = (len(img_data) / 1024 / 1024) / elapsed
                # Store last speed so download_chapter can read it
                self._last_dl_speed = speed_mbps
                
                if img_url.lower().endswith('.webp') or 'image/webp' in response.headers.get('Content-Type', ''):
                    try:
                        img = Image.open(io.BytesIO(img_data))
                        
                        if img.mode in ('RGBA', 'LA', 'P'):
                            background = Image.new('RGB', img.size, (255, 255, 255))
                            if img.mode == 'P':
                                img = img.convert('RGBA')
                            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                            img = background
                        elif img.mode != 'RGB':
                            img = img.convert('RGB')
                        
                        save_path = save_path.with_suffix('.jpg')
                        img.save(save_path, 'JPEG', quality=95, optimize=True)
                        
                        if self.verbose:
                            print(f"  ✅ Downloaded & converted WebP→JPG: {save_path.name}")
                    except Exception as e:
                        if self.verbose:
                            print(f"  ⚠️  WebP conversion failed: {e}")
                        with open(save_path, 'wb') as f:
                            f.write(img_data)
                else:
                    with open(save_path, 'wb') as f:
                        f.write(img_data)
                    
                    if self.verbose:
                        print(f"  ✅ Downloaded: {save_path.name}")
                
                return True
                
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 404:
                    print(f"  ⚠️  404 Not Found: {img_url}")
                    return False
                elif attempt < max_retries - 1:
                    print(f"  ⚠️  Error (retry {attempt + 1}/{max_retries}): {e}")
                    time.sleep(2 ** attempt)
                else:
                    print(f"  ❌ Failed after {max_retries} retries: {img_url}")
                    return False
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"  ⚠️  Error (retry {attempt + 1}/{max_retries}): {e}")
                    time.sleep(2 ** attempt)
                else:
                    print(f"  ❌ Download failed: {e}")
                    return False
        
        return False
    
    def _download_single_image(self, img_url, save_path):
        """
        Download single image (untuk dipakai di thread pool)
        Wrapper around download_image tanpa time.sleep per image
        """
        # Note: delay sudah dihandle per-thread, bukan per-request
        return self.download_image(img_url, save_path)
    
    def create_cbz(self, chapter_title, image_paths, series_name):
        """Buat file CBZ dari gambar-gambar"""
        safe_title = self.sanitize_filename(f"{series_name} - {chapter_title}")
        cbz_path = self.output_dir / f"{safe_title}.cbz"
        
        print(f"  📦 Creating CBZ: {cbz_path.name}")
        
        try:
            with zipfile.ZipFile(cbz_path, 'w', zipfile.ZIP_STORED) as cbz:
                for img_path in sorted(image_paths):
                    if img_path.exists():
                        cbz.write(img_path, img_path.name)
            
            print(f"  ✅ CBZ created: {cbz_path}")
            return True
        except Exception as e:
            print(f"  ❌ CBZ creation failed: {e}")
            return False
    
    def download_chapter(self, chapter, series_name, chapter_num):
        """Download satu chapter"""
        print(f"\n{'='*60}")
        print(f"📥 Downloading Chapter {chapter_num}: {chapter['title']}")
        print(f"{'='*60}")
        
        if hasattr(self, 'debug_mode') and self.debug_mode:
            self.save_chapter_html(chapter['url'], chapter_num)
        
        image_urls = self.get_images_from_chapter(chapter['url'])
        if not image_urls:
            print("  ⚠️  No images found, skipping...")
            return False
        
        temp_dir = self.output_dir / f"temp_{chapter_num}"
        temp_dir.mkdir(exist_ok=True)
        
        # Prepare download jobs
        download_jobs = []
        for idx, img_url in enumerate(image_urls, 1):
            ext = os.path.splitext(urlparse(img_url).path)[1]
            if not ext or ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                ext = '.jpg'
            
            img_path = temp_dir / f"{idx:04d}{ext}"
            download_jobs.append((idx, img_url, img_path))
        
        # Download images concurrently
        print(f"  Downloading {len(download_jobs)} images with {self.max_download_workers} threads...")
        downloaded_images = []
        self._last_dl_speed = 0.0
        
        with ThreadPoolExecutor(max_workers=self.max_download_workers) as executor:
            future_to_job = {
                executor.submit(self._download_single_image, img_url, img_path): (idx, img_path)
                for idx, img_url, img_path in download_jobs
            }
            
            completed = 0
            for future in as_completed(future_to_job):
                idx, img_path = future_to_job[future]
                completed += 1
                
                try:
                    success = future.result()
                    if success:
                        if not img_path.exists():
                            jpg_path = temp_dir / f"{img_path.stem}.jpg"
                            if jpg_path.exists():
                                img_path = jpg_path
                        if img_path.exists():
                            downloaded_images.append(img_path)
                    
                    if 'download_progress' in self.callbacks:
                        self.callbacks['download_progress'](
                            completed, len(download_jobs),
                            img_path.name, chapter_num,
                            getattr(self, '_last_dl_speed', 0.0)
                        )
                            
                    if not self.verbose:
                        print(f"  Downloaded {completed}/{len(download_jobs)}...", end='\r')
                except Exception as e:
                    print(f"\n  Error downloading image {idx}: {e}")
        
        print(f"  ✅ Downloaded {len(downloaded_images)}/{len(image_urls)} images" + " "*20)
        
        if not downloaded_images:
            return False
        
        # CONCURRENT MODE: Add to worker queue
        if self.concurrent and self.worker:
            job_data = {
                'num': chapter_num,
                'title': chapter['title'],
                'series': series_name,
                'temp_dir': temp_dir,
                'images': downloaded_images
            }
            self.worker.add_job(job_data)
            return True
        
        # SEQUENTIAL MODE: Process immediately
        else:
            return self._process_chapter_sync(chapter['title'], series_name, chapter_num, temp_dir, downloaded_images)
    
    def _process_chapter_sync(self, chapter_title, series_name, chapter_num, temp_dir, images):
        """Process chapter synchronously (non-concurrent mode)"""
        # Upscale with parallel processing
        if self.upscale and images:
            print(f"\n  🎨 Upscaling {len(images)} images with {self.max_upscale_workers} parallel workers...")
            upscaled = 0
            
            with ThreadPoolExecutor(max_workers=self.max_upscale_workers) as executor:
                future_to_img = {
                    executor.submit(self.upscale_image, img_path): img_path
                    for img_path in images
                }
                
                completed = 0
                for future in as_completed(future_to_img):
                    img_path = future_to_img[future]
                    completed += 1
                    try:
                        success = future.result()
                        if success:
                            upscaled += 1
                        
                        if 'upscale_progress' in self.callbacks:
                            self.callbacks['upscale_progress'](completed, len(images), img_path.name, chapter_num)
                            
                        if not self.verbose:
                            print(f"  🔧 Upscaling {completed}/{len(images)}...", end='\r')
                    except Exception as e:
                        print(f"\n  ⚠️  Upscale error: {e}")
            
            print(f"  ✅ Upscaled {upscaled}/{len(images)} images" + " "*20)
            
            images = sorted(temp_dir.glob('*'))
            images = [p for p in images if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.gif', '.webp')]
        
        # Resize
        if self.resize and images:
            print(f"\n  📐 Resizing {len(images)} images...")
            resized = 0
            for idx, img_path in enumerate(images, 1):
                if not self.verbose:
                    print(f"  📐 Resizing {idx}/{len(images)}...", end='\r')
                if self.resize_image(img_path):
                    resized += 1
            print(f"  ✅ Resized {resized}/{len(images)} images" + " "*20)
            
            images = sorted(temp_dir.glob('*'))
            images = [p for p in images if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.gif')]
        
        # Slice
        if self.slice_images and images:
            print(f"\n  ✂️  Slicing {len(images)} images...")
            sliced_images = []
            for idx, img_path in enumerate(images, 1):
                if not self.verbose:
                    print(f"  ✂️  Slicing {idx}/{len(images)}...", end='\r')
                result = self.slice_image(img_path)
                sliced_images.extend(result)
            images = sorted(sliced_images)
            print(f"  ✅ Total {len(images)} images after slicing" + " "*20)
        
        # Create CBZ
        if images:
            success = self.create_cbz(chapter_title, images, series_name)
            
            # Cleanup
            for img_path in images:
                try:
                    img_path.unlink()
                except:
                    pass
            try:
                temp_dir.rmdir()
            except:
                pass
            
            return success
        
        return False
    
    def download_series(self, series_name=None, start_chapter=1, end_chapter=None):
        """Download seluruh series with concurrent processing"""
        print("\n" + "="*60)
        print("🚀 HIPERDEX SCRAPER - CONCURRENT EDITION")
        if self.concurrent:
            print("⚡ Concurrent mode: ENABLED")
        print("="*60)
        
        chapters = self.get_chapter_list()
        if not chapters:
            print("❌ No chapters found!")
            return
        
        if not series_name:
            series_name = urlparse(self.series_url).path.strip('/').split('/')[-1].replace('-', ' ').title()
        
        print(f"📚 Series: {series_name}")
        
        if end_chapter is None:
            end_chapter = len(chapters)
        
        chapters_to_download = chapters[start_chapter-1:end_chapter]
        
        print(f"📊 Downloading {len(chapters_to_download)} chapters (Chapter {start_chapter} - {end_chapter})")
        print()
        
        # Start worker if concurrent
        if self.concurrent and self.worker:
            self.worker.start()
        
        # Download all chapters
        success_count = 0
        for idx, chapter in enumerate(chapters_to_download, start_chapter):
            if self.abort_event.is_set():
                print("\nAbort signal received — stopping.")
                break
            if self.download_chapter(chapter, series_name, idx):
                success_count += 1
        
        # Wait for worker to finish all jobs
        if self.concurrent and self.worker:
            print("\n⏳ Waiting for upscale worker to finish...")
            self.worker.wait_completion()
            self.worker.stop()
        
        # Summary
        print("\n" + "="*60)
        print(f"✅ COMPLETED!")
        print(f"📊 Success: {success_count}/{len(chapters_to_download)} chapters")
        print(f"📁 Location: {self.output_dir.absolute()}")
        print("="*60)


def main():
    parser = argparse.ArgumentParser(
        description='Hiperdex Scraper with Concurrent Download + Upscale',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic download
  python hiperdex_scraper.py "https://hiperdex.com/manga/title/"
  
  # Concurrent download + upscale (RECOMMENDED!)
  python hiperdex_scraper.py "URL" --upscale --resize --resize-width 2000
  
  # Sequential mode (disable concurrent)
  python hiperdex_scraper.py "URL" --upscale --no-concurrent
        """
    )
    
    parser.add_argument('url', help='URL halaman series manga')
    parser.add_argument('-o', '--output', default='downloads', help='Output directory')
    parser.add_argument('-n', '--name', help='Series name (auto-detect if not specified)')
    parser.add_argument('-s', '--start', type=int, default=1, help='Start chapter')
    parser.add_argument('-e', '--end', type=int, help='End chapter (default: all)')
    parser.add_argument('-d', '--delay', type=float, default=1.0, help='Delay between requests (seconds)')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    parser.add_argument('--debug-html', action='store_true', help='Save chapter HTML for debugging')
    
    # Upscale options
    parser.add_argument('--upscale', action='store_true', help='Enable upscaling with waifu2x')
    parser.add_argument('--upscale-ratio', type=int, default=2, choices=[1, 2, 4, 8, 16, 32], 
                       help='Upscale ratio (default: 2)')
    parser.add_argument('--denoise', type=int, default=1, choices=[-1, 0, 1, 2, 3],
                       help='Denoise level (default: 1)')
    parser.add_argument('--waifu2x-path', help='Path to waifu2x executable')
    
    # Resize options
    parser.add_argument('--resize', action='store_true', help='Enable resize after upscale')
    parser.add_argument('--resize-width', type=int, default=1600, help='Max width (default: 1600px)')
    parser.add_argument('--resize-quality', type=int, default=95, help='JPEG quality (default: 95)')
    
    # Slice options
    parser.add_argument('--slice', action='store_true', help='Slice long images')
    parser.add_argument('--slice-height', type=int, default=2400, help='Height per slice (default: 2400px)')
    
    # Concurrent control
    parser.add_argument('--no-concurrent', action='store_true', help='Disable concurrent processing')
    parser.add_argument('--max-workers', type=int, default=5, 
                       help='Number of parallel download threads (default: 5, max recommended: 10)')
    parser.add_argument('--upscale-workers', type=int, default=3,
                       help='Number of parallel upscale processes (default: 3). '
                            'Recommended: 1-3 for 8GB VRAM, 3-5 for 12GB VRAM, 5-10 for 16GB+ VRAM')
    
    args = parser.parse_args()
    
    if not args.url.startswith('http'):
        print("❌ URL must start with http:// or https://")
        return
    
    scraper = HiperdexScraper(
        series_url=args.url,
        output_dir=args.output,
        delay=args.delay,
        verbose=args.verbose,
        upscale=args.upscale,
        upscale_ratio=args.upscale_ratio,
        denoise_level=args.denoise,
        waifu2x_path=args.waifu2x_path,
        resize=args.resize,
        resize_width=args.resize_width,
        resize_quality=args.resize_quality,
        slice_images=args.slice,
        slice_height=args.slice_height,
        concurrent=not args.no_concurrent,
        max_download_workers=args.max_workers,
        max_upscale_workers=args.upscale_workers
    )
    
    if args.debug_html:
        print("\n🔍 DEBUG MODE: Will save HTML for analysis...")
        scraper.debug_mode = True
    
    scraper.download_series(
        series_name=args.name,
        start_chapter=args.start,
        end_chapter=args.end
    )


if __name__ == "__main__":
    main()