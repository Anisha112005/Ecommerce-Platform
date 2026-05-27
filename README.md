# 🔮 ARViz E-Commerce Platform

ARViz is a premium, state-of-the-art E-Commerce application utilizing advanced Augmented Reality (AR) visualizations, Three.js 3D rendering, and lightweight computer-vision overlays.

Designed for high-performance deployment on Vercel, the application dynamically bridges an aesthetic vanilla HTML/CSS/JS frontend with a stateless Python Flask microservice backend.

---

## 🌟 Key Features

* **Three-Way AR Visualizer Modes**:
  1. **🛋️ Furniture Placement**: Native surface hit testing using Three.js projections. Features intuitive rotation/scale control sliders and custom drop-shadow placement.
  2. **🕶️ Accessory Try-On**: Face detection try-on for sunglasses and watches. Simulates natural head-sway tracking.
  3. **🎨 Paint Tone Overlay**: Real-time upper-frame wall tone color previews using high-performance pixel filters.
* **Full-Featured Shopping Loop**: Interactive checkout drawer with dynamic subtotals, wishlist heart triggers, and purchase tracking.
* **Unified Auth**: Custom JWT authentication coupled with premium **Google OAuth** integration.
* **Analytical Dashboard**: Collects live WebXR interaction metrics, conversion rates, visual usage durations, and preferred visualization modes.
* **Resilient Infrastructure**: Automatic local `mongomock` fallback database means the platform runs smoothly out-of-the-box without requiring initial database setup.

---

## 🛠️ Technology Stack

* **Frontend**: Vanilla HTML5, Advanced CSS3 Glassmorphism, Modern Javascript, Three.js.
* **Backend**: Python, Flask, Flask-CORS, PyJWT (JSON Web Token security).
* **Database**: MongoDB (Atlas Cloud database support + local `mongomock` in-memory fallback).
* **Hosting/CI/CD**: Fully configured for **Vercel** serverless functions and ultra-fast edge static content delivery.

---

## 🚀 Quick Start (Local Run)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Anisha112005/Ecommerce-Platform.git
   cd Ecommerce-Platform
   ```

2. **Configure Virtual Environment**:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch Server**:
   ```bash
   python backend/app.py
   ```
   Open `http://localhost:5000` in your web browser.

---

## ☁️ Production Deployment on Vercel

ARViz is pre-configured with a modern serverless deployment setup (`vercel.json` routing rules + `api/index.py` backend gateway):

1. Go to your **Vercel Project Dashboard** and click **Import Project**.
2. Select your cloned GitHub repository.
3. **Environment Variables (Optional)**: If you would like to persist items (carts, users, AR stats) in a live MongoDB Atlas cluster, set the following keys:
   - `MONGO_URI` = `mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority`
   - `MONGO_DB` = `arviz`
   - `SECRET_KEY` = `your_secure_secret_hash_key`
4. Click **Deploy**! Vercel's global CDN will automatically compile your 3D models and route backend calls.
