<div align="center">
  <img src="/assets/Screenshot/Library.png" alt="Kōdo Library" />
  
  # Kōdo Reader
  
  **A Lightning-Fast, Feature-Rich Local Manga & Manhwa Reader with Built-in AI Upscaling.**

  [![Tauri](https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app/)
  [![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
  [![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](#)
</div>

---

<p align="center">
  <br>
  <b>Kōdo</b> is a desktop reader for local manga and manhwa. It includes a modern UI, fast metadata caching, flexible library paths, and built-in AI upscaling that runs locally on your machine.
</p>

## Features

- [x] Modern UI
- [x] Fast library loading with metadata caching
- [x] Flexible library paths
- [x] Multiple versions support (raws, scanlations, upscaled)
- [x] Built-in AI upscaling (Waifu2x / RealESRGAN)
- [x] Built-in Series CBZ Compressor (Sharp + MozJepg)
- [x] Advanced bookmarks with screenshot previews
- [x] Smart backups with password encryption and custom .kdba format
- [x] Chapter rename
- [x] Categories for organizing series
- [x] Reading progress tracking
- [x] CBZ / ZIP archive support
- [ ] PDF support (soon)

## Highlights & Features

### Intelligent Library Management

- **Fast Library Loading**  
  Uses lightweight `meta.json` caching so the library appears instantly while the real data refreshes in the background.
- **Flexible Library Paths**  
  Your series don't need to live in a single folder. Kōdo can map manga or manhwa stored anywhere on your PC.
- **Multiple Versions Support**  
  Keep different versions of the same series (raws, scanlations, upscaled versions) grouped together.

### Built-in AI Upscaling

- **Waifu2x & RealESRGAN Support**  
  Upscale low-resolution manga images using Waifu2x or RealESRGAN directly on your machine.
- **Automatic Model Detection**  
  Kōdo automatically detects installed AI executables inside  
  `AppData/kodo/packages/upscale_package`.
- **Model Download from the App**  
  Required models can be downloaded directly from the Settings page with progress tracking.

### Reading Experience

- **Modern UI**  
  A clean and responsive interface built with React.
- **Reading Progress Tracking**  
  Kōdo remembers where you left off for each series and version.
- **Archive Support**  
  Read directly from `.cbz`, `.zip`, or regular folder structures without manual extraction.

---

## Screenshots

<details markdown="1">
  <summary><b> Expand to View Screenshots</b></summary>
  <br/>

| Library View | Advanced AI Upscaler |
| :---: | :---: |
| <img src="/assets/Screenshot/Reader UI.png" alt="Kōdo Reader" /> | <img src="/assets/Screenshot/AI Upscaler Section.png" alt="AI Upscaling" /> |
| **Reader Interface** | **Settings & Metadata** |
| <img src="/assets/Screenshot/Series Compressor Section.png" alt="Compressor" /> | <img src="/assets/Screenshot/Chapter Renamer.png" alt="Chapter Renamer" /> |

</details>

---

## 🛠️ Tech Stack

Kōdo utilizes a highly-performant trifecta:
- **[Tauri](https://tauri.app/) (Rust)** - Core application shell offering system-level access and minimum RAM footprint.
- **React.js** - Driving a beautiful, seamless, client-side rendered UI.
- **Node.js/Express** - Working as a robust internal backend server for heavy I/O handling, metadata construction, and AI pipeline orchestration.

## Getting Started

Follow these steps to clone and build the application locally.

### Prerequisites
- Node.js (v18+)
- Rust & Cargo
- Tauri Prerequisites (Visual Studio C++ Build Tools on Windows)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ToastyyyBread/KodoReader.git
   cd KodoReader
   ```

2. **Install Frontend & Server Dependencies**
   ```bash
   npm run build:client
   ```
   *This command jumps into the `client` folder, installs dependencies, and builds the UI.*

3. **Run Development Server**
   ```bash
   # Terminal 1 - Start the backend server
   npm run dev:server
   
   # Terminal 2 - Start the Tauri App bundle
   npm run dev
   ```

4. **Production Build**
   ```bash
   npm run build
   ```
   *The distributable executable will be generated inside `src-tauri/target/release/`.*

---

## 💡 About & Contributions

This project handles rigorous filesystem caching and spawned child processes for AI execution natively on Windows.

Feel free to open an **Issue** if you spot a bug (like the library race conditions we've conquered!) or submit a **Pull Request** if you have aesthetic improvements, logic optimizations, or new features.

<p align="center">Made with ❤️ for Manga Readers.</p>
