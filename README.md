<div align="center">
  <img src="Logo_Kōdo_500-01.png" alt="Kodo Logo" width="200" height="200" />
  
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
  <b>Kōdo</b> is a modern desktop application built to be your ultimate local manga and manhwa companion. With a beautifully crafted UI, seamless metadata caching, dynamic pathing, and built-in AI upscaling directly on your machine, it delivers a premium reading experience without relying on cloud services for your local files.
</p>

## ✨ Highlights & Features

### 📚 Intelligent Library Management
- **Lightning-Fast Cold Starts**: Reads instantly from lightweight `meta.json` caching while smoothly refreshing true library data asynchronously in the background. No more staring at endless loading spinners.
- **Dynamic File Pathing**: Your series don't need to live in one rigid folder. Kodo maps locally stored manga/manhwa from **anywhere** on your PC seamlessly. 
- **Version Control**: Keep multiple versions (raws, different scanlations, upscaled variants) of the same series grouped neatly.

### 🤖 Built-in AI Upscaling & Compression
- **Waifu2x & RealESRGAN Integration**: Supercharge low-resolution scans natively.
- **Auto-Detection Model Pipeline**: Automatically detects your AI executables inside the `AppData/kodo/packages/upscale_package` paths without messy manual configuration.
- **Direct Model Download**: Instantly fetch the necessary AI models via configured R2 Cloudflare buckets directly from the app Settings page with full progress tracking.

### 📖 Premium Reading Experience
- **Sleek, Modern UI**: Enjoy an aesthetic, responsive React interface styled with seamless themes.
- **Read Progress Tracking**: Resume exactly where you left off. Kodo remembers your read progress per series and per version.
- **Auto-Extraction**: Reads directly from CBZ/ZIP archives or nested directory structures natively.

---

## 📸 Screenshots

*(Replace the placeholder URLs with actual screenshots of your app once available!)*

<details markdown="1">
  <summary><b>🖼️ Expand to View Screenshots</b></summary>
  <br/>

| Library View | Advanced AI Upscaler |
| :---: | :---: |
| <img src="https://via.placeholder.com/600x400.png?text=Library+View" alt="Library" /> | <img src="https://via.placeholder.com/600x400.png?text=AI+Upscaler+Settings" alt="Upscaler" /> |
| **Reader Interface** | **Settings & Metadata** |
| <img src="https://via.placeholder.com/600x400.png?text=Reader+Interface" alt="Reader" /> | <img src="https://via.placeholder.com/600x400.png?text=Settings+Menu" alt="Settings" /> |

</details>

---

## 🛠️ Tech Stack

Kōdo utilizes a highly-performant trifecta:
- **[Tauri](https://tauri.app/) (Rust)** - Core application shell offering system-level access and minimum RAM footprint.
- **React.js** - Driving a beautiful, seamless, client-side rendered UI.
- **Node.js/Express** - Working as a robust internal backend server for heavy I/O handling, metadata construction, and AI pipeline orchestration.

## 🚀 Getting Started

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
