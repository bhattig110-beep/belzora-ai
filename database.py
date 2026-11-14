import sqlite3
import json
import time
from pathlib import Path
from typing import List, Optional, Dict, Any

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "belzora.db"
USERS_JSON = BASE_DIR / "users.json"
HISTORY_JSON = BASE_DIR / "history.json"

def get_connection():
    """Returns a SQLite connection with Row factory and WAL mode enabled for high concurrency."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

def init_db():
    """Initializes tables and indexes, then performs seamless JSON migration if needed."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                avatar TEXT,
                tokens INTEGER DEFAULT 150,
                created_at INTEGER
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        
        # 2. Creations / Gallery Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS creations (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                type TEXT DEFAULT 'image',
                prompt TEXT,
                aspect_ratio TEXT,
                style TEXT,
                model TEXT,
                url TEXT NOT NULL,
                reference_url TEXT,
                is_remix INTEGER DEFAULT 0,
                seed INTEGER,
                favorite INTEGER DEFAULT 0,
                is_demo INTEGER DEFAULT 0,
                is_upscaled INTEGER DEFAULT 0,
                dimensions TEXT,
                created_at TEXT
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_creations_created ON creations(created_at DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_creations_favorite ON creations(favorite);")
        conn.commit()

    # Migrate legacy data
    migrate_from_json()

def row_to_user_dict(row: sqlite3.Row) -> dict:
    if not row:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "password_hash": row["password_hash"],
        "avatar": row["avatar"],
        "tokens": int(row["tokens"]),
        "created_at": row["created_at"]
    }

def row_to_creation_dict(row: sqlite3.Row) -> dict:
    if not row:
        return None
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "type": row["type"] or "image",
        "prompt": row["prompt"] or "",
        "aspect_ratio": row["aspect_ratio"] or "1:1",
        "style": row["style"] or "Photorealistic",
        "model": row["model"] or "FLUX.1-schnell",
        "url": row["url"],
        "reference_url": row["reference_url"],
        "is_remix": bool(row["is_remix"]),
        "seed": row["seed"],
        "favorite": bool(row["favorite"]),
        "is_demo": bool(row["is_demo"]),
        "is_upscaled": bool(row["is_upscaled"]),
        "dimensions": row["dimensions"],
        "created_at": row["created_at"]
    }

def migrate_from_json():
    """Migrates users.json and history.json into SQLite with duplicate detection."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Migrate Users
        if USERS_JSON.exists():
            try:
                with open(USERS_JSON, "r", encoding="utf-8") as f:
                    users_data = json.load(f)
                    for u in users_data:
                        cursor.execute("""
                            INSERT OR IGNORE INTO users (id, name, email, password_hash, avatar, tokens, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (
                            u.get("id", f"usr_{int(time.time()*1000)}"),
                            u.get("name", "Creator"),
                            u.get("email", "").strip().lower(),
                            u.get("password_hash", ""),
                            u.get("avatar", "https://api.dicebear.com/7.x/bottts/svg?seed=Belzora"),
                            u.get("tokens", 150),
                            u.get("created_at", int(time.time()*1000))
                        ))
            except Exception as e:
                print(f"[Migration Warning] Users JSON migration: {e}")

        # Ensure demo user exists
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            import hashlib
            default_pass_hash = hashlib.sha256("belzora123".encode("utf-8")).hexdigest()
            cursor.execute("""
                INSERT INTO users (id, name, email, password_hash, avatar, tokens, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                "usr_demo_01",
                "Awais Ahmad Bhatti (Creator)",
                "demo@belzora.ai",
                default_pass_hash,
                "https://api.dicebear.com/7.x/bottts/svg?seed=Awais",
                150,
                int(time.time() * 1000)
            ))

        # Migrate History (from static history_faces, root initial_history.json, and history.json)
        sources_to_migrate = [
            BASE_DIR / "static" / "history_faces" / "initial_history.json",
            BASE_DIR / "initial_history.json",
            HISTORY_JSON
        ]
        for src_path in sources_to_migrate:
            if src_path.exists():
                try:
                    with open(src_path, "r", encoding="utf-8") as f:
                        history_data = json.load(f)
                        for h in history_data:
                            cursor.execute("""
                                INSERT OR REPLACE INTO creations (
                                    id, user_id, type, prompt, aspect_ratio, style, model,
                                    url, reference_url, is_remix, seed, favorite, is_demo,
                                    is_upscaled, dimensions, created_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                h.get("id"),
                                h.get("user_id") or "usr_demo_01",
                                h.get("type", "image"),
                                h.get("prompt", ""),
                                h.get("aspect_ratio", "1:1"),
                                h.get("style", "Photorealistic"),
                                h.get("model", "FLUX.1-schnell"),
                                h.get("url", ""),
                                h.get("reference_url"),
                                1 if h.get("is_remix") else 0,
                                h.get("seed"),
                                1 if h.get("favorite") else 0,
                                1 if h.get("is_demo") else 0,
                                1 if h.get("is_upscaled") else 0,
                                h.get("dimensions"),
                                h.get("created_at")
                            ))
                except Exception as e:
                    print(f"[Migration Warning] History migration from {src_path}: {e}")

        # Ensure all existing creations belong to the creator (usr_demo_01)
        cursor.execute("UPDATE creations SET user_id = 'usr_demo_01' WHERE user_id = 'demo' OR user_id IS NULL")
        conn.commit()

# --- USER OPERATIONS ---

