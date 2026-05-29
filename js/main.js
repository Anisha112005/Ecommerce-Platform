/**
 * main.js
 * Landing page logic:
 *  - Navbar scroll effect
 *  - WebXR compatibility check
 *  - Hero Three.js scene
 *  - Product grid generation
 *  - Category filtering
 *  - QR code generation
 *  - Auth Modals & Navbar indicators
 *  - Shopping Cart Drawer & Checkout
 *  - Wishlist Reactive hearts
 */

(function () {

  /* ── Navbar scroll ──────────────────────────────────────── */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  });

  /* ── WebXR compatibility check ──────────────────────────── */
  const banner = document.getElementById('compat-banner');

  async function checkWebXR() {
    banner.className = 'compat-banner checking';
    banner.innerHTML = '<span>⏳</span> Checking AR compatibility…';

    try {
      if (!navigator.xr) throw new Error('no-xr');
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      if (supported) {
        banner.className = 'compat-banner supported';
        banner.innerHTML = '✅ <strong>WebXR AR supported!</strong> Your device supports full augmented reality.';
      } else {
        throw new Error('not-supported');
      }
    } catch {
      // Check camera at least
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        banner.className = 'compat-banner unsupported';
        banner.innerHTML = '📷 <strong>Simulated AR mode</strong> — WebXR not available on this device. Camera overlay will be used instead. <em>For full AR, open on Android Chrome or iOS Safari 16+.</em>';
      } else {
        banner.className = 'compat-banner unsupported';
        banner.innerHTML = '⚠️ Camera not available. Some AR features may be limited.';
      }
    }
  }
  checkWebXR();

  /* ── Hero scene ─────────────────────────────────────────── */
  const heroCanvas = document.getElementById('hero-canvas');
  if (heroCanvas && window.SceneManager) {
    SceneManager.initHeroScene(heroCanvas);
  }

  /* ── Product grid ───────────────────────────────────────── */
  const grid = document.getElementById('product-grid');
  const cardRenderers = [];
  let dbProducts = [];

  function createProductCard(product, index) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.animationDelay = `${index * 0.07}s`;
    card.id = `card-${product.id}`;

    const modeMap = { furniture: 'furniture', accessories: 'accessories', paint: 'paint' };
    const mode    = modeMap[product.category] || 'furniture';

    card.innerHTML = `
      <div class="card-preview" id="preview-${product.id}" style="${product.image_url ? `background-image: url('${product.image_url}'); background-size: cover; background-position: center;` : `background-color: ${product.color || 'rgba(255,255,255,0.05)'};`}">
        <canvas id="canvas-${product.id}"></canvas>
        <span class="card-cat-badge ${product.category}">${product.category}</span>
        <button class="card-wishlist-toggle" id="wishlist-${product.dbId}" onclick="event.stopPropagation(); window.toggleWishlist('${product.dbId}')">
          🤍
        </button>
      </div>
      <div class="card-body">
        <h3>${product.name}</h3>
        <p>${product.desc}</p>
        <div class="card-footer">
          <span class="card-price">${product.price}</span>
          <div style="display:flex; gap:0.4rem; width:100%;">
            <button class="btn-ar ${product.category}" style="flex:1;" id="btn-ar-${product.id}"
              onclick="launchAR('${product.id}','${mode}')">
              🔮 View in AR
            </button>
            <button class="btn-ar" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); width:40px; padding:0; display:flex; align-items:center; justify-content:center;" id="btn-add-cart-${product.dbId}" onclick="window.addToCart('${product.dbId}')" title="Add to Cart">
              🛒
            </button>
          </div>
        </div>
      </div>
    `;

    return card;
  }

  async function renderGrid(category = 'all') {
    grid.innerHTML = '';
    cardRenderers.forEach(r => r && r.stop && r.stop());
    cardRenderers.length = 0;

    let products = [];

    // Try loading products from backend DB
    if (dbProducts.length === 0 && window.API) {
      try {
        const data = await API.getProducts({ per_page: 50 });
        if (data && data.products) {
          dbProducts = data.products.map(p => ({
            id: p.model_id, // Map database model_id to local 3D generator key
            dbId: p.id,
            name: p.name,
            desc: p.description,
            price: typeof p.price === 'number' ? `$${p.price}` : p.price,
            emoji: p.emoji,
            category: p.category,
            model_url: p.model_url || '',
            image_url: p.image_url || ''
          }));
        }
      } catch (err) {
        console.warn('API error, falling back to local catalog:', err);
      }
    }

    if (dbProducts.length > 0) {
      products = category === 'all' ? dbProducts : dbProducts.filter(p => p.category === category);
    } else {
      products = ProductLoader.getByCategory(category);
    }

    products.forEach((product, i) => {
      const card = createProductCard(product, i);
      grid.appendChild(card);

      // Start mini 3D preview after DOM insertion
      requestAnimationFrame(() => {
        const canvas = document.getElementById(`canvas-${product.id}`);
        if (canvas && window.SceneManager) {
          const r = SceneManager.initCardScene(canvas, product.id);
          cardRenderers.push(r);
        }
      });
    });

    // Reactively refresh wishlist heart markers
    updateWishlistHearts();
  }

  renderGrid('all');

  /* ── Category tabs ──────────────────────────────────────── */
  const tabs = document.querySelectorAll('.cat-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderGrid(tab.dataset.cat);
    });
  });

  /* ── Launch AR ──────────────────────────────────────────── */
  window.launchAR = function (productId, mode) {
    const url = `ar-viewer.html?product=${productId}&mode=${mode}`;
    window.location.href = url;
  };

  /* ── Populate Live Dashboard ────────────────────────────── */
  async function loadDashboardStats() {
    if (!window.API) return;
    try {
      const stats = await API.getARStats();
      if (!stats) return;

      document.getElementById('stat-total-sessions').textContent = stats.total_sessions || 0;
      document.getElementById('stat-conversion-rate').textContent = `${stats.conversion_rate || 0}%`;
      document.getElementById('stat-avg-duration').textContent = `${stats.avg_duration_sec || 0}s`;
      document.getElementById('stat-placed-count').textContent = stats.converted || 0;

      // Populate top visualized products list
      const topList = document.getElementById('top-products-list');
      if (topList && stats.top_products) {
        topList.innerHTML = stats.top_products.map((p, idx) => `
          <li class="top-item" style="animation-delay: ${idx * 0.1}s">
            <div class="top-item-left">
              <div class="top-emoji" style="width: 32px; height: 32px; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); font-size: 1rem; margin-right: 0.5rem; flex-shrink:0; padding: 0;">
                ${p.image_url ? `<img src="${p.image_url}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<div style="background-color: ${p.color || '#6c63ff'}; width: 70%; height: 70%; border-radius: 50%;"></div>`}
              </div>
              <span class="top-name">${p.name}</span>
            </div>
            <span class="top-count">${p.sessions} views</span>
          </li>
        `).join('');
      }

      // Populate AR Mode activity rows
      const modesList = document.getElementById('modes-list');
      if (modesList && stats.by_mode) {
        const total = stats.total_sessions || 1;
        modesList.innerHTML = stats.by_mode.map(m => {
          const pct = Math.round((m.count / total) * 100);
          return `
            <div class="mode-row">
              <div class="mode-row-header">
                <span class="mode-name">${m.mode === 'accessories' ? '🕶️ Try-On' : m.mode === 'furniture' ? '🛋️ Furniture' : '🎨 Paint'}</span>
                <span class="mode-count">${m.count} (${pct}%)</span>
              </div>
              <div class="mode-bar-bg">
                <div class="mode-bar-fill" style="width: ${pct}%"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.warn('Dashboard stats load error:', err);
    }
  }

  // Load dashboard stats on load
  loadDashboardStats();

  /* ── QR Code generation ─────────────────────────────────── */
  const qrContainer  = document.getElementById('qr-container');
  const urlPill      = document.getElementById('page-url-pill');
  const pageUrl      = window.location.href.split('#')[0];

  if (urlPill) urlPill.textContent = pageUrl;

  // Simple SVG QR code placeholder (visual representation)
  function generateQRSVG(url) {
    const size  = 21;
    const cells = [];

    // Seed deterministic pattern from URL string
    let seed = 0;
    for (let i = 0; i < url.length; i++) seed = (seed * 31 + url.charCodeAt(i)) & 0xffffffff;

    function rand() { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Finder patterns (corners)
        const inFinder = (r < 7 && c < 7) || (r < 7 && c >= 14) || (r >= 14 && c < 7);
        let dark = false;
        if (inFinder) {
          const lr = r < 7 ? r : r - 14;
          const lc = c < 7 ? c : (c >= 14 ? c - 14 : c);
          dark = (lr === 0 || lr === 6 || lc === 0 || lc === 6) ||
                 (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
        } else {
          dark = rand() > 0.5;
        }
        if (dark) cells.push(`<rect x="${c*4}" y="${r*4}" width="4" height="4" fill="#1a1a2e"/>`);
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 84" width="116" height="116">
      <rect width="84" height="84" fill="white"/>
      ${cells.join('')}
    </svg>`;
  }

  if (qrContainer) {
    qrContainer.innerHTML = generateQRSVG(pageUrl);
  }

  /* ── App Toast System ───────────────────────────────────── */
  const appToast = document.getElementById('app-toast');
  let appToastTimer = null;
  window.showAppToast = function (msg, type = 'info', duration = 3000) {
    if (appToastTimer) clearTimeout(appToastTimer);
    appToast.textContent = msg;
    appToast.className = `show ${type}`;
    appToastTimer = setTimeout(() => { appToast.className = ''; }, duration);
  };

  /* ── User Auth Management ───────────────────────────────── */
  const authModal      = document.getElementById('auth-modal');
  const authForm       = document.getElementById('auth-form');
  const authError      = document.getElementById('auth-error');
  const authTitle      = document.getElementById('auth-title');
  const authSubmitBtn  = document.getElementById('btn-auth-submit');
  const groupName      = document.getElementById('group-name');
  const tabLoginMode   = document.getElementById('tab-login-mode');
  const tabRegisterMode= document.getElementById('tab-register-mode');
  const btnNavLogin    = document.getElementById('btn-nav-login');
  const navUserPill    = document.getElementById('nav-user-pill');
  const navUsername    = document.getElementById('nav-username');
  
  let isRegisterMode = false;

  function updateAuthUI() {
    if (window.API && window.API.isLoggedIn()) {
      btnNavLogin.classList.add('hidden');
      navUserPill.classList.remove('hidden');
      const user = window.API.getUser();
      navUsername.textContent = user ? user.name : 'User';
      loadCart();
      loadWishlist();
    } else {
      btnNavLogin.classList.remove('hidden');
      navUserPill.classList.add('hidden');
      updateCartBadgeCount(0);
    }
  }

  btnNavLogin.addEventListener('click', () => {
    authError.classList.remove('show');
    authModal.classList.add('open');
  });

  document.getElementById('btn-auth-close').addEventListener('click', () => {
    authModal.classList.remove('open');
  });

  navUserPill.addEventListener('click', () => {
    if (confirm("Would you like to sign out of ARViz?")) {
      window.API.logout();
      updateAuthUI();
      window.showAppToast("Signed out successfully", "info");
      renderGrid('all');
    }
  });

  tabLoginMode.addEventListener('click', () => {
    isRegisterMode = false;
    tabLoginMode.classList.add('active');
    tabRegisterMode.classList.remove('active');
    authTitle.textContent = 'Welcome to ARViz';
    groupName.style.display = 'none';
    document.getElementById('auth-name').removeAttribute('required');
    authSubmitBtn.textContent = 'Sign In';
    authError.classList.remove('show');
  });

  tabRegisterMode.addEventListener('click', () => {
    isRegisterMode = true;
    tabRegisterMode.classList.add('active');
    tabLoginMode.classList.remove('active');
    authTitle.textContent = 'Create an Account';
    groupName.style.display = 'block';
    document.getElementById('auth-name').setAttribute('required', 'true');
    authSubmitBtn.textContent = 'Register';
    authError.classList.remove('show');
  });

  /**
   * Map Firebase error codes to user-friendly messages.
   */
  function firebaseErrorMessage(err) {
    const code = err.code || '';
    const map = {
      'auth/email-already-in-use':   'This email is already registered. Please sign in instead.',
      'auth/invalid-email':          'Please enter a valid email address.',
      'auth/user-disabled':          'This account has been disabled.',
      'auth/user-not-found':         'No account found with this email. Please register first.',
      'auth/wrong-password':         'Incorrect password. Please try again.',
      'auth/weak-password':          'Password must be at least 6 characters.',
      'auth/too-many-requests':      'Too many attempts. Please try again later.',
      'auth/popup-closed-by-user':   'Sign-in popup was closed. Please try again.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/invalid-credential':     'Invalid credentials. Please check your email and password.',
    };
    return map[code] || err.message || 'Authentication failed';
  }

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.remove('show');
    authSubmitBtn.disabled = true;
    
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    try {
      if (isRegisterMode) {
        const name = document.getElementById('auth-name').value;
        await window.API.register(name, email, password);
        window.showAppToast("Registered successfully!", "success");
      } else {
        await window.API.login(email, password);
        window.showAppToast("Welcome back!", "success");
      }
      authModal.classList.remove('open');
      authForm.reset();
      updateAuthUI();
      renderGrid('all');
    } catch (err) {
      authError.textContent = firebaseErrorMessage(err);
      authError.classList.add('show');
    } finally {
      authSubmitBtn.disabled = false;
    }
  });

  /* ── Firebase Google Sign-In ────────────────────────────── */
  const googleSignInBtn = document.getElementById('google-signin-btn');
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
      authError.classList.remove('show');
      authSubmitBtn.disabled = true;

      try {
        const data = await window.API.loginWithGoogle();
        window.showAppToast(`Signed in as ${data.user.name}`, "success");
        authModal.classList.remove('open');
        authForm.reset();
        updateAuthUI();
        renderGrid('all');
      } catch (err) {
        // Ignore popup-closed-by-user silently
        if (err.code !== 'auth/popup-closed-by-user') {
          console.error('[Firebase] Google Sign-In error:', err);
          authError.textContent = firebaseErrorMessage(err);
          authError.classList.add('show');
        }
      } finally {
        authSubmitBtn.disabled = false;
      }
    });
  }

  /* ── Shopping Cart Drawer ───────────────────────────────── */
  const cartOverlay = document.getElementById('cart-overlay');
  const btnNavCart   = document.getElementById('btn-nav-cart');
  const cartBadge    = document.getElementById('cart-badge-count');
  const cartCountBadge = document.getElementById('cart-count-badge');
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartSubtotalVal = document.getElementById('cart-subtotal-val');
  
  function updateCartBadgeCount(cnt) {
    cartBadge.textContent = cnt;
    cartBadge.style.display = cnt > 0 ? 'flex' : 'none';
    cartCountBadge.textContent = cnt;
  }

  btnNavCart.addEventListener('click', () => {
    if (!window.API.isLoggedIn()) {
      window.showAppToast("Please Sign In to view your Cart", "info");
      authModal.classList.add('open');
      return;
    }
    loadCart();
    cartOverlay.classList.add('open');
  });

  document.getElementById('btn-cart-close').addEventListener('click', () => {
    cartOverlay.classList.remove('open');
  });

  async function loadCart() {
    if (!window.API || !window.API.isLoggedIn()) return;
    try {
      const data = await window.API.getCart();
      renderCart(data);
    } catch (err) {
      console.error(err);
    }
  }

  function renderCart(cartData) {
    if (!cartData || !cartData.items || cartData.items.length === 0) {
      cartItemsContainer.innerHTML = `
        <div class="cart-empty">
          <span>🛒</span>
          Your cart is currently empty
        </div>
      `;
      cartSubtotalVal.textContent = '$0.00';
      updateCartBadgeCount(0);
      return;
    }

    updateCartBadgeCount(cartData.count);
    cartSubtotalVal.textContent = `$${cartData.total.toFixed(2)}`;

    cartItemsContainer.innerHTML = cartData.items.map(item => `
      <div class="cart-item">
        <div class="cart-item-emoji" style="padding: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03);">
          ${item.image_url ? `<img src="${item.image_url}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<div style="background-color: ${item.color || '#6c63ff'}; width: 80%; height: 80%; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>`}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">$${item.price.toFixed(2)}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="window.updateCartQty('${item.id}', ${item.quantity - 1})">-</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" onclick="window.updateCartQty('${item.id}', ${item.quantity + 1})">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="window.removeCartItem('${item.id}')">🗑</button>
      </div>
    `).join('');
  }

  window.addToCart = async function (productDbId) {
    if (!window.API.isLoggedIn()) {
      window.showAppToast("Please Sign In to add items to your cart", "info");
      authModal.classList.add('open');
      return;
    }
    try {
      const data = await window.API.addToCart(productDbId, 1);
      renderCart(data);
      window.showAppToast("Added to Cart!", "success");
    } catch (err) {
      window.showAppToast(err.message || "Failed to add item", "error");
    }
  };

  window.updateCartQty = async function (itemId, newQty) {
    try {
      const data = await window.API.updateCartItem(itemId, newQty);
      renderCart(data);
    } catch (err) {
      window.showAppToast(err.message || "Failed to update quantity", "error");
    }
  };

  window.removeCartItem = async function (itemId) {
    try {
      const data = await window.API.removeCartItem(itemId);
      renderCart(data);
      window.showAppToast("Item removed", "info");
    } catch (err) {
      window.showAppToast(err.message || "Failed to remove item", "error");
    }
  };

  document.getElementById('btn-cart-clear').addEventListener('click', async () => {
    if (confirm("Are you sure you want to clear your cart?")) {
      try {
        const data = await window.API.clearCart();
        renderCart(data);
        window.showAppToast("Cart cleared", "info");
      } catch (err) {
        window.showAppToast(err.message || "Failed to clear cart", "error");
      }
    }
  });

  /* ── Checkout & Orders ──────────────────────────────────── */
  const orderSuccessModal = document.getElementById('order-success-modal');
  
  document.getElementById('btn-cart-checkout').addEventListener('click', async () => {
    if (!window.API.isLoggedIn()) return;
    
    const address = prompt("Please enter your delivery address:", "123 Visualizer Boulevard, AR State");
    if (address === null) return;
    if (!address.trim()) {
      window.showAppToast("Delivery address is required", "error");
      return;
    }

    try {
      const order = await window.API.placeOrder({
        address: address,
        payment: "card",
        notes: "Placed via premium web app UI"
      });
      
      cartOverlay.classList.remove('open');
      
      // Populate order success receipt modal
      document.getElementById('order-success-id').textContent = `Order ID: #${order.id.slice(-6).toUpperCase()}`;
      orderSuccessModal.classList.add('open');
      
      loadDashboardStats();
      loadCart();
    } catch (err) {
      window.showAppToast(err.message || "Failed to place order", "error");
    }
  });

  document.getElementById('btn-order-close').addEventListener('click', () => {
    orderSuccessModal.classList.remove('open');
  });
  document.getElementById('btn-order-ok').addEventListener('click', () => {
    orderSuccessModal.classList.remove('open');
  });

  /* ── Wishlist Hearts System ─────────────────────────────── */
  let wishlistedIds = new Set();

  async function loadWishlist() {
    if (!window.API || !window.API.isLoggedIn()) return;
    try {
      const data = await window.API.getWishlist();
      wishlistedIds.clear();
      if (data && data.items) {
        data.items.forEach(item => wishlistedIds.add(item.product_id));
      }
      updateWishlistHearts();
    } catch (err) {
      console.error(err);
    }
  }

  function updateWishlistHearts() {
    document.querySelectorAll('.card-wishlist-toggle').forEach(btn => {
      const dbId = btn.id.replace('wishlist-', '');
      const isActive = wishlistedIds.has(dbId);
      btn.classList.toggle('active', isActive);
      btn.textContent = isActive ? '❤️' : '🤍';
    });
  }

  window.toggleWishlist = async function (productDbId) {
    if (!window.API.isLoggedIn()) {
      window.showAppToast("Please Sign In to manage your Wishlist", "info");
      authModal.classList.add('open');
      return;
    }
    
    const isWishlisted = wishlistedIds.has(productDbId);
    try {
      if (isWishlisted) {
        await window.API.removeFromWishlist(productDbId);
        wishlistedIds.delete(productDbId);
        window.showAppToast("Removed from Wishlist", "info");
      } else {
        await window.API.addToWishlist(productDbId);
        wishlistedIds.add(productDbId);
        window.showAppToast("Added to Wishlist!", "success");
      }
      updateWishlistHearts();
    } catch (err) {
      window.showAppToast(err.message || "Failed to update wishlist", "error");
    }
  };

  // Perform initial session status check
  updateAuthUI();

  /* ── Firebase onAuthStateChanged — auto-restore sessions ── */
  if (window.firebaseAuth) {
    window.firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser && !window.API.isLoggedIn()) {
        // Firebase has a session but we don't have an app JWT — refresh it
        try {
          await window.API.refreshSession(firebaseUser);
          updateAuthUI();
          renderGrid('all');
          console.log('[Firebase] Session auto-restored for', firebaseUser.email);
        } catch (err) {
          console.warn('[Firebase] Session restore failed:', err);
        }
      }
    });
  }

  /* ── Intersection Observer for card animations ─────────── */
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.style.opacity = '1';
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.step-card, .feature-card, .dash-card, .dash-detail-card').forEach(el => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(el);
    });
  }

})();
