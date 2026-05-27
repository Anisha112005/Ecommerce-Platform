/**
 * api.js  —  Frontend API client for the ARViz backend
 * Base URL: http://localhost:5000
 */

window.API = (function () {

  const BASE = window.location.protocol === 'file:'
    ? 'http://localhost:5000/api'
    : '/api';

  /* ── Token storage ─────────────────────────────────────── */
  function getToken()       { return localStorage.getItem('arviz_token') || ''; }
  function setToken(t)      { localStorage.setItem('arviz_token', t); }
  function clearToken()     { localStorage.removeItem('arviz_token'); }
  function setUser(u)       { localStorage.setItem('arviz_user', JSON.stringify(u)); }
  function getUser()        {
    try { return JSON.parse(localStorage.getItem('arviz_user') || 'null'); }
    catch { return null; }
  }
  function clearUser()      { localStorage.removeItem('arviz_user'); }
  function isLoggedIn()     { return !!getToken(); }

  /* ── Core fetch wrapper ────────────────────────────────── */
  async function req(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token   = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    try {
      const res  = await fetch(`${BASE}${path}`, opts);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } catch (e) {
      console.error(`[API] ${method} ${path}`, e);
      throw e;
    }
  }

  const get    = (p)    => req('GET',    p);
  const post   = (p, b) => req('POST',   p, b);
  const put    = (p, b) => req('PUT',    p, b);
  const del    = (p)    => req('DELETE', p);

  /* ── Auth ──────────────────────────────────────────────── */
  async function register(name, email, password) {
    const res = await post('/auth/register', { name, email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }

  async function login(email, password) {
    const res = await post('/auth/login', { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }

  async function loginWithGoogle(idToken) {
    const res = await post('/auth/google', { id_token: idToken });
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }

  function logout() { clearToken(); clearUser(); }

  async function getMe() {
    const res = await get('/auth/me');
    return res.data;
  }

  /* ── Products ──────────────────────────────────────────── */
  async function getProducts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return (await get(`/products${qs ? '?' + qs : ''}`)).data;
  }

  async function getProduct(id) {
    return (await get(`/products/${id}`)).data;
  }

  /* ── Cart ──────────────────────────────────────────────── */
  async function getCart()                     { return (await get('/cart')).data; }
  async function addToCart(product_id, qty=1)  { return (await post('/cart/add', { product_id, quantity: qty })).data; }
  async function updateCartItem(id, qty)       { return (await put(`/cart/${id}`, { quantity: qty })).data; }
  async function removeCartItem(id)            { return (await del(`/cart/${id}`)).data; }
  async function clearCart()                   { return (await del('/cart')).data; }

  /* ── Wishlist ───────────────────────────────────────────── */
  async function getWishlist()                 { return (await get('/wishlist')).data; }
  async function addToWishlist(product_id)     { return (await post('/wishlist/add', { product_id })).data; }
  async function removeFromWishlist(product_id){ return (await del(`/wishlist/${product_id}`)).data; }

  /* ── Orders ─────────────────────────────────────────────── */
  async function getOrders()                   { return (await get('/orders')).data; }
  async function getOrder(id)                  { return (await get(`/orders/${id}`)).data; }
  async function placeOrder(payload)           { return (await post('/orders', payload)).data; }

  /* ── Reviews ─────────────────────────────────────────────── */
  async function getReviews(product_id)        { return (await get(`/products/${product_id}/reviews`)).data; }
  async function addReview(product_id, rating, comment) {
    return (await post(`/products/${product_id}/reviews`, { rating, comment })).data;
  }

  /* ── AR Sessions ─────────────────────────────────────────── */
  async function logARSession(product_id, mode, duration_sec, device, converted = false) {
    return post('/ar-sessions', { product_id, mode, duration_sec, device, converted });
  }
  async function getARStats()                  { return (await get('/ar-sessions/stats')).data; }

  /* ── Health ──────────────────────────────────────────────── */
  async function health()                      { return (await get('/health')).data; }

  return {
    // state
    getToken, setToken, clearToken,
    getUser,  setUser,  clearUser,
    isLoggedIn,
    // auth
    register, login, loginWithGoogle, logout, getMe,
    // products
    getProducts, getProduct,
    // cart
    getCart, addToCart, updateCartItem, removeCartItem, clearCart,
    // wishlist
    getWishlist, addToWishlist, removeFromWishlist,
    // orders
    getOrders, getOrder, placeOrder,
    // reviews
    getReviews, addReview,
    // ar
    logARSession, getARStats,
    // misc
    health,
  };
})();
