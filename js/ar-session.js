/**
 * ar-session.js
 * Main AR controller for ar-viewer.html.
 * Orchestrates camera, Three.js, hit-test, face tracking, and paint overlay.
 */

(async function () {

  /* ── Parse URL params & Tracking Setup ───────────────────── */
  const params    = new URLSearchParams(location.search);
  const productId = params.get('product') || 'sofa';
  const modeParam = params.get('mode')    || 'furniture';
  const product   = ProductLoader.getById(productId) || ProductLoader.CATALOG[0];

  const dbIdMap = {
    'sofa': 1, 'chair': 2, 'table': 3, 'sidetable': 4,
    'sunglasses1': 5, 'sunglasses2': 6, 'watch1': 7, 'watch2': 8,
    'paint-peach': 9, 'paint-sky': 10, 'paint-mint': 11, 'paint-lav': 12
  };
  const productDbId = dbIdMap[productId] || 1;
  const startTime   = Date.now();
  let arConverted   = false;

  /* ── DOM refs ───────────────────────────────────────────── */
  const videoEl     = document.getElementById('camera-feed');
  const arCanvas    = document.getElementById('ar-canvas');
  const loaderBar   = document.getElementById('loader-bar');
  const loaderText  = document.getElementById('loader-text');
  const loadScreen  = document.getElementById('loading-screen');

  /* ── Loading helper ─────────────────────────────────────── */
  function setLoad(pct, msg) {
    loaderBar.style.width = pct + '%';
    loaderText.textContent = msg;
  }

  /* ── Init Three.js scene ────────────────────────────────── */
  setLoad(20, 'Setting up 3D scene…');
  const { renderer, scene, camera } = SceneManager.createARScene(arCanvas);

  /* ── Hit test system ────────────────────────────────────── */
  setLoad(40, 'Preparing surface detection…');
  const hitTest = HitTest.create(scene, camera, renderer);

  /* ── Camera setup ───────────────────────────────────────── */
  setLoad(60, 'Requesting camera…');
  let stream = null;
  let facingMode = 'environment';

  async function startCamera(mode = 'environment') {
    if (stream) { stream.getTracks().forEach(t => t.stop()); }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      facingMode = mode;
    } catch (err) {
      console.warn('Camera error:', err);
      UIController.showToast('⚠️ Camera access denied — using demo mode', 'info', 4000);
    }
  }

  UIController.onFlip = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    videoEl.style.transform = next === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    await startCamera(next);
  };

  await startCamera(modeParam === 'accessories' ? 'user' : 'environment');

  /* ── Product model ──────────────────────────────────────── */
  setLoad(75, 'Loading product…');
  UIController.setProductInfo(product.name, product.price);

  let placedModel = null;
  let isPlaced    = false;

  function buildModel() {
    if (placedModel) { scene.remove(placedModel); }
    placedModel = product.factory();
    placedModel.visible = false;

    // Enable shadows on all meshes
    placedModel.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow    = true;
        obj.receiveShadow = true;
      }
    });

    // Normalize scale
    const box = new THREE.Box3().setFromObject(placedModel);
    const sz  = new THREE.Vector3();
    box.getSize(sz);
    const maxD = Math.max(sz.x, sz.y, sz.z);
    placedModel.scale.setScalar(0.8 / maxD);

    scene.add(placedModel);
    return placedModel;
  }

  buildModel();

  /* ── Furniture controls ─────────────────────────────────── */
  let userScale    = 1;
  let userRotation = 0;

  UIController.onScale  = v => { userScale = v;    if (placedModel) placedModel.scale.setScalar((0.8 / 1) * v); };
  UIController.onRotate = v => { userRotation = v; if (placedModel) placedModel.rotation.y = v; };
  UIController.onPlace  = () => {
    const pos = hitTest.getHitPosition();
    if (pos && placedModel) {
      placedModel.position.copy(pos);
      placedModel.visible = true;
      isPlaced = true;
      arConverted = true; // Mark as converted
      document.getElementById('placed-ring').style.display = 'block';
      setTimeout(() => { document.getElementById('placed-ring').style.display = 'none'; }, 3000);
      hitTest.showReticle(false);
    }
  };
  UIController.onRemove = () => {
    if (placedModel) { placedModel.visible = false; isPlaced = false; }
    hitTest.showReticle(true);
  };

  /* ── Accessory try-on (face overlay) ────────────────────── */
  let accModel    = null;
  let accScale    = 1;
  let currentAcc  = product.category === 'accessories' ? productId : 'sunglasses1';

  const faceMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, visible: false })
  );

  function buildAccModel(id) {
    if (accModel) scene.remove(accModel);
    const def = ProductLoader.getById(id);
    if (!def) return;
    accModel = def.factory();
    accModel.traverse(obj => { if (obj.isMesh) obj.castShadow = true; });
    scene.add(accModel);
    UIController.setProductInfo(def.name, def.price);
  }
  buildAccModel(currentAcc);

  UIController.onAccChange = id => { currentAcc = id; buildAccModel(id); arConverted = true; };
  UIController.onAccSize   = v  => { accScale   = v; };

  /* Face tracking state */
  let faceX = 0, faceY = 0, faceW = 0;
  let faceDetected = false;

  // Lightweight face detection using canvas pixel analysis
  // (full TF.js is ~2MB; we use a simpler heuristic for demo)
  const faceCanvas = document.createElement('canvas');
  const faceCtx    = faceCanvas.getContext('2d', { willReadFrequently: true });

  function detectFace() {
    if (!videoEl.videoWidth) return;
    const scale = 0.15;
    faceCanvas.width  = videoEl.videoWidth  * scale;
    faceCanvas.height = videoEl.videoHeight * scale;
    faceCtx.drawImage(videoEl, 0, 0, faceCanvas.width, faceCanvas.height);

    // Skin tone detection (rough heuristic)
    const data = faceCtx.getImageData(
      faceCanvas.width * 0.2, faceCanvas.height * 0.1,
      faceCanvas.width * 0.6, faceCanvas.height * 0.6
    ).data;

    let skinPx = 0, totalPx = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      if (r > 80 && g > 50 && b > 30 && r > g && g > b && r - b > 20) skinPx++;
    }

    faceDetected = (skinPx / totalPx) > 0.15;
    if (!faceDetected) return;

    // Estimate face center in normalized screen coords
    faceX = 0.5; faceY = 0.35; faceW = 0.3; // centered rough estimate
  }

  /* ── Paint overlay ──────────────────────────────────────── */
  let paintColor   = UIController.getPaintColor();
  let paintOpacity = UIController.getPaintOpacity();
  let paintEnabled = true;
  let showingBefore = false;

  UIController.onColorChange   = c => { paintColor   = c; arConverted = true; };
  UIController.onOpacityChange = v => { paintOpacity = v; };
  UIController.onBeforeAfter   = before => { showingBefore = before; };
  UIController.onClearPaint    = () => { paintEnabled = false; };

  /* Paint canvas (drawn over video) */
  const paintCanvas = document.createElement('canvas');
  const paintCtx    = paintCanvas.getContext('2d');

  function drawPaintOverlay() {
    if (!videoEl.videoWidth) return;
    paintCanvas.width  = videoEl.videoWidth;
    paintCanvas.height = videoEl.videoHeight;

    if (showingBefore || !paintEnabled) return;

    // Fill upper 65% of frame (wall region)
    const hex = paintColor;
    const r   = parseInt(hex.slice(1,3),16);
    const g   = parseInt(hex.slice(3,5),16);
    const b   = parseInt(hex.slice(5,7),16);

    paintCtx.fillStyle = `rgba(${r},${g},${b},${paintOpacity})`;
    paintCtx.fillRect(0, 0, paintCanvas.width, paintCanvas.height * 0.65);
  }

  /* ── Mode change ────────────────────────────────────────── */
  UIController.onModeChange = mode => {
    hitTest.showReticle(mode === 'furniture');
    if (mode === 'furniture') {
      placedModel = buildModel();
      startCamera('environment');
    }
    if (mode === 'accessories') {
      startCamera('user');
      hitTest.showReticle(false);
    }
    if (mode === 'paint') {
      startCamera('environment');
      hitTest.showReticle(false);
      paintEnabled = true;
    }
  };

  // Initialise mode from URL param
  UIController.switchMode(modeParam === 'accessories' ? 'accessories' : modeParam === 'paint' ? 'paint' : 'furniture');

  /* ── Camera tap → place ─────────────────────────────────── */
  arCanvas.addEventListener('click', e => {
    if (UIController.getMode() !== 'furniture') return;
    const pos = hitTest.getHitPosition();
    if (pos && placedModel) {
      placedModel.position.copy(pos);
      placedModel.visible = true;
      isPlaced = true;
      hitTest.showReticle(false);
      UIController.showToast('📌 Product placed! Use sliders to adjust.', 'success');
      document.getElementById('placed-ring').style.display = 'block';
      setTimeout(() => { document.getElementById('placed-ring').style.display = 'none'; }, 2500);
    }
  });

  /* ── Screenshot ─────────────────────────────────────────── */
  UIController.btnScreenshot.addEventListener('click', () => {
    UIController.takeScreenshot(arCanvas, videoEl);
  });

  /* ── Main render loop ───────────────────────────────────── */
  setLoad(95, 'Almost ready…');
  let lastTime = 0;
  let faceFrame = 0;

  function animate(now = 0) {
    requestAnimationFrame(animate);
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    const mode = UIController.getMode();

    /* ── Furniture mode ── */
    if (mode === 'furniture') {
      hitTest.update(delta);

      // Ghost preview before placement
      if (!isPlaced && placedModel) {
        const pos = hitTest.getHitPosition();
        if (pos) {
          placedModel.position.copy(pos);
          placedModel.visible = true;
          placedModel.traverse(obj => {
            if (obj.isMesh && obj.material) {
              obj.material.transparent = true;
              obj.material.opacity     = 0.65;
            }
          });
        }
      } else if (isPlaced && placedModel) {
        placedModel.traverse(obj => {
          if (obj.isMesh && obj.material) {
            obj.material.transparent = false;
            obj.material.opacity     = 1;
          }
        });
      }
    }

    /* ── Accessories mode ── */
    if (mode === 'accessories') {
      faceFrame++;
      if (faceFrame % 8 === 0) detectFace(); // detect every 8 frames

      if (accModel) {
        if (faceDetected) {
          // Project normalized face coords to 3D camera space
          const aspect = camera.aspect;
          const fovRad = camera.fov * Math.PI / 180;
          const dist   = 1.5;

          const nx = (faceX - 0.5) * 2;
          const ny = -(faceY - 0.5) * 2;
          const halfH = Math.tan(fovRad / 2) * dist;
          const halfW = halfH * aspect;

          accModel.position.set(nx * halfW, ny * halfH + 0.05, camera.position.z - dist);
          const s = faceW * halfW * 2 * accScale;
          accModel.scale.setScalar(s);
          accModel.visible = true;

          // Subtle head sway simulation
          accModel.rotation.z = Math.sin(now * 0.0005) * 0.04;
        } else {
          // Center the model when no face detected (demo mode)
          accModel.position.set(0, 0.1, camera.position.z - 1.5);
          accModel.scale.setScalar(0.35 * accScale);
          accModel.visible = true;
          accModel.rotation.y = now * 0.0008;
        }
      }
    }

    /* ── Paint mode ── */
    if (mode === 'paint') {
      drawPaintOverlay();
    }

    renderer.render(scene, camera);
  }

  /* ── Save session on exit ───────────────────────────────── */
  let sessionSaved = false;
  async function saveSession() {
    if (sessionSaved) return;
    sessionSaved = true;

    if (!window.API) return;
    const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const device = navigator.userAgent.includes('Mobile') ? 'Mobile Web' : 'Desktop Web';
    
    try {
      // Send beacon or synchronous post if supported, otherwise normal post
      if (navigator.sendBeacon && window.API.getToken()) {
        const payload = JSON.stringify({
          product_id: productDbId,
          mode: modeParam,
          duration_sec: duration,
          device: device,
          converted: arConverted
        });
        const beaconUrl = window.location.protocol === 'file:'
          ? 'http://localhost:5000/api/ar-sessions'
          : window.location.origin + '/api/ar-sessions';
        navigator.sendBeacon(beaconUrl, blob);
      } else {
        await API.logARSession(productDbId, modeParam, duration, device, arConverted);
      }
      console.log('Logged AR session stats successfully.');
    } catch (err) {
      console.warn('Could not log session:', err);
    }
  }

  window.addEventListener('beforeunload', saveSession);
  window.addEventListener('pagehide', saveSession);

  // Expose exit action to save stats on exit button tap
  const exitBtn = document.getElementById('btn-exit');
  if (exitBtn) {
    exitBtn.addEventListener('click', (e) => {
      saveSession();
    });
  }

  /* ── Finish loading ─────────────────────────────────────── */
  setLoad(100, 'Ready!');
  setTimeout(() => {
    loadScreen.classList.add('hidden');
    setTimeout(() => { loadScreen.style.display = 'none'; }, 500);
    UIController.showToast('🔮 AR Viewer ready!', 'success', 2000);
    animate();
  }, 700);

})();
