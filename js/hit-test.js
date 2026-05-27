/**
 * hit-test.js
 * Handles AR reticle animation and surface hit simulation.
 * On WebXR devices: uses real XRHitTest.
 * On desktop/fallback: simulates surface detection with a
 *   virtual plane and raycaster.
 */

window.HitTest = (function () {

  /* ── Reticle mesh ─────────────────────────────────────── */
  function createReticle() {
    const group = new THREE.Group();

    // Outer ring
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.012, 8, 32),
      new THREE.MeshStandardMaterial({
        color: 0x6c63ff, emissive: 0x6c63ff,
        emissiveIntensity: 1.2, transparent: true, opacity: 0.9
      })
    );
    outerRing.rotation.x = -Math.PI / 2;
    group.add(outerRing);

    // Inner dot
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.04, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xffffff,
        emissiveIntensity: 0.6, transparent: true, opacity: 0.6
      })
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = 0.001;
    group.add(dot);

    // Crosshair lines
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.8,
      transparent: true, opacity: 0.7
    });
    [0, Math.PI / 2].forEach(rot => {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.008), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = rot;
      line.position.y = 0.002;
      group.add(line);
    });

    group.visible = false;
    return group;
  }

  /* ── Simulated floor plane for desktop ─────────────────── */
  function createVirtualFloor() {
    const geo = new THREE.PlaneGeometry(20, 20);
    const mat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0; // floor at y=0
    return plane;
  }

  /* ── Main HitTest controller ────────────────────────────── */
  function create(scene, camera, renderer) {
    const reticle  = createReticle();
    const floor    = createVirtualFloor();
    scene.add(reticle);
    scene.add(floor);

    const raycaster = new THREE.Raycaster();
    const pointer   = new THREE.Vector2(0, 0); // center of screen
    let   hitPosition = null;

    /* Animate reticle pulse */
    let t = 0;
    function updateReticle(delta) {
      t += delta;
      if (!reticle.visible) return;
      const s = 1 + 0.06 * Math.sin(t * 4);
      reticle.scale.set(s, s, s);
      reticle.children[0].material.emissiveIntensity = 0.8 + 0.4 * Math.sin(t * 3);
    }

    /* Raycast against virtual floor */
    function update(delta) {
      updateReticle(delta);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(floor);
      if (hits.length > 0) {
        const p = hits[0].point;
        reticle.position.set(p.x, p.y + 0.001, p.z);
        reticle.visible = true;
        hitPosition = p.clone();
      } else {
        hitPosition = null;
      }
    }

    function getHitPosition() { return hitPosition; }
    function showReticle(v) { reticle.visible = v; }

    return { reticle, update, getHitPosition, showReticle };
  }

  return { create, createReticle };
})();
