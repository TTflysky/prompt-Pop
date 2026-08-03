# Prompt Pop!

Prompt Pop! is a comic-inspired prompt workbench for three separate AI workflows:

- Text prompt optimization
- Image prompt generation, text-to-image, and image-to-image
- Reference-image visual breakdown and reusable prompt extraction

## Local use

Open `index.html` in a browser.

## Android build

The native Android WebView wrapper is under `apk-build/`. It enables image selection through the system picker and loads the app from bundled web assets.

## API configuration

The settings screen stores three independent local configurations:

- Text optimization model
- Vision analysis model
- Image generation model

API credentials remain in browser local storage on the device and are not included in this repository.
