/**
 * scene-manager.js
 * Three.js scene, renderer, camera, and lighting setup.
 * Used by both the landing page hero and the AR viewer.
 */

window.SceneManager = (function () {

  /* ── Create a self-contained scene for a canvas ─────────── */
  function createScene(canvas, opts = {}) {
    const {
      alpha = false,
      antialias = true,
      bg = 0x080c14,
      width, height,
      pixelRatio = Math.min(window.devicePixelRatio, 2)
    } = opts;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha, antialias });
    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.SRGBColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    if (!alpha) renderer.setClearColor(bg);
    else renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    camera.position.set(0, 2, 3.5);
    camera.lookAt(0, 0.3, 0);

    /* ── Lights ─────────────────────────────────────────── */
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(3, 6, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 20;
    dirLight.shadow.camera.left = -4;
    dirLight.shadow.camera.right = 4;
    dirLight.shadow.camera.top = 4;
    dirLight.shadow.camera.bottom = -4;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x6c63ff, 0.5);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x22d3ee, 0.8, 10);
    rimLight.position.set(2, 3, -2);
    scene.add(rimLight);

    /* ── Floor grid (subtle) ────────────────────────────── */
    const gridHelper = new THREE.GridHelper(10, 20, 0x6c63ff, 0x1a1a2e);
    gridHelper.material.opacity = 0.25;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    function resize(w, h) {
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    if (width && height) resize(width, height);

    return { renderer, scene, camera, resize, dirLight, ambient };
  }

  /* ── Hero rotating scene ─────────────────────────────── */
  function initHeroScene(canvasEl) {
    const size = Math.min(480, window.innerWidth * 0.9);
    const { renderer, scene, camera, resize } = createScene(canvasEl, { bg: 0x0d1322 });
    resize(size, size);

    // Rotating product showcase
    const showcase = new THREE.Group();
    scene.add(showcase);

    // Central sofa
    const sofa = ProductLoader.makeSofa('#6c63ff');
    sofa.position.set(0, 0, 0);
    sofa.scale.set(0.55, 0.55, 0.55);
    showcase.add(sofa);

    // Floating particles
    const particles = [];
    for (let i = 0; i < 40; i++) {
      const geo = new THREE.SphereGeometry(0.02 + Math.random() * 0.03, 6, 6);
      const color = [0x6c63ff, 0xa78bfa, 0x22d3ee, 0xf472b6][Math.floor(Math.random() * 4)];
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 }));
      const r = 1.5 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      mesh.position.set(
        r * Math.cos(theta) * Math.cos(phi),
        r * Math.sin(phi) + 0.5,
        r * Math.sin(theta) * Math.cos(phi)
      );
      mesh.userData.speed = 0.3 + Math.random() * 0.7;
      mesh.userData.offset = Math.random() * Math.PI * 2;
      showcase.add(mesh);
      particles.push(mesh);
    }

    // Glowing ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.015, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0x6c63ff, emissive: 0x6c63ff, emissiveIntensity: 1.5, transparent: true, opacity: 0.5 })
    );
    ring.rotation.x = Math.PI / 2;
    showcase.add(ring);

    camera.position.set(0, 1.8, 3.0);
    camera.lookAt(0, 0.4, 0);

    let frame;
    function animate(t = 0) {
      frame = requestAnimationFrame(animate);
      showcase.rotation.y = t * 0.0004;
      sofa.rotation.y = -t * 0.0004;

      particles.forEach(p => {
        p.position.y += Math.sin(t * 0.001 * p.userData.speed + p.userData.offset) * 0.003;
        p.material.emissiveIntensity = 0.5 + 0.5 * Math.sin(t * 0.002 + p.userData.offset);
      });

      ring.material.opacity = 0.3 + 0.2 * Math.sin(t * 0.001);

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      const s = Math.min(480, window.innerWidth * 0.9);
      resize(s, s);
    });

    return { stop: () => cancelAnimationFrame(frame) };
  }

  /* ── Mini card scene ─────────────────────────────────── */
  function initCardScene(canvasEl, productId) {
    const product = ProductLoader.getById(productId);
    if (!product) return;

    const { renderer, scene, camera, resize } = createScene(canvasEl, {
      bg: 0x111827, antialias: false, pixelRatio: 1
    });
    resize(canvasEl.parentElement.clientWidth || 300, 200);

    const model = product.factory();
    // Scale & center model for card preview
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    model.scale.multiplyScalar(0.9 / maxDim);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center.multiplyScalar(0.9 / maxDim));
    model.position.y += 0.05;
    scene.add(model);

    camera.position.set(0.4, 0.8, 1.4);
    camera.lookAt(0, 0, 0);

    let frame;
    function animate(t = 0) {
      frame = requestAnimationFrame(animate);
      model.rotation.y = t * 0.001;
      renderer.render(scene, camera);
    }
    animate();

    return { stop: () => cancelAnimationFrame(frame), renderer };
  }

  /* ── AR overlay scene (transparent bg) ──────────────── */
  function createARScene(canvasEl) {
    const { renderer, scene, camera, resize } = createScene(canvasEl, {
      alpha: true, antialias: true, pixelRatio: Math.min(window.devicePixelRatio, 2)
    });

    // Remove grid for AR mode
    scene.children.filter(c => c.isGridHelper).forEach(g => scene.remove(g));

    // Semi-transparent ground plane (shadow catcher)
    const shadowGeo = new THREE.PlaneGeometry(10, 10);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    resize(window.innerWidth, window.innerHeight);

    // AR camera — wide FOV
    camera.fov = 60;
    camera.near = 0.01;
    camera.far = 100;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    camera.position.set(0, 1.5, 3);

    window.addEventListener('resize', () => {
      resize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });

    return { renderer, scene, camera, resize };
  }

  return { createScene, initHeroScene, initCardScene, createARScene };
})();