def get_user_by_email(email: str) -> Optional[dict]:
    if not email:
        return None
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1", (email.strip().lower(),))
        row = cursor.fetchone()
        return row_to_user_dict(row)

def get_user_by_id(user_id: str) -> Optional[dict]:
    if not user_id:
        return None
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ? LIMIT 1", (user_id,))
        row = cursor.fetchone()
        return row_to_user_dict(row)

def get_all_users() -> List[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
        return [row_to_user_dict(r) for r in cursor.fetchall()]

def create_user(user_id: str, name: str, email: str, password_hash: str, avatar: str = None, tokens: int = 150) -> dict:
    created_at = int(time.time() * 1000)
    avatar = avatar or f"https://api.dicebear.com/7.x/bottts/svg?seed={name}"
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (id, name, email, password_hash, avatar, tokens, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, name.strip(), email.strip().lower(), password_hash, avatar, tokens, created_at))
        conn.commit()
    return {
        "id": user_id,
        "name": name.strip(),
        "email": email.strip().lower(),
        "password_hash": password_hash,
        "avatar": avatar,
        "tokens": tokens,
        "created_at": created_at
    }

def update_user_tokens(email: str, amount_deducted: int = 4) -> int:
    """Safely and atomically deducts tokens, preventing race conditions."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users 
            SET tokens = MAX(0, tokens - ?)
            WHERE email = ? COLLATE NOCASE
        """, (amount_deducted, email.strip().lower()))
        conn.commit()
        
        cursor.execute("SELECT tokens FROM users WHERE email = ? COLLATE NOCASE", (email.strip().lower(),))
        row = cursor.fetchone()
        return row["tokens"] if row else 150

# --- CREATION & HISTORY OPERATIONS ---

def save_creation(item: dict) -> dict:
    """Saves or replaces a creation record in SQLite atomically."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO creations (
                id, user_id, type, prompt, aspect_ratio, style, model,
                url, reference_url, is_remix, seed, favorite, is_demo,
                is_upscaled, dimensions, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item.get("id"),
            item.get("user_id", "usr_demo_01"),
            item.get("type", "image"),
            item.get("prompt", ""),
            item.get("aspect_ratio", "1:1"),
            item.get("style", "Photorealistic"),
            item.get("model", "FLUX.1-schnell"),
            item.get("url", ""),
            item.get("reference_url"),
            1 if item.get("is_remix") else 0,
            item.get("seed"),
            1 if item.get("favorite") else 0,
            1 if item.get("is_demo") else 0,
            1 if item.get("is_upscaled") else 0,
            item.get("dimensions"),
            item.get("created_at") or time.strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn.commit()
    return item

def is_admin_user(user_id: Optional[str], email: Optional[str]) -> bool:
    uid = (user_id or "").strip().lower()
    em = (email or "").strip().lower()
    admin_ids = {"usr_demo_01", "usr_demo_02", "demo", "admin", "usr_admin", "awais"}
    admin_emails = {"demo@belzora.ai", "demo@pixora.ai", "admin@belzora.ai"}
    if uid in admin_ids or em in admin_emails or "admin" in em or "awais" in em or "bhatti" in em:
        return True
    return False

def get_history(user_id: Optional[str] = None, email: Optional[str] = None, limit: int = 100) -> List[dict]:
    """
    Strict User Privacy & History Isolation:
    - Guests / Unauthenticated visitors: returns [] (Strict Privacy: do not expose private user history).
    - Registered Users (e.g. signup user): returns ONLY creations matching their specific user_id.
    - Admin (Awais Ahmad Bhatti / usr_demo_01 / demo@belzora.ai): returns ALL creations (all 19 face clean items + portfolio AI creations).
    """
    clean_uid = (user_id or "").strip()
    clean_email = (email or "").strip().lower()

    # 1. If NOT logged in / guest: RETURN EMPTY LIST (Strict Privacy: bakiyon ko data nahi dikhana)
    if not clean_uid and not clean_email:
        return []

    with get_connection() as conn:
        cursor = conn.cursor()

        # 2. If Admin / Creator is logged in: SHOW ALL DATA!
        if is_admin_user(clean_uid, clean_email):
            cursor.execute("""
                SELECT * FROM creations 
                ORDER BY created_at DESC LIMIT ?
            """, (limit,))
        else:
            # 3. Specific registered user: STRICTLY their own creations ONLY
            cursor.execute("""
                SELECT * FROM creations 
                WHERE user_id = ?
                ORDER BY created_at DESC LIMIT ?
            """, (clean_uid, limit))

        rows = cursor.fetchall()
        return [row_to_creation_dict(r) for r in rows]

def get_creation_by_id(creation_id: str) -> Optional[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM creations WHERE id = ? LIMIT 1", (creation_id,))
        row = cursor.fetchone()
        return row_to_creation_dict(row)

def toggle_favorite(creation_id: str) -> Optional[bool]:
    """Toggles favorite state atomically in SQLite."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT favorite FROM creations WHERE id = ?", (creation_id,))
        row = cursor.fetchone()
        if not row:
            return None
        current_fav = row["favorite"]
        new_fav = 0 if current_fav else 1
        cursor.execute("UPDATE creations SET favorite = ? WHERE id = ?", (new_fav, creation_id))
        conn.commit()
        return bool(new_fav)

def delete_creation(creation_id: str) -> bool:
    """Deletes a creation record from SQLite."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM creations WHERE id = ?", (creation_id,))
        conn.commit()
        return cursor.rowcount > 0
