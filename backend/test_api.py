"""
test_api.py — Quick smoke test for all ARViz backend endpoints
Uses the Flask test client (no server needed).
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

# Remove old DB so we start fresh
db_path = os.path.join(os.path.dirname(__file__), "arviz.db")
if os.path.exists(db_path):
    os.remove(db_path)

from app import app
import json

client = app.test_client()

def test(label, resp, expect_status=200):
    data = resp.get_json()
    status = "PASS" if resp.status_code == expect_status else "FAIL"
    print(f"  [{status}] {label} -> {resp.status_code}")
    if status == "FAIL":
        print(f"         Expected {expect_status}, body: {json.dumps(data, indent=2)[:200]}")
    return data

print("\n=== ARViz Backend API Tests ===\n")

# Health
print("-- Health --")
test("GET /api/health", client.get("/api/health"))

# Products
print("\n-- Products --")
data = test("GET /api/products", client.get("/api/products"))
assert data["data"]["total"] == 12, f"Expected 12 products, got {data['data']['total']}"

data = test("GET /api/products/1", client.get("/api/products/1"))
assert data["data"]["name"] == "Modern Sofa"

data = test("GET /api/products?category=paint", client.get("/api/products?category=paint"))
assert data["data"]["total"] == 4

data = test("GET /api/products?search=watch", client.get("/api/products?search=watch"))
assert data["data"]["total"] == 2

test("GET /api/products/999 (not found)", client.get("/api/products/999"), 404)

# Auth
print("\n-- Auth --")
data = test("POST /api/auth/login (demo user)", 
    client.post("/api/auth/login", json={"email":"demo@arviz.com","password":"demo1234"}))
token = data["data"]["token"]
headers = {"Authorization": f"Bearer {token}"}

test("GET /api/auth/me", client.get("/api/auth/me", headers=headers))
test("GET /api/auth/me (no token)", client.get("/api/auth/me"), 401)

# Register
data = test("POST /api/auth/register",
    client.post("/api/auth/register", json={"name":"Test User","email":"test@example.com","password":"test1234"}), 201)
test_token = data["data"]["token"]
test_headers = {"Authorization": f"Bearer {test_token}"}

test("POST /api/auth/register (duplicate)", 
    client.post("/api/auth/register", json={"name":"Test User","email":"test@example.com","password":"test1234"}), 409)

# Google Auth
data = test("POST /api/auth/google (mock token)", 
    client.post("/api/auth/google", json={"id_token": "mock_google_token_123"}))
assert "token" in data["data"]
assert data["data"]["user"]["email"] == "google_mock@arviz.com"

# Cart
print("\n-- Cart --")
data = test("GET /api/cart (empty)", client.get("/api/cart", headers=headers))
assert data["data"]["count"] == 0

data = test("POST /api/cart/add", 
    client.post("/api/cart/add", json={"product_id": 1, "quantity": 2}, headers=headers), 201)
assert data["data"]["count"] == 1

data = test("POST /api/cart/add (same product, increment)",
    client.post("/api/cart/add", json={"product_id": 1, "quantity": 1}, headers=headers), 201)
assert data["data"]["items"][0]["quantity"] == 3

data = test("POST /api/cart/add (different product)",
    client.post("/api/cart/add", json={"product_id": 5, "quantity": 1}, headers=headers), 201)
assert data["data"]["count"] == 2

cart_item_id = data["data"]["items"][0]["id"]
data = test("PUT /api/cart/<item> (update qty)",
    client.put(f"/api/cart/{cart_item_id}", json={"quantity": 1}, headers=headers))

data = test("DELETE /api/cart/<item>",
    client.delete(f"/api/cart/{data['data']['items'][1]['id']}", headers=headers))
assert data["data"]["count"] == 1

# Wishlist
print("\n-- Wishlist --")
test("POST /api/wishlist/add", 
    client.post("/api/wishlist/add", json={"product_id": 3}, headers=headers), 201)
data = test("GET /api/wishlist", client.get("/api/wishlist", headers=headers))
assert data["data"]["count"] == 1
test("DELETE /api/wishlist/3", client.delete("/api/wishlist/3", headers=headers))
data = test("GET /api/wishlist (after remove)", client.get("/api/wishlist", headers=headers))
assert data["data"]["count"] == 0

# Orders
print("\n-- Orders --")
# Add item to cart first
client.post("/api/cart/add", json={"product_id": 7, "quantity": 1}, headers=headers)
data = test("POST /api/orders (place order)",
    client.post("/api/orders", json={"address":"123 Test St","payment":"card"}, headers=headers), 201)

data = test("GET /api/orders", client.get("/api/orders", headers=headers))
assert data["data"]["count"] >= 1
order_id = data["data"]["orders"][0]["id"]

data = test(f"GET /api/orders/{order_id}", client.get(f"/api/orders/{order_id}", headers=headers))
assert "items" in data["data"]

# Reviews
print("\n-- Reviews --")
data = test("GET /api/products/1/reviews", client.get("/api/products/1/reviews"))
assert data["data"]["count"] >= 1

test("POST /api/products/3/reviews",
    client.post("/api/products/3/reviews", json={"rating":5,"comment":"Great table!"}, headers=test_headers), 201)

# AR Sessions
print("\n-- AR Sessions --")
test("POST /api/ar-sessions",
    client.post("/api/ar-sessions", json={"product_id":1,"mode":"furniture","duration_sec":120,"device":"Chrome Desktop","converted":True}, headers=headers), 201)

data = test("GET /api/ar-sessions/stats", client.get("/api/ar-sessions/stats"))
assert data["data"]["total_sessions"] >= 1

# Admin (should fail for regular user)
print("\n-- Admin restrictions --")
test("POST /api/products (non-admin)", 
    client.post("/api/products", json={"name":"Test","description":"Test","price":10,"category":"test","model_id":"test"}, headers=headers), 403)

# Clear cart
print("\n-- Cart clear --")
client.post("/api/cart/add", json={"product_id": 2, "quantity": 1}, headers=headers)
data = test("DELETE /api/cart (clear all)", client.delete("/api/cart", headers=headers))
assert data["data"]["count"] == 0

print("\n=== All tests completed! ===\n")
