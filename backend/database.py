"""
database.py  —  MongoDB connection + seed data with in-memory mongomock fallback
"""
import os, hashlib
from datetime import datetime, timezone
from pymongo import MongoClient

# Load .env file manually if it exists in the backend directory
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
  try:
    with open(env_path, "r") as f:
      for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
          key, val = line.split("=", 1)
          os.environ[key.strip()] = val.strip()
  except Exception:
    pass

# MongoDB Connection Parameters
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME   = os.environ.get("MONGO_DB", "arviz")

client = None

def get_db():
  global client
  if client is None:
    try:
      # Attempt to connect to real MongoDB with a fast timeout (2 seconds)
      client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
      # Force connection test using a ping
      client.admin.command('ping')
      print(f"[OK] Connected to real MongoDB at {MONGO_URI}")
    except Exception as e:
      print(f"[INFO] Real MongoDB not available at {MONGO_URI} ({e}). Falling back to in-memory mongomock database.")
      import mongomock
      client = mongomock.MongoClient()
  return client[DB_NAME]

def hash_pw(password):
  return hashlib.sha256(password.encode()).hexdigest()

SEED_PRODUCTS = [
  ("Modern Sofa",         "Sleek 3-seater fabric sofa perfect for any living room.",  1299.0, "furniture",    "sofa",        "🛋️", "#6c63ff", 30, 4.7, 128),
  ("Accent Chair",        "Elegant accent chair with solid wood legs.",                 549.0, "furniture",    "chair",       "🪑", "#a78bfa", 45, 4.5,  89),
  ("Dining Table",        "Solid oak dining table seats up to 6 people.",               899.0, "furniture",    "table",       "🪵", "#8B5E3C", 20, 4.8,  64),
  ("Side Table",          "Compact bedside table with single drawer.",                  249.0, "furniture",    "sidetable",   "🗂️", "#D4A96A", 60, 4.3,  41),
  ("Aviator Sunglasses",  "Classic gold-frame aviator with blue-tinted lenses.",        189.0, "accessories",  "sunglasses1", "😎", "#f472b6", 100, 4.6, 215),
  ("Wayfarer Sunglasses", "Timeless matte black wayfarer frames.",                      149.0, "accessories",  "sunglasses2", "🕶️", "#fb923c", 120, 4.4, 173),
  ("Classic Watch",       "Stainless steel dress watch with leather strap.",            399.0, "accessories",  "watch1",      "⌚", "#f472b6",  75, 4.8, 312),
  ("Sport Watch",         "Modern sport watch with RGB accent ring.",                   299.0, "accessories",  "watch2",      "🕰️", "#fb923c",  80, 4.6, 198),
  ("Peach Beige Paint",   "Warm neutral tone ideal for living rooms and bedrooms.",      48.0, "paint",        "paint-peach", "🟠", "#FFDAB3", 200, 4.5,  55),
  ("Sky Blue Paint",      "Calming sky blue for a serene, airy feel.",                  48.0, "paint",        "paint-sky",   "🔵", "#B3D4FF", 200, 4.6,  48),
  ("Mint Green Paint",    "Fresh mint green perfect for kitchens and bathrooms.",        48.0, "paint",        "paint-mint",  "🟢", "#C8F0C8", 200, 4.4,  39),
  ("Lavender Dream Paint","Soft lavender for a peaceful and elegant space.",             48.0, "paint",        "paint-lav",   "🟣", "#F5E6FF", 200, 4.7,  62),
]

SEED_REVIEWS = [
  (1, "Perfect for my living room! Placed it in AR before buying and it fit perfectly.",     5),
  (1, "Great quality, very comfortable. The AR feature made it easy to choose.",             4),
  (3, "Sturdy and beautiful. AR placement was spot on.",                                     5),
  (5, "Love these sunglasses! The try-on feature is incredible.",                            5),
  (5, "Stylish and well-built. The AR try-on saved me from returning them.",                 5),
  (7, "Gorgeous watch, exactly as shown. Premium quality.",                                  5),
  (9, "The AR paint preview changed my mind about the color — glad I used it!",              4),
]

def init_db():
  db = get_db()

  # Seed products if empty
  if db.products.count_documents({}) == 0:
    products_to_insert = []
    for name, description, price, category, model_id, emoji, color, stock, rating, review_count in SEED_PRODUCTS:
      products_to_insert.append({
        "name": name,
        "description": description,
        "price": price,
        "category": category,
        "model_id": model_id,
        "emoji": emoji,
        "color": color,
        "stock": stock,
        "rating": rating,
        "review_count": review_count,
        "model_url": f"assets/models/{model_id}.glb" if category != "paint" else "",
        "image_url": f"assets/images/{model_id.replace('1', '').replace('2', '')}.png" if category != "paint" else "",
        "created_at": datetime.now(timezone.utc).isoformat()
      })
    db.products.insert_many(products_to_insert)
    print(f"[OK] Seeding complete: {len(SEED_PRODUCTS)} products seeded in MongoDB.")

  # Seed a demo user
  if db.users.count_documents({"email": "demo@arviz.com"}) == 0:
    demo_user = {
      "name": "Demo User",
      "email": "demo@arviz.com",
      "password_hash": hash_pw("demo1234"),
      "role": "customer",
      "avatar": "",
      "created_at": datetime.now(timezone.utc).isoformat()
    }
    res = db.users.insert_one(demo_user)
    demo_user_id = str(res.inserted_id)
    print("[OK] Demo user seeded in MongoDB.")

    # Seed demo reviews
    if db.reviews.count_documents({}) == 0:
      inserted_products = list(db.products.find())
      prod_map = {}
      for idx, seed_p in enumerate(SEED_PRODUCTS):
        for p in inserted_products:
          if p["model_id"] == seed_p[4]:
            prod_map[idx + 1] = str(p["_id"])
            break

      reviews_to_insert = []
      for pid, comment, rating in SEED_REVIEWS:
        p_id = prod_map.get(pid)
        if p_id:
          reviews_to_insert.append({
            "product_id": p_id,
            "user_id": demo_user_id,
            "rating": rating,
            "comment": comment,
            "created_at": datetime.now(timezone.utc).isoformat()
          })
      if reviews_to_insert:
        db.reviews.insert_many(reviews_to_insert)
        print(f"[OK] Seeded {len(reviews_to_insert)} reviews in MongoDB.")

  print(f"[OK] MongoDB Database ready.")

if __name__ == "__main__":
  init_db()
