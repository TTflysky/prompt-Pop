# Prompt Pop!

Prompt Pop! is a comic-inspired AI prompt workbench for Android, Windows, and browsers. It keeps provider settings on the device, supports separate text, vision, and image models, and is built for turning rough ideas and reference images into reusable prompts and generated images.

## Downloads

- **Android:** `PromptPop-v1.2.33.apk`
  - Install over an existing Prompt Pop installation to keep local settings and history.
  - This APK adds reliable Android system clipboard support for error logs and all prompt-copy actions.
- **Windows:** `release/Prompt-Pop-Windows-v1.2.36.zip`
  - Extract it and run `Prompt Pop 1.2.36.exe`. No installation is required.

## Main Features

### Prompt Studio

- Rewrite rough ideas into structured prompts.
- Preset modes for professional, creative, role-play, step-by-step, and image prompting.
- Copy optimized prompts or send them into image-generation workflows.

### Image Studio

- Text-to-image generation with optional prompt optimization.
- Image-to-image generation with one or more numbered reference images.
- Album selection and camera capture on Android.
- Image size, aspect ratio, lens, angle, visual style, and generation-strength controls.
- Separate controls for pose/clothing/action change and style/scene change.
- Image preview, frame presets, download/save controls, and generated-image history.

### Visual Style Breakdown

- Upload an image and use a vision model to extract reusable style prompts.
- Focuses on visual language, palette, lighting, composition, materials, and print/film texture rather than locking the original subject into later generations.
- Send the extracted style prompt directly to text-to-image or image-to-image, then edit it before generation.

### Model Settings

- Independent local configuration for:
  - Text optimization model
  - Vision analysis model
  - Image generation model
- Supports common OpenAI-compatible endpoints, GPT endpoints, and custom providers.
- Fetch available model names from the configured endpoint to reduce typing errors.
- API keys and model choices remain on the current device; they are not committed to this repository.

### Local Data and Updates

- Settings, working prompts, reference images, and generation state are retained locally where the platform allows.
- Export/import configuration as a TXT file for moving personal settings between Android and Windows. Treat exported files as private because they can include API keys.
- Android includes a settings-page hot-update workflow for web UI updates. Native Android capabilities such as the system clipboard require a new APK once, then later web updates can continue through the in-app updater.
- Generation completion can be surfaced through Android notifications, and generated results are preserved for later viewing/saving when background work is supported by the device.

### Desktop Convenience

- Drag images from other Windows applications directly onto image-to-image and style-breakdown upload areas.
- Desktop and Android share the same TXT configuration format.

## Quick Start

1. Open **Settings** and add the endpoint, API key, and model for the workflow you want to use.
2. Use **Fetch models** when the provider offers an OpenAI-compatible model list.
3. Choose **Prompt Studio**, **Image Studio**, or **Style Breakdown** from the tabs.
4. Generate, copy, save, or send the result into the next workflow.

## Local Browser Use

Open `index.html` in a modern browser. Browser file access, clipboard support, background generation, and saving behavior depend on that browser; the Android and Windows wrappers provide the fuller device integration.

## Development

- `apk-build/` contains the Android WebView wrapper and bundled web assets.
- The Windows portable build is produced with `npm.cmd run build:win` and written under `release/`.
- Keep generated APKs and release archives out of source edits unless publishing a new version.

## Privacy

Prompt Pop! stores your provider configuration locally. Requests, images, and prompts are sent only to the endpoint you configure. Do not share exported configuration files or API keys.
