"""
app.py  —  Main Flask REST API for ARViz E-Commerce Platform using MongoDB
"""

import os, sys
from datetime import datetime, timezone
from bson.objectid import ObjectId

sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from database import get_db, hash_pw, init_db
from auth import generate_token, require_auth, optional_auth, require_admin, verify_firebase_token

# Frontend directory (one level up from backend/)
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ── init DB on startup ────────────────────────────────────────
init_db()

# ── Serve frontend static files ──────────────────────────────
@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<path:filename>")
def serve_static(filename):
    file_path = os.path.join(FRONTEND_DIR, filename)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIR, filename)
    # Fallback to index.html for SPA-like routing
    return send_from_directory(FRONTEND_DIR, "index.html")

# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────
def row_to_dict(doc):
    if not doc:
        return None
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d.pop("_id"))
    return d

def rows_to_list(docs):
    return [row_to_dict(d) for d in docs]

def ok(data=None, msg="success", code=200):
    body = {"success": True, "message": msg}
    if data is not None:
        body["data"] = data
    return jsonify(body), code

def err(msg, code=400):
    return jsonify({"success": False, "error": msg}), code

def resolve_product_id(pid):
    """Resolves a product_id string (either dynamic ObjectId or short index string '1') to the actual ObjectId string."""
    if not pid:
        return None
    pid_str = str(pid)
    
    # Check if already a valid 24-character hex ObjectId string
    if len(pid_str) == 24 and all(c in '0123456789abcdefABCDEF' for c in pid_str):
        return pid_str
        
    db = get_db()
    # Try finding by model_id
    p = db.products.find_one({"model_id": pid_str})
    if p:
        return str(p["_id"])
        
    # Try finding by numeric index (1-based)
    if pid_str.isdigit():
        all_prods = list(db.products.find().sort("_id", 1))
        idx = int(pid_str) - 1
        if 0 <= idx < len(all_prods):
            return str(all_prods[idx]["_id"])
            
    return pid_str

def _cart_items(db, user_id):
    cart_docs = list(db.cart.find({"user_id": str(user_id)}))
    items = []
    for c in cart_docs:
        try:
            p = db.products.find_one({"_id": ObjectId(c["product_id"])})
        except Exception:
            p = None
        if p:
            items.append({
                "id": str(c["_id"]),
                "quantity": c["quantity"],
                "added_at": c.get("added_at"),
                "product_id": str(p["_id"]),
                "name": p["name"],
                "price": p["price"],
                "emoji": p["emoji"],
                "category": p["category"],
                "model_id": p["model_id"],
                "color": p["color"],
                "image_url": p.get("image_url", ""),
                "subtotal": round(p["price"] * c["quantity"], 2)
            })
    return items

