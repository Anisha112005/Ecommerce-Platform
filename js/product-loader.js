/**
 * product-loader.js
 * Procedural 3D product generators + dynamic GLTF/GLB asset loading using Three.js GLTFLoader.
 */

window.ProductLoader = (function () {

  /* ── Shared materials ─────────────────────────────────────── */
  function mat(color, rough = 0.6, metal = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  }
  function glassMat(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 });
  }

  /* ── Triple-Fallback Model Loader ─────────────────────────── */
  function loadProductModelWithFallback(product, group, onComplete = null) {
    const sources = [];
    
    // 1. Local path if configured, or default local naming convention
    if (product.model_url) {
      sources.push({ type: 'local custom', url: product.model_url });
    } else {
      sources.push({ type: 'local default', url: `assets/models/${product.id}.glb` });
    }

    // 2. High-quality public CDN fallback URLs
    const cdnMap = {
      'sofa':        'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
      'chair':       'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb',
      'table':       'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Lantern/glTF-Binary/Lantern.glb',
      'sunglasses1': 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Corset/glTF-Binary/Corset.glb',
      'watch1':      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF-Binary/Avocado.glb',
    };
    const cdnUrl = cdnMap[product.id];
    if (cdnUrl) {
      sources.push({ type: 'public CDN', url: cdnUrl });
    }

    let currentSourceIndex = 0;

    // Premium pulsing glassmorphic box while loading
    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.25, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x6c63ff, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.4 })
    );
    group.add(placeholder);
    
    const spinInterval = setInterval(() => {
      if (placeholder && placeholder.parent) {
        placeholder.rotation.y += 0.04;
        placeholder.rotation.x += 0.015;
      } else {
        clearInterval(spinInterval);
      }
    }, 16);

    function tryNextSource() {
      if (currentSourceIndex < sources.length && window.THREE && window.THREE.GLTFLoader) {
        const source = sources[currentSourceIndex];
        currentSourceIndex++;
        
        console.log(`[GLTF] Attempting load of ${source.type} asset: ${source.url}`);
        const loader = new THREE.GLTFLoader();
        
        loader.load(source.url, (gltf) => {
          clearInterval(spinInterval);
          group.remove(placeholder);
          
          const model = gltf.scene;
          
          // Re-center & scale model dynamically to maintain standard layout heights
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          
          const targetSize = (product.category === 'accessories') ? 0.45 : 1.0;
          const scaleFactor = targetSize / (maxDim || 1);
          model.scale.setScalar(scaleFactor);
          
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center.multiplyScalar(scaleFactor));
          if (product.category !== 'accessories') {
            model.position.y += targetSize / 2.3;
          }

          model.traverse(obj => {
            if (obj.isMesh) {
              obj.castShadow    = true;
              obj.receiveShadow = true;
              if (obj.material) {
                obj.material.roughness = Math.max(obj.material.roughness || 0, 0.15);
              }
            }
          });
          
          group.add(model);
          console.log(`[GLTF] Successful load of ${source.type} asset from ${source.url}`);
          if (onComplete) onComplete(model);
        }, undefined, (err) => {
          console.warn(`[GLTF] Failed load of ${source.type} asset from ${source.url}. Trying next fallback...`);
          tryNextSource();
        });
      } else {
        clearInterval(spinInterval);
        group.remove(placeholder);
        console.log(`[GLTF] Reverting to procedural mesh generation for product ${product.id}`);
        triggerProceduralFallback();
      }
    }

    function triggerProceduralFallback() {
      const fallbackMap = {
        'sofa':        () => makeSofa(product.color),
        'chair':       () => makeChair(product.color),
        'table':       () => makeDiningTable(product.color),
        'sidetable':   () => makeBedSideTable(product.color),
        'sunglasses1': () => makeSunglasses1(),
        'sunglasses2': () => makeSunglasses2(),
        'watch1':      () => makeWatch1(),
        'watch2':      () => makeWatch2(),
      };
      
      const generator = fallbackMap[product.id];
      if (generator) {
        group.add(generator());
      } else {
        group.add(makePaintSwatch(product.color));
      }
    }

    tryNextSource();
  }

  /* ── Dynamic Product Model Builder ───────────────────────── */
  function makeProductModel(p) {
    const group = new THREE.Group();
    group.userData = { type: p.category, name: p.name };
    loadProductModelWithFallback(p, group);
    return group;
  }

  /* ── FURNITURE PROCEDURAL GENERATORS ──────────────────────── */

  function makeSofa(color = '#6c63ff') {
    const group = new THREE.Group();
    const fabric = mat(color, 0.8, 0);
    const wood   = mat('#5C3A1E', 0.7, 0.1);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 0.8), fabric);
    seat.position.set(0, 0.25, 0);
    group.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.22), fabric);
    back.position.set(0, 0.72, -0.29);
    group.add(back);

    [-0.8, 0.8].forEach(x => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.38, 0.8), fabric);
      arm.position.set(x, 0.38, 0);
      group.add(arm);
    });

    [[-0.75, -0.78], [0.75, -0.78], [-0.75, 0.78], [0.75, 0.78]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), wood);
      leg.position.set(x, 0.09, z);
      group.add(leg);
    });

    [-0.55, 0, 0.55].forEach(x => {
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.55), mat(color, 0.85));
      cushion.position.set(x, 0.41, 0.1);
      group.add(cushion);
    });

    return group;
  }

  function makeChair(color = '#a78bfa') {
    const group = new THREE.Group();
    const fabric = mat(color, 0.75, 0);
    const wood   = mat('#3B2A1A', 0.6, 0);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.65), fabric);
    seat.position.set(0, 0.45, 0);
    group.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.1), fabric);
    back.position.set(0, 0.78, -0.27);
    group.add(back);

    [[-0.28, -0.27], [0.28, -0.27], [-0.28, 0.27], [0.28, 0.27]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), wood);
      leg.position.set(x, 0.22, z);
      group.add(leg);
    });

    return group;
  }

  function makeDiningTable(color = '#8B5E3C') {
    const group = new THREE.Group();
    const wood   = mat(color, 0.55, 0.05);
    const dark   = mat('#3B2A1A', 0.65, 0.05);

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.85), wood);
    top.position.set(0, 0.74, 0);
    group.add(top);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.04, 0.87), dark);
    trim.position.set(0, 0.70, 0);
    group.add(trim);

    [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.7, 0.07), dark);
      leg.position.set(x, 0.35, z);
      group.add(leg);
    });

    return group;
  }

  function makeBedSideTable(color = '#D4A96A') {
    const group = new THREE.Group();
    const wood = mat(color, 0.6, 0.05);
    const dark = mat('#5C3A1E', 0.65, 0);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.45), wood);
    body.position.set(0, 0.3, 0);
    group.add(body);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.48), dark);
    top.position.set(0, 0.62, 0);
    group.add(top);

    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), mat('#C0A040', 0.2, 0.9));
    knob.position.set(0, 0.3, 0.23);
    group.add(knob);

    return group;
  }

  /* ── ACCESSORIES PROCEDURAL GENERATORS ────────────────────── */

  function makeSunglasses1() {
    const group = new THREE.Group();
    const frame = mat('#B8860B', 0.2, 0.9);
    const lens  = glassMat('#1a3a6e');

    [-0.32, 0.32].forEach(x => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), lens);
      l.scale.set(1, 0.85, 0.18);
      l.position.set(x, 0, 0);
      group.add(l);
    });

    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 8), frame);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.05, 0);
    group.add(bridge);

    [-0.54, 0.54].forEach((x, i) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.02), frame);
      arm.position.set(x + (i === 0 ? -0.15 : 0.15), 0.02, -0.04);
      arm.rotation.y = i === 0 ? -0.15 : 0.15;
      group.add(arm);
    });

    group.scale.set(1.5, 1.5, 1.5);
    return group;
  }

  function makeSunglasses2() {
    const group = new THREE.Group();
    const frame = mat('#1a1a1a', 0.4, 0.1);
    const lens  = glassMat('#1a2a1a');

    [-0.3, 0.3].forEach(x => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.3, 0.06), lens);
      l.position.set(x, 0, 0);
      group.add(l);
    });

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.04), frame);
    bridge.position.set(0, 0.05, 0);
    group.add(bridge);

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.05), frame);
    topBar.position.set(0, 0.16, 0);
    group.add(topBar);

    [-0.52, 0.52].forEach((x, i) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.03), frame);
      arm.position.set(x + (i === 0 ? -0.14 : 0.14), 0.03, -0.03);
      group.add(arm);
    });

    group.scale.set(1.5, 1.5, 1.5);
    return group;
  }

  function makeWatch1() {
    const group = new THREE.Group();
    const caseMat  = mat('#C0C0C0', 0.1, 0.95);
    const dialMat  = mat('#F5F5F5', 0.6, 0);
    const bandMat  = mat('#2C1810', 0.9, 0);

    const watchCase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.09, 32), caseMat);
    group.add(watchCase);

    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.01, 32), dialMat);
    dial.position.y = 0.05;
    group.add(dial);

    [{ len: 0.12, width: 0.02, rot: 0.8, color: '#1a1a1a' },
     { len: 0.18, width: 0.015, rot: 2.1, color: '#1a1a1a' }].forEach(h => {
      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(h.width, 0.01, h.len), mat(h.color, 0.5, 0.3)
      );
      hand.position.set(Math.sin(h.rot) * h.len/2, 0.06, Math.cos(h.rot) * h.len/2);
      hand.rotation.y = -h.rot;
      group.add(hand);
    });

    const bandTop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.6), bandMat);
    bandTop.position.set(0, 0, 0.5);
    group.add(bandTop);

    const bandBot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.5), bandMat);
    bandBot.position.set(0, 0, -0.45);
    group.add(bandBot);

    group.scale.set(1.2, 1.2, 1.2);
    return group;
  }

  function makeWatch2() {
    const group = new THREE.Group();
    const caseMat = mat('#1a1a2e', 0.3, 0.6);
    const dialMat = mat('#0d0d1a', 0.4, 0);
    const bandMat = mat('#16213e', 0.85, 0.1);
    const accent  = mat('#6c63ff', 0.2, 0.5);

    const watchCase = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.58), caseMat);
    group.add(watchCase);

    const dial = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.5), dialMat);
    dial.position.y = 0.06;
    group.add(dial);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 32), accent);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.07;
    group.add(ring);

    const bandTop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.65), bandMat);
    bandTop.position.set(0, 0, 0.6);
    group.add(bandTop);
    const bandBot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.55), bandMat);
    bandBot.position.set(0, 0, -0.56);
    group.add(bandBot);

    group.scale.set(1.2, 1.2, 1.2);
    return group;
  }

  /* ── PAINT SWATCH PROCEDURAL GENERATOR ────────────────────── */

  function makePaintSwatch(color = '#FFDAB3') {
    const group = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), mat(color, 0.9, 0));
    group.add(wall);
    return group;
  }

  /* ── PUBLIC CATALOG ───────────────────────────────────────── */

  const CATALOG = [
    {
      id: 'sofa',       category: 'furniture',    name: 'Modern Sofa',
      desc: 'Sleek 3-seater fabric sofa perfect for any living room.',
      price: '$1,299',  emoji: '🛋️', color: '#6c63ff', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
    {
      id: 'chair',      category: 'furniture',    name: 'Accent Chair',
      desc: 'Elegant accent chair with solid wood legs.',
      price: '$549',    emoji: '🪑', color: '#a78bfa', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
    {
      id: 'table',      category: 'furniture',    name: 'Dining Table',
      desc: 'Solid oak dining table seats up to 6 people.',
      price: '$899',    emoji: '🪵', color: '#8B5E3C', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
    {
      id: 'sidetable',  category: 'furniture',    name: 'Side Table',
      desc: 'Compact bedside table with single drawer.',
      price: '$249',    emoji: '🗂️', color: '#D4A96A', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
    {
      id: 'sunglasses1',category: 'accessories',  name: 'Aviator Sunglasses',
      desc: 'Classic gold-frame aviator with blue-tinted lenses.',
      price: '$189',    emoji: '😎', color: '#f472b6', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
    {
      id: 'sunglasses2',category: 'accessories',  name: 'Wayfarer Sunglasses',
      desc: 'Timeless matte black wayfarer frames.',
      price: '$149',    emoji: '🕶️', color: '#fb923c', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
    {
      id: 'watch1',     category: 'accessories',  name: 'Classic Watch',
      desc: 'Stainless steel dress watch with leather strap.',
      price: '$399',    emoji: '⌚', color: '#f472b6', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
    {
      id: 'watch2',     category: 'accessories',  name: 'Sport Watch',
      desc: 'Modern sport watch with RGB accent ring.',
      price: '$299',    emoji: '🕰️', color: '#fb923c', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
    {
      id: 'paint-peach',category: 'paint',        name: 'Peach Beige',
      desc: 'Warm neutral tone ideal for living rooms and bedrooms.',
      price: '$48/gal', emoji: '🟠', color: '#FFDAB3', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
    {
      id: 'paint-sky',  category: 'paint',        name: 'Sky Blue',
      desc: 'Calming sky blue for a serene, airy feel.',
      price: '$48/gal', emoji: '🔵', color: '#B3D4FF', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
    {
      id: 'paint-mint', category: 'paint',        name: 'Mint Green',
      desc: 'Fresh mint green perfect for kitchens and bathrooms.',
      price: '$48/gal', emoji: '🟢', color: '#C8F0C8', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
    {
      id: 'paint-lav',  category: 'paint',        name: 'Lavender Dream',
      desc: 'Soft lavender for a peaceful and elegant space.',
      price: '$48/gal', emoji: '🟣', color: '#F5E6FF', model_url: '',
      factory: function() { return makeProductModel(this); }
    },
  ];

  // Auto-populate local catalog image_urls for consistent styling fallback
  CATALOG.forEach(p => {
    p.image_url = p.category !== 'paint' ? `assets/images/${p.id.replace('1', '').replace('2', '')}.png` : '';
  });

  function getById(id) { return CATALOG.find(p => p.id === id); }
  function getByCategory(cat) { return cat === 'all' ? CATALOG : CATALOG.filter(p => p.category === cat); }

  return { CATALOG, getById, getByCategory,
           makeSofa, makeChair, makeDiningTable, makeBedSideTable,
           makeSunglasses1, makeSunglasses2, makeWatch1, makeWatch2,
           makePaintSwatch, makeProductModel };
})();
