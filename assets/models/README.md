# ARViz Custom 3D Models Directory

This directory is reserved for your high-fidelity, custom **glTF (.gltf)** or **GLB (.glb)** 3D assets.

## How it Works
The frontend is powered by a **Triple-Fallback Asynchronous Loader** in `js/product-loader.js` that loads assets automatically:
1. **Local Default Path**: It checks this `assets/models/` folder for a model file named `<model_id>.glb` (e.g., `sofa.glb`, `chair.glb`, `watch1.glb`).
2. **Public CDN Failover**: If the local file is missing, it falls back to a remote public CDN (e.g. Khronos Group official glTF sample models).
3. **Procedural Fallback**: If offline or if the CDN fails, it falls back to a beautiful, glassmorphic procedural Three.js geometry.

## Naming Convention
To display custom models, place your `.glb` or `.gltf` files in this directory using the following filenames:

* **Sofa**: `sofa.glb`
* **Accent Chair**: `chair.glb`
* **Dining Table**: `table.glb`
* **Bedside/Side Table**: `sidetable.glb`
* **Aviator Sunglasses**: `sunglasses1.glb`
* **Wayfarer Sunglasses**: `sunglasses2.glb`
* **Classic Watch**: `watch1.glb`
* **Sport Watch**: `watch2.glb`

## 3D Asset Guidelines
* **File Format**: `.glb` (GLTFLoader Binary) is highly recommended for faster load times and self-contained materials/textures.
* **Optimization**: Keep polygon counts below **50,000 triangles** and textures below **1024x1024** for smooth mobile/WebXR AR rendering.
* **Scale**: Models are automatically centered and scaled to standard normalized dimensions in the canvas viewer, so standard scale alignment is fully automated.
