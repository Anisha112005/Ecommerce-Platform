"""
auth.py  —  JWT token helpers + auth decorator + Firebase token verification
"""
import jwt, functools, os, json, base64
from datetime import datetime, timedelta, timezone
from flask import request, jsonify
from database import get_db
from bson.objectid import ObjectId

SECRET = os.environ.get("JWT_SECRET", "arviz-super-secret-key-2025-ecommerce-platform")
ALGO   = "HS256"
EXPIRY = 7  # days

# ─── Firebase Admin SDK initialization ────────────────────────
_firebase_app = None

def _init_firebase():
  """Lazily initialize Firebase Admin SDK using env-based credentials."""
  global _firebase_app
  if _firebase_app is not None:
    return _firebase_app

  try:
    import firebase_admin
    from firebase_admin import credentials

    # Option 1: Base64-encoded service account JSON in env var
    sa_b64 = os.environ.get("FIREBASE_SERVICE_ACCOUNT_B64", "")
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")

    if sa_b64:
      sa_dict = json.loads(base64.b64decode(sa_b64).decode("utf-8"))
      cred = credentials.Certificate(sa_dict)
    elif sa_json:
      # Could be a JSON string or a file path
      if sa_json.startswith("{"):
        sa_dict = json.loads(sa_json)
        cred = credentials.Certificate(sa_dict)
      else:
        cred = credentials.Certificate(sa_json)
    else:
      # Option 2: Default credentials (works on GCP / Firebase emulator)
      cred = credentials.ApplicationDefault() if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") else None

    if cred:
      _firebase_app = firebase_admin.initialize_app(cred)
      print("[OK] Firebase Admin SDK initialized with service account.")
    else:
      _firebase_app = firebase_admin.initialize_app()
      print("[OK] Firebase Admin SDK initialized with default credentials.")

  except Exception as e:
    print(f"[WARN] Firebase Admin SDK init failed: {e}. Firebase token verification will be unavailable.")
    _firebase_app = False  # Sentinel to avoid repeated init attempts

  return _firebase_app


def verify_firebase_token(id_token: str) -> dict | None:
  """
  Verify a Firebase ID token and return the decoded claims.
  Returns None if verification fails or Firebase is not configured.
  """
  app = _init_firebase()
  if not app:
    return None

  try:
    from firebase_admin import auth as fb_auth
    decoded = fb_auth.verify_id_token(id_token)
    return decoded
  except Exception as e:
    print(f"[Firebase] Token verification failed: {e}")
    return None


# ─── App-level JWT helpers (unchanged) ────────────────────────

def generate_token(user_id: int, email: str, role: str) -> str:
  payload = {
    "sub":   str(user_id),
    "email": email,
    "role":  role,
    "exp":   datetime.now(timezone.utc) + timedelta(days=EXPIRY),
    "iat":   datetime.now(timezone.utc),
  }
  return jwt.encode(payload, SECRET, algorithm=ALGO)


def decode_token(token: str) -> dict | None:
  try:
    return jwt.decode(token, SECRET, algorithms=[ALGO])
  except jwt.ExpiredSignatureError:
    return None
  except jwt.InvalidTokenError:
    return None


def get_current_user(token: str):
  """Return user row from DB or None."""
  payload = decode_token(token)
  if not payload:
    return None
  db = get_db()
  try:
    user = db.users.find_one({"_id": ObjectId(payload["sub"])})
    if user:
      user["id"] = str(user["_id"])
  except Exception:
    user = None
  return user



def _extract_token():
  auth_header = request.headers.get("Authorization", "")
  if auth_header.startswith("Bearer "):
    return auth_header[7:]
  return request.args.get("token", "")


def require_auth(fn):
  """Decorator: injects current_user or returns 401."""
  @functools.wraps(fn)
  def wrapper(*args, **kwargs):
    token = _extract_token()
    user  = get_current_user(token) if token else None
    if not user:
      return jsonify({"error": "Unauthorized. Please log in."}), 401
    return fn(current_user=user, *args, **kwargs)
  return wrapper


def optional_auth(fn):
  """Decorator: injects current_user (may be None — no 401)."""
  @functools.wraps(fn)
  def wrapper(*args, **kwargs):
    token = _extract_token()
    user  = get_current_user(token) if token else None
    return fn(current_user=user, *args, **kwargs)
  return wrapper


def require_admin(fn):
  """Decorator: requires role='admin'."""
  @functools.wraps(fn)
  def wrapper(*args, **kwargs):
    token = _extract_token()
    user  = get_current_user(token) if token else None
    if not user or user["role"] != "admin":
      return jsonify({"error": "Admin access required."}), 403
    return fn(current_user=user, *args, **kwargs)
  return wrapper