# ─────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────
@app.route("/api/auth/register", methods=["POST"])
def register():
    body = request.get_json(silent=True) or {}
    name     = (body.get("name") or "").strip()
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not name or not email or not password:
        return err("name, email and password are required.")
    if len(password) < 6:
        return err("Password must be at least 6 characters.")

    db = get_db()
    if db.users.find_one({"email": email}):
        return err("Email already registered.", 409)

    user_doc = {
        "name": name,
        "email": email,
        "password_hash": hash_pw(password),
        "role": "customer",
        "avatar": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    res = db.users.insert_one(user_doc)
    user_doc["id"] = str(res.inserted_id)
    user = row_to_dict(user_doc)
    token = generate_token(user["id"], user["email"], user["role"])
    return ok({"token": token, "user": user}, "Registered successfully.", 201)


@app.route("/api/auth/login", methods=["POST"])
def login():
    body     = request.get_json(silent=True) or {}
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    db = get_db()
    user = db.users.find_one({"email": email, "password_hash": hash_pw(password)})
    if not user:
        return err("Invalid email or password.", 401)

    user_dict = row_to_dict(user)
    token = generate_token(user_dict["id"], user_dict["email"], user_dict["role"])
    return ok({"token": token, "user": user_dict})


@app.route("/api/auth/google", methods=["POST"])
def google_auth():
    body = request.get_json(silent=True) or {}
    id_token = body.get("id_token")
    if not id_token:
        return err("id_token is required.", 400)

    import urllib.request, json
    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            payload = json.loads(response.read().decode())
    except Exception as e:
        print(f"[Google Auth] Error verifying token: {e}")
        if "mock_google_" in id_token:
            payload = {
                "email": "demo@arviz.com" if "demo" in id_token else "google_mock@arviz.com",
                "name": "Demo User" if "demo" in id_token else "Google Demo User",
                "picture": "",
                "sub": id_token
            }
        else:
            return err("Failed to verify Google Sign-In token.", 401)

    email = payload.get("email")
    name  = payload.get("name") or "Google User"
    avatar = payload.get("picture") or ""
    google_id = payload.get("sub")

    if not email:
        return err("Email not provided by Google account.", 400)

    db = get_db()
    user = db.users.find_one({"email": email.strip().lower()})
    
    if not user:
        user_doc = {
            "name": name,
            "email": email.strip().lower(),
            "google_id": google_id,
            "role": "customer",
            "avatar": avatar,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        res = db.users.insert_one(user_doc)
        user_doc["id"] = str(res.inserted_id)
        user = user_doc
    else:
        if "google_id" not in user:
            db.users.update_one({"_id": user["_id"]}, {"$set": {"google_id": google_id, "avatar": avatar}})
        user = row_to_dict(user)

    token = generate_token(user["id"], user["email"], user["role"])
    return ok({"token": token, "user": user}, "Successfully authenticated with Google.")


@app.route("/api/auth/firebase", methods=["POST"])
def firebase_auth():
    """Verify a Firebase ID token, find-or-create user in MongoDB, and return app JWT."""
    body = request.get_json(silent=True) or {}
    id_token = body.get("id_token")
    if not id_token:
        return err("id_token is required.", 400)

    # Verify the Firebase ID token server-side
    decoded = verify_firebase_token(id_token)
    if not decoded:
        return err("Invalid or expired Firebase token.", 401)

    firebase_uid = decoded.get("uid", "")
    email        = decoded.get("email", "").strip().lower()
    name         = decoded.get("name") or decoded.get("display_name") or "Firebase User"
    avatar       = decoded.get("picture", "")
    provider     = decoded.get("firebase", {}).get("sign_in_provider", "unknown")

    if not email:
        return err("Email not available from Firebase token.", 400)

    db = get_db()

    # Try to find existing user by firebase_uid or email
    user = db.users.find_one({"firebase_uid": firebase_uid})
    if not user:
        user = db.users.find_one({"email": email})

    if user:
        # Update firebase_uid and avatar if not already set
        update_fields = {}
        if not user.get("firebase_uid"):
            update_fields["firebase_uid"] = firebase_uid
        if avatar and not user.get("avatar"):
            update_fields["avatar"] = avatar
        if update_fields:
            db.users.update_one({"_id": user["_id"]}, {"$set": update_fields})
        user = row_to_dict(user)
    else:
        # Create new user
        user_doc = {
            "name": name,
            "email": email,
            "firebase_uid": firebase_uid,
            "auth_provider": provider,
            "role": "customer",
            "avatar": avatar,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        res = db.users.insert_one(user_doc)
        user_doc["id"] = str(res.inserted_id)
        user = row_to_dict(user_doc)

    token = generate_token(user["id"], user["email"], user["role"])
    return ok({"token": token, "user": user}, f"Authenticated via Firebase ({provider}).")


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def me(current_user):
    return ok(row_to_dict(current_user))


# ─────────────────────────────────────────────────────────────
# PRODUCTS
# ─────────────────────────────────────────────────────────────
@app.route("/api/products", methods=["GET"])
def get_products():
    category = request.args.get("category", "")
    search   = request.args.get("search",   "").strip()
    sort     = request.args.get("sort",     "id")   # id | price_asc | price_desc | rating | name
    page     = max(1, int(request.args.get("page", 1)))
    per_page = min(50, int(request.args.get("per_page", 12)))

    filter_query = {}
    if category:
        filter_query["category"] = category
    if search:
        filter_query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]

    # Sort criteria mapping
    sort_mapping = {
        "id": [("_id", 1)],
        "price_asc": [("price", 1)],
        "price_desc": [("price", -1)],
        "rating": [("rating", -1)],
        "name": [("name", 1)]
    }
    sort_criteria = sort_mapping.get(sort, [("_id", 1)])

    db = get_db()
    total = db.products.count_documents(filter_query)
    offset = (page - 1) * per_page
    
    cursor = db.products.find(filter_query).sort(sort_criteria).skip(offset).limit(per_page)
    products_list = rows_to_list(cursor)

    return ok({
        "products":   products_list,
        "total":      total,
        "page":       page,
        "per_page":   per_page,
        "pages":      (total + per_page - 1) // per_page,
    })


@app.route("/api/products/<pid>", methods=["GET"])
def get_product(pid):
    db = get_db()
    resolved_pid = resolve_product_id(pid)
    try:
        row = db.products.find_one({"_id": ObjectId(resolved_pid)})
    except Exception:
        row = None
    if not row:
        return err("Product not found.", 404)
    return ok(row_to_dict(row))


@app.route("/api/products", methods=["POST"])
@require_admin
def create_product(current_user):
    b = request.get_json(silent=True) or {}
    required = ["name", "description", "price", "category", "model_id"]
    for f in required:
        if not b.get(f):
            return err(f"Field '{f}' is required.")
    
    db = get_db()
    product_doc = {
        "name": b["name"],
        "description": b["description"],
        "price": float(b["price"]),
        "category": b["category"],
        "model_id": b["model_id"],
        "emoji": b.get("emoji", "📦"),
        "color": b.get("color", "#6c63ff"),
        "stock": int(b.get("stock", 50)),
        "rating": float(b.get("rating", 4.5)),
        "review_count": int(b.get("review_count", 0)),
        "model_url": b.get("model_url", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    res = db.products.insert_one(product_doc)
    product_doc["id"] = str(res.inserted_id)
    return ok(row_to_dict(product_doc), "Product created.", 201)


@app.route("/api/products/<pid>", methods=["PUT"])
@require_admin
def update_product(current_user, pid):
    b  = request.get_json(silent=True) or {}
    db = get_db()
    resolved_pid = resolve_product_id(pid)
    
    try:
        existing = db.products.find_one({"_id": ObjectId(resolved_pid)})
    except Exception:
        existing = None
        
    if not existing:
        return err("Product not found.", 404)
        
    fields = {}
    for k, v in b.items():
        if k in ["name","description","price","category","model_id","emoji","color","stock","rating","model_url"]:
            if k == "price" or k == "rating":
                fields[k] = float(v)
            elif k == "stock":
                fields[k] = int(v)
            else:
                fields[k] = v
                
    if fields:
        db.products.update_one({"_id": ObjectId(resolved_pid)}, {"$set": fields})
        
    updated = db.products.find_one({"_id": ObjectId(resolved_pid)})
    return ok(row_to_dict(updated), "Product updated.")


@app.route("/api/products/<pid>", methods=["DELETE"])
@require_admin
def delete_product(current_user, pid):
    db = get_db()
    resolved_pid = resolve_product_id(pid)
    try:
        db.products.delete_one({"_id": ObjectId(resolved_pid)})
    except Exception:
        pass
    return ok(msg="Product deleted.")


# ─────────────────────────────────────────────────────────────
# CART
# ─────────────────────────────────────────────────────────────
@app.route("/api/cart", methods=["GET"])
@require_auth
def get_cart(current_user):
    db    = get_db()
    items = _cart_items(db, current_user["id"])
    total = sum(r["subtotal"] for r in items)
    return ok({"items": items, "total": round(total, 2), "count": len(items)})


@app.route("/api/cart/add", methods=["POST"])
@require_auth
def add_to_cart(current_user):
    b          = request.get_json(silent=True) or {}
    product_id = b.get("product_id")
    quantity   = max(1, int(b.get("quantity", 1)))
    if not product_id:
        return err("product_id is required.")

    db = get_db()
    resolved_pid = resolve_product_id(product_id)
    try:
        prod_exists = db.products.find_one({"_id": ObjectId(resolved_pid)})
    except Exception:
        prod_exists = None
        
    if not prod_exists:
        return err("Product not found.", 404)

    existing = db.cart.find_one({"user_id": str(current_user["id"]), "product_id": resolved_pid})
    if existing:
        db.cart.update_one(
            {"_id": existing["_id"]},
            {"$set": {"quantity": existing["quantity"] + quantity}}
        )
    else:
        db.cart.insert_one({
            "user_id": str(current_user["id"]),
            "product_id": resolved_pid,
            "quantity": quantity,
            "added_at": datetime.now(timezone.utc).isoformat()
        })
        
    items = _cart_items(db, current_user["id"])
    total = sum(r["subtotal"] for r in items)
    return ok({"items": items, "total": round(total, 2), "count": len(items)},
              "Added to cart.", 201)


@app.route("/api/cart/<item_id>", methods=["PUT"])
@require_auth
def update_cart_item(current_user, item_id):
    b        = request.get_json(silent=True) or {}
    quantity = int(b.get("quantity", 1))
    db       = get_db()
    
    try:
        item = db.cart.find_one({"_id": ObjectId(item_id), "user_id": str(current_user["id"])})
    except Exception:
        item = None
        
    if not item:
        return err("Cart item not found.", 404)
        
    if quantity < 1:
        db.cart.delete_one({"_id": item["_id"]})
    else:
        db.cart.update_one({"_id": item["_id"]}, {"$set": {"quantity": quantity}})
        
    items = _cart_items(db, current_user["id"])
    return ok({"items": items, "count": len(items)})


@app.route("/api/cart/<item_id>", methods=["DELETE"])
@require_auth
def remove_cart_item(current_user, item_id):
    db = get_db()
    try:
        db.cart.delete_one({"_id": ObjectId(item_id), "user_id": str(current_user["id"])})
    except Exception:
        pass
    items = _cart_items(db, current_user["id"])
    return ok({"items": items, "count": len(items)}, "Item removed.")


@app.route("/api/cart", methods=["DELETE"])
@require_auth
def clear_cart(current_user):
    db = get_db()
    db.cart.delete_many({"user_id": str(current_user["id"])})
    return ok({"items": [], "total": 0, "count": 0}, "Cart cleared.")


# ─────────────────────────────────────────────────────────────
# WISHLIST
# ─────────────────────────────────────────────────────────────
@app.route("/api/wishlist", methods=["GET"])
@require_auth
def get_wishlist(current_user):
    db   = get_db()
    wishlist_docs = list(db.wishlist.find({"user_id": str(current_user["id"])}))
    items = []
    for w in wishlist_docs:
        try:
            p = db.products.find_one({"_id": ObjectId(w["product_id"])})
        except Exception:
            p = None
        if p:
            items.append({
                "id": str(w["_id"]),
                "added_at": w.get("added_at"),
                "product_id": str(p["_id"]),
                "name": p["name"],
                "price": p["price"],
                "emoji": p["emoji"],
                "category": p["category"],
                "model_id": p["model_id"],
                "color": p["color"],
                "rating": p["rating"]
            })
    return ok({"items": items, "count": len(items)})


@app.route("/api/wishlist/add", methods=["POST"])
@require_auth
def add_to_wishlist(current_user):
    b          = request.get_json(silent=True) or {}
    product_id = b.get("product_id")
    if not product_id:
        return err("product_id is required.")
        
    db = get_db()
    resolved_pid = resolve_product_id(product_id)
    try:
        prod_exists = db.products.find_one({"_id": ObjectId(resolved_pid)})
    except Exception:
        prod_exists = None
        
    if not prod_exists:
        return err("Product not found.", 404)
        
    if db.wishlist.count_documents({"user_id": str(current_user["id"]), "product_id": resolved_pid}) == 0:
        db.wishlist.insert_one({
            "user_id": str(current_user["id"]),
            "product_id": resolved_pid,
            "added_at": datetime.now(timezone.utc).isoformat()
        })
    return ok(msg="Added to wishlist.", code=201)


@app.route("/api/wishlist/<product_id>", methods=["DELETE"])
@require_auth
def remove_from_wishlist(current_user, product_id):
    db = get_db()
    resolved_pid = resolve_product_id(product_id)
    db.wishlist.delete_many({"user_id": str(current_user["id"]), "product_id": resolved_pid})
    return ok(msg="Removed from wishlist.")


# ─────────────────────────────────────────────────────────────
# ORDERS
# ─────────────────────────────────────────────────────────────
@app.route("/api/orders", methods=["GET"])
@require_auth
def get_orders(current_user):
    db   = get_db()
    order_docs = list(db.orders.find({"user_id": str(current_user["id"])}).sort("created_at", -1))
    orders = []
    for o in order_docs:
        orders.append(row_to_dict(o))
    return ok({"orders": orders, "count": len(orders)})


@app.route("/api/orders/<oid>", methods=["GET"])
@require_auth
def get_order(current_user, oid):
    db    = get_db()
    try:
        order = db.orders.find_one({"_id": ObjectId(oid), "user_id": str(current_user["id"])})
    except Exception:
        order = None
    if not order:
        return err("Order not found.", 404)
    return ok(row_to_dict(order))


@app.route("/api/orders", methods=["POST"])
@require_auth
def place_order(current_user):
    b       = request.get_json(silent=True) or {}
    address = b.get("address", "")
    payment = b.get("payment", "card")
    notes   = b.get("notes",   "")

    db    = get_db()
    items = _cart_items(db, current_user["id"])
    if not items:
        return err("Cart is empty.")

    total = sum(r["subtotal"] for r in items)
    
    order_items = []
    for item in items:
        order_items.append({
            "product_id": item["product_id"],
            "quantity": item["quantity"],
            "unit_price": item["price"],
            "name": item["name"],
            "emoji": item["emoji"],
            "model_id": item["model_id"]
        })
        # reduce stock
        try:
            p = db.products.find_one({"_id": ObjectId(item["product_id"])})
            if p:
                new_stock = max(0, p.get("stock", 50) - item["quantity"])
                db.products.update_one({"_id": p["_id"]}, {"$set": {"stock": new_stock}})
        except Exception:
            pass

    order_doc = {
        "user_id": str(current_user["id"]),
        "total": round(total, 2),
        "status": "confirmed",
        "address": address,
        "payment": payment,
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "items": order_items
    }
    
    res = db.orders.insert_one(order_doc)
    order_doc["id"] = str(res.inserted_id)
    
    # clear cart
    db.cart.delete_many({"user_id": str(current_user["id"])})
    return ok(row_to_dict(order_doc), "Order placed successfully!", 201)


# ─────────────────────────────────────────────────────────────
# REVIEWS
# ─────────────────────────────────────────────────────────────
@app.route("/api/products/<pid>/reviews", methods=["GET"])
def get_reviews(pid):
    db   = get_db()
    resolved_pid = resolve_product_id(pid)
    review_docs = list(db.reviews.find({"product_id": resolved_pid}).sort("created_at", -1))
    
    reviews_list = []
    for r in review_docs:
        try:
            u = db.users.find_one({"_id": ObjectId(r["user_id"])})
        except Exception:
            u = None
        reviews_list.append({
            "id": str(r["_id"]),
            "rating": r["rating"],
            "comment": r["comment"],
            "created_at": r.get("created_at"),
            "user_name": u["name"] if u else "Anonymous",
            "user_avatar": u.get("avatar", "") if u else ""
        })
        
    return ok({"reviews": reviews_list, "count": len(reviews_list)})


@app.route("/api/products/<pid>/reviews", methods=["POST"])
@require_auth
def add_review(current_user, pid):
    b       = request.get_json(silent=True) or {}
    rating  = int(b.get("rating", 0))
    comment = (b.get("comment") or "").strip()
    if not (1 <= rating <= 5):
        return err("Rating must be between 1 and 5.")
        
    db = get_db()
    resolved_pid = resolve_product_id(pid)
    try:
        p_exists = db.products.find_one({"_id": ObjectId(resolved_pid)})
    except Exception:
        p_exists = None
    if not p_exists:
        return err("Product not found.", 404)
        
    # Check duplicate review
    existing = db.reviews.find_one({"product_id": resolved_pid, "user_id": str(current_user["id"])})
    if existing:
        return err("You have already reviewed this product.", 409)
        
    db.reviews.insert_one({
        "product_id": resolved_pid,
        "user_id": str(current_user["id"]),
        "rating": rating,
        "comment": comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Recalculate avg rating
    all_revs = list(db.reviews.find({"product_id": resolved_pid}))
    total_revs = len(all_revs)
    avg_rating = round(sum(r["rating"] for r in all_revs) / total_revs, 1) if total_revs else 4.5
    
    db.products.update_one(
        {"_id": ObjectId(resolved_pid)},
        {"$set": {"rating": avg_rating, "review_count": total_revs}}
    )
    
    return ok(msg="Review submitted.", code=201)


# ─────────────────────────────────────────────────────────────
# AR SESSIONS
# ─────────────────────────────────────────────────────────────
@app.route("/api/ar-sessions", methods=["POST"])
@optional_auth
def log_ar_session(current_user):
    b          = request.get_json(silent=True) or {}
    product_id = b.get("product_id")
    mode       = b.get("mode", "furniture")
    duration   = int(b.get("duration_sec", 0))
    device     = b.get("device", "")
    converted  = 1 if b.get("converted") else 0
    uid        = current_user["id"] if current_user else None

    db = get_db()
    resolved_pid = resolve_product_id(product_id)
    
    db.ar_sessions.insert_one({
        "user_id": uid,
        "product_id": resolved_pid,
        "mode": mode,
        "duration_sec": duration,
        "device": device,
        "converted": converted,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return ok(msg="AR session logged.", code=201)


@app.route("/api/ar-sessions/stats", methods=["GET"])
def ar_stats():
    db = get_db()
    total = db.ar_sessions.count_documents({})
    
    # count by mode
    by_mode_res = db.ar_sessions.aggregate([
        {"$group": {"_id": "$mode", "count": {"$sum": 1}}}
    ])
    by_mode = [{"mode": m["_id"], "count": m["count"]} for m in by_mode_res]
    
    converted = db.ar_sessions.count_documents({"converted": 1})
    
    # avg duration
    avg_dur_res = list(db.ar_sessions.aggregate([
        {"$match": {"duration_sec": {"$gt": 0}}},
        {"$group": {"_id": None, "avg_dur": {"$avg": "$duration_sec"}}}
    ]))
    avg_duration = avg_dur_res[0]["avg_dur"] if (avg_dur_res and avg_dur_res[0].get("avg_dur") is not None) else 0
    
    # top products
    top_res = list(db.ar_sessions.aggregate([
        {"$group": {"_id": "$product_id", "sessions": {"$sum": 1}}},
        {"$sort": {"sessions": -1}},
        {"$limit": 5}
    ]))
    
    top_products = []
    for item in top_res:
        try:
            p = db.products.find_one({"_id": ObjectId(item["_id"])})
        except Exception:
            p = None
        if p:
            top_products.append({
                "name": p["name"],
                "emoji": p["emoji"],
                "image_url": p.get("image_url", ""),
                "color": p.get("color", ""),
                "sessions": item["sessions"]
            })
            
    return ok({
        "total_sessions":  total,
        "converted":       converted,
        "conversion_rate": round((converted / total * 100) if total else 0, 1),
        "avg_duration_sec":round(avg_duration, 1),
        "by_mode":         by_mode,
        "top_products":    top_products,
    })


# ─────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return ok({"service": "ARViz API", "version": "1.0.0", "status": "healthy"})


# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n>>> ARViz API starting on http://localhost:5000\n")
    app.run(host="0.0.0.0", port=5000, debug=True)
