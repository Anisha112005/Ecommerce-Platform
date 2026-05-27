"""
auth.py  —  JWT token helpers + auth decorator
"""
import jwt, functools, os
from datetime import datetime, timedelta, timezone
from flask import request, jsonify
from database import get_db
from bson.objectid import ObjectId

SECRET = os.environ.get("JWT_SECRET", "arviz-super-secret-key-2025-ecommerce-platform")
ALGO   = "HS256"
EXPIRY = 7  # days


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
