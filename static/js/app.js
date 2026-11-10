// Leonardo.Ai Studio - Pro Creative Suite Engine v6.0

let currentMode = 'image'; // 'image' | 'video'
let selectedRatio = '1:1';
let selectedDimension = '1024 × 1024';
let selectedStyle = 'Photorealistic';
let batchCount = 1;
let uploadedImageData = null;
let currentImageAnalysis = null;
let currentRefUrl = null;
let inspectorItem = null;
let allCreations = [];
let creationsMap = {};
let currentFilter = 'all';
let tokenBalance = 150;
let selectedFaceBase64 = null;
let restoredFaceUrl = null;

const SAMPLE_PROMPTS = [
  "A hyper-detailed cinematic portrait of an ancient cosmic oracle with glowing violet eyes, star dust drifting, 8k, photoreal, octane render",
  "A majestic cybernetic white tiger with golden mechanical engravings, prowling in a foggy bamboo forest, volumetric sunlight, 35mm lens",
  "Futuristic cyberpunk street market in Neo-Tokyo during rain, reflections in puddles, vibrant holographic advertisements, 35mm lens",
  "An ethereal astronaut floating through an ancient crystal cathedral made of stardust and nebulas, dramatic lighting, masterpiece",
  "Close-up portrait of an elven queen with emerald crown, bioluminescent flora woven in her hair, photorealistic skin texture",
  "A vintage retro sports car racing along a neon synthwave highway toward a colossal digital sun, vaporwave aesthetic, 4k"
];

function safeLucide() {
  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  } catch (err) {
    console.warn("Lucide warning:", err);
  }
}

function toggleMobileSettings() {
  if (currentMode === 'face') {
    switchLeonardoTab('image');
  }
  const rail = document.getElementById('leo-settings-rail');
  const backdrop = document.getElementById('mobile-settings-backdrop');
  if (rail) {
    rail.classList.toggle('mobile-open');
  }
  if (backdrop) {
    backdrop.classList.toggle('active');
  }
  safeLucide();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log("Belzora AI Studio Pro Suite Initialized!");

  // Ensure user session exists (Default to Creator Awais if fresh session)
  let stored = localStorage.getItem('belzora_user') || localStorage.getItem('pixora_user');
  if (!stored) {
    const creatorUser = {
      id: "usr_demo_01",
      name: "Awais Ahmad Bhatti (Creator)",
      email: "demo@belzora.ai",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Awais",
      tokens: 150
    };
    localStorage.setItem('belzora_user', JSON.stringify(creatorUser));
    localStorage.setItem('pixora_user', JSON.stringify(creatorUser));
    stored = JSON.stringify(creatorUser);
  }

  loadUserProfile();
  checkUrlParams();
  setupKeyboardShortcuts();
  fetchCreations();
  updateSmartScrollButton();
  safeLucide();
});

function logoutFromStudio() {
  localStorage.removeItem('belzora_user');
  localStorage.removeItem('pixora_user');
  window.location.replace('/?logout=1');
}

function loadUserProfile() {
  const stored = localStorage.getItem('belzora_user') || localStorage.getItem('pixora_user');
  if (stored) {
    try {
      const user = JSON.parse(stored);
      tokenBalance = user.tokens ?? 150;
      updateTokenDisplay();
      const avatarImg = document.getElementById('sidebar-user-avatar-img');
      if (avatarImg && user.avatar) avatarImg.src = user.avatar;
    } catch (e) {
      console.warn("User load note:", e);
    }
  } else {
    updateTokenDisplay();
  }
}

function updateTokenDisplay() {
  const tokenEl = document.getElementById('token-count');
  if (tokenEl) {
    tokenEl.textContent = `${tokenBalance} TK`;
  }
}

function deductUserTokens(amount = 4) {
  tokenBalance = Math.max(0, tokenBalance - amount);
  updateTokenDisplay();
  const stored = localStorage.getItem('belzora_user') || localStorage.getItem('pixora_user');
  if (stored) {
    try {
      const user = JSON.parse(stored);
      user.tokens = tokenBalance;
      localStorage.setItem('belzora_user', JSON.stringify(user));
      localStorage.setItem('pixora_user', JSON.stringify(user));
      if (user.email) {
        fetch('/api/auth/deduct-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, amount })
        }).catch(e => console.warn("Sync token note:", e));
      }
    } catch (e) {
      console.warn("Deduct note:", e);
    }
  }
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const promptParam = params.get('prompt');
  if (promptParam) {
    const input = document.getElementById('prompt-input');
    if (input) {
      input.value = decodeURIComponent(promptParam);
      input.focus();
    }
  }
  const tabParam = params.get('tab');
  if (tabParam === 'face' || tabParam === 'video' || tabParam === 'image') {
    switchLeonardoTab(tabParam);
  }
}

// Setup Ctrl+Enter shortcut
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      startGeneration();
    }
  });
}

// 1. ADD PROMPT TAG (Prompt Builder Library)
function addPromptTag(tag) {
  const input = document.getElementById('prompt-input');
  if (!input) return;
  const current = input.value.trim();
  if (!current) {
    input.value = tag;
  } else {
    // If not already in prompt, append cleanly
    if (!current.toLowerCase().includes(tag.toLowerCase())) {
      input.value = `${current}, ${tag}`;
    }
  }
  input.focus();
}

function toggleTagDrawer() {
  const drawer = document.getElementById('prompt-tags-drawer');
  if (drawer) {
    drawer.classList.toggle('hidden');
  }
}

// Switch between Image Generation, Motion (Video), and Face Cleaner
function switchLeonardoTab(tab) {
  currentMode = tab;
  const imgBtn = document.getElementById('nav-image-btn');
  const vidBtn = document.getElementById('nav-video-btn');
  const faceBtn = document.getElementById('nav-face-btn');
  const mobileImgBtn = document.getElementById('mobile-nav-image-btn');
  const mobileFaceBtn = document.getElementById('mobile-nav-face-btn');
  const promptTopBar = document.getElementById('prompt-top-bar');
  const galleryFeed = document.getElementById('leo-gallery-feed');
  const facePanel = document.getElementById('face-restore-panel');
  const settingsRail = document.getElementById('leo-settings-rail');
  const backdrop = document.getElementById('mobile-settings-backdrop');
  const railTitle = document.getElementById('rail-title');
  const modelSelect = document.getElementById('model-select');
  const genBtnText = document.getElementById('generate-btn-text');
  const tokenCost = document.getElementById('gen-token-cost');
  const stylePills = document.getElementById('style-pills');

  const defaultBtnClass = "w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-xs transition text-slate-500 hover:text-slate-900 hover:bg-slate-100";
  if (imgBtn) imgBtn.className = defaultBtnClass;
  if (vidBtn) vidBtn.className = defaultBtnClass;
  if (faceBtn) faceBtn.className = defaultBtnClass;

  if (mobileImgBtn) mobileImgBtn.className = "flex flex-col items-center text-slate-500 hover:text-purple-600 transition";
  if (mobileFaceBtn) mobileFaceBtn.className = "flex flex-col items-center text-slate-500 hover:text-pink-600 transition";

  if (tab === 'face') {
    if (faceBtn) faceBtn.className = "w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-xs transition relative bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 text-white shadow-md shadow-pink-500/30";
    if (mobileFaceBtn) mobileFaceBtn.className = "flex flex-col items-center text-pink-600 transition";

    // Hide generator settings rail so Face Cleaner gets full width clean canvas
    if (settingsRail) {
      settingsRail.style.display = 'none';
      settingsRail.classList.remove('mobile-open');
    }
    if (backdrop) backdrop.classList.remove('active');

    if (facePanel) facePanel.classList.remove('hidden');
    if (galleryFeed) galleryFeed.classList.add('hidden');
    if (promptTopBar) promptTopBar.classList.add('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (tab === 'image') {
    if (imgBtn) imgBtn.className = "w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-xs transition relative bg-gradient-to-tr from-purple-600 via-pink-500 to-purple-500 text-white shadow-md shadow-pink-500/30";
    if (mobileImgBtn) mobileImgBtn.className = "flex flex-col items-center text-purple-600 transition";

    // Show generator settings rail
    if (settingsRail) settingsRail.style.display = '';

    if (facePanel) facePanel.classList.add('hidden');
    if (galleryFeed) galleryFeed.classList.remove('hidden');
    if (promptTopBar) promptTopBar.classList.remove('hidden');

    if (railTitle) railTitle.textContent = "IMAGE SETTINGS";
    if (genBtnText) genBtnText.textContent = "Generate";
    if (tokenCost) tokenCost.textContent = "4";
    if (stylePills) stylePills.classList.remove('hidden');

    if (modelSelect) {
      modelSelect.innerHTML = `
        <option value="sdxl" selected>⚡ Belzora Vision XL (SDXL-Lightning • 3s Turbo & Sharp Faces)</option>
        <option value="flux-dev">💎 Belzora Kino XL (FLUX.1 Dev • Ultra Photorealistic 28-Step)</option>
        <option value="flux-schnell">🚀 Belzora Phoenix (FLUX.1 Schnell • 1024 HD)</option>
      `;
    }

    setDimension('1:1', '1024 × 1024');
  } else {
    if (vidBtn) vidBtn.className = "w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-xs transition relative bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30";
    if (mobileImgBtn) mobileImgBtn.className = "flex flex-col items-center text-slate-500 transition";

    // Show generator settings rail
    if (settingsRail) settingsRail.style.display = '';

    if (facePanel) facePanel.classList.add('hidden');
    if (galleryFeed) galleryFeed.classList.remove('hidden');
    if (promptTopBar) promptTopBar.classList.remove('hidden');

    if (railTitle) railTitle.textContent = "MOTION 2.0 SETTINGS";
    if (genBtnText) genBtnText.textContent = "Generate Motion";
    if (tokenCost) tokenCost.textContent = "12";
    if (stylePills) stylePills.classList.add('hidden');

    if (modelSelect) {
      modelSelect.innerHTML = `
        <option value="kling-v1.6">Belzora Motion 2.0 (Cinematic Dynamics)</option>
        <option value="ltx-video">Belzora LTX-Cinematic (4K 60FPS)</option>
        <option value="minimax">Belzora Fluid Dynamics (Realistic Physics)</option>
      `;
    }

    setDimension('16:9', '1280 × 720');
  }

  safeLucide();
}

// Select batch count (1, 2, 3, 4)
function selectBatchCount(count) {
  batchCount = count;
  document.querySelectorAll('.batch-btn').forEach(btn => {
    if (parseInt(btn.getAttribute('data-count')) === count) {
      btn.className = "batch-btn py-1.5 rounded-xl text-xs font-bold bg-white text-purple-700 shadow-sm border border-slate-200";
    } else {
      btn.className = "batch-btn py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900";
    }
  });
  const cost = currentMode === 'image' ? (4 * count) : 12;
  const costEl = document.getElementById('gen-token-cost');
  if (costEl) costEl.textContent = cost;
}

// Dimension / Aspect ratio selector
function setDimension(ratio, label) {
  selectedRatio = ratio;
  selectedDimension = label;
  const dimDisplay = document.getElementById('dimension-display');
  if (dimDisplay) dimDisplay.textContent = label;

  document.querySelectorAll('.ratio-pill').forEach(btn => {
    if (btn.getAttribute('data-ratio') === ratio) {
      btn.className = "ratio-pill active-ratio p-2.5 rounded-2xl border border-purple-500 bg-purple-50 text-purple-700 flex flex-col items-center justify-center transition shadow-sm";
    } else {
      btn.className = "ratio-pill p-2.5 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:border-purple-300 transition flex flex-col items-center justify-center shadow-sm";
    }
  });
}

// Style preset selector
function selectStylePreset(style) {
  selectedStyle = style;
  document.querySelectorAll('.style-pill').forEach(btn => {
    if (btn.getAttribute('data-style') === style) {
      btn.className = "style-pill active-style px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold shadow-sm";
    } else {
      btn.className = "style-pill px-3 py-1 rounded-xl bg-white text-slate-700 hover:border-purple-300 border border-slate-200 font-bold shadow-sm";
    }
  });
}

// Random prompt from sample pool
function randomPrompt() {
  const p = SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)];
  const input = document.getElementById('prompt-input');
  if (input) {
    input.value = p;
    input.focus();
  }
}

function clearPrompt() {
  const input = document.getElementById('prompt-input');
  if (input) input.value = '';
}

// Magic Prompt / AI Enhance
async function enhanceCurrentPrompt() {
  const input = document.getElementById('prompt-input');
  if (!input) return;
  const prompt = input.value.trim();
  if (!prompt) {
    alert("Please type a prompt first before enhancing!");
    return;
  }

  const btn = document.getElementById('enhance-btn');
  if (btn) btn.classList.add('animate-spin');

  try {
    const res = await fetch('/api/prompt-enhance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, type: currentMode })
    });
    const data = await res.json();
    if (data.enhanced_prompt) {
      input.value = data.enhanced_prompt;
    }
  } catch (err) {
    console.error("Enhance error:", err);
  } finally {
    if (btn) btn.classList.remove('animate-spin');
  }
}

// Image upload guidance (Image-to-Image remix)
function triggerFileUpload() {
  const fileInput = document.getElementById('source-file-input');
  if (fileInput) fileInput.click();
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    uploadedImageData = event.target.result;
    const placeholder = document.getElementById('upload-placeholder');
    const previewContainer = document.getElementById('upload-preview-container');
    const previewImg = document.getElementById('upload-preview-img');
    const badge = document.getElementById('img2img-badge');
    const analysisBox = document.getElementById('upload-analysis-container');
    const analysisText = document.getElementById('upload-analysis-text');
    const sliderContainer = document.getElementById('guidance-slider-container');

    if (placeholder) placeholder.classList.add('hidden');
    if (previewContainer) previewContainer.classList.remove('hidden');
    if (previewImg) previewImg.src = uploadedImageData;
    if (badge) badge.classList.remove('hidden');
    if (analysisBox) analysisBox.classList.remove('hidden');
    if (sliderContainer) sliderContainer.classList.remove('hidden');
    if (analysisText) analysisText.innerHTML = '<span class="flex items-center space-x-1.5 text-purple-700 font-semibold"><i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Analyzing photo subjects & details...</span></span>';
    safeLucide();

    const promptInput = document.getElementById('prompt-input');
    if (promptInput && (!promptInput.value.trim() || promptInput.value.includes('photo into'))) {
      promptInput.value = "Transform this photo into an artistic cybernetic masterpiece";
    }

    try {
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: uploadedImageData })
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        currentImageAnalysis = data.analysis;
        currentRefUrl = data.reference_url;
        if (analysisText) {
          analysisText.textContent = `"${data.analysis.slice(0, 160)}..."`;
        }
      }
    } catch (err) {
      console.warn("Vision analysis warning:", err);
      if (analysisText) analysisText.textContent = "Photo loaded & ready for AI remixing.";
    }
    safeLucide();
  };
  reader.readAsDataURL(file);
}

function removeUploadedImage(e) {
  if (e) e.stopPropagation();
  uploadedImageData = null;
  currentImageAnalysis = null;
  currentRefUrl = null;
  const fileInput = document.getElementById('source-file-input');
  const previewContainer = document.getElementById('upload-preview-container');
  const placeholder = document.getElementById('upload-placeholder');
  const badge = document.getElementById('img2img-badge');
  const analysisBox = document.getElementById('upload-analysis-container');
  const sliderContainer = document.getElementById('guidance-slider-container');

  if (fileInput) fileInput.value = '';
  if (previewContainer) previewContainer.classList.add('hidden');
  if (placeholder) placeholder.classList.remove('hidden');
  if (badge) badge.classList.add('hidden');
  if (analysisBox) analysisBox.classList.add('hidden');
  if (sliderContainer) sliderContainer.classList.add('hidden');
}

// MAIN GENERATION FLOW
async function startGeneration() {
  const promptInput = document.getElementById('prompt-input');
  let prompt = promptInput ? promptInput.value.trim() : "";

  // Auto fallback prompt
  if (!prompt && !uploadedImageData) {
    prompt = SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)];
    if (promptInput) promptInput.value = prompt;
  }

  // Show generating status card
  const genCard = document.getElementById('generating-card');
  const genBtn = document.getElementById('generate-btn');
  const progressFill = document.getElementById('gen-progress-fill');
  const progressPercent = document.getElementById('gen-progress-percent');
  const statusTitle = document.getElementById('gen-status-title');
  const statusSub = document.getElementById('gen-status-sub');

  if (genCard) genCard.classList.remove('hidden');
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.classList.add('opacity-70');
  }

  let pct = 15;
  if (progressFill) progressFill.style.width = '15%';
  if (progressPercent) progressPercent.textContent = '15%';

  const ticker = setInterval(() => {
    if (pct < 90) {
      pct += Math.floor(Math.random() * 12) + 6;
      if (pct > 90) pct = 90;
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressPercent) progressPercent.textContent = `${pct}%`;

      if (pct > 35 && pct <= 65) {
        if (statusTitle) statusTitle.textContent = currentMode === 'image' ? "Synthesizing FLUX.1 Neural Latents..." : "Generating Motion Dynamics...";
        if (statusSub) statusSub.textContent = "Calculating neural weights & lighting conditioning";
      } else if (pct > 65) {
        if (statusTitle) statusTitle.textContent = "Upscaling & Texture Refining...";
        if (statusSub) statusSub.textContent = "Applying PhotoReal high dynamic range";
      }
    }
  }, 400);

  const apiToken = localStorage.getItem('lumina_replicate_token') || null;
  const hfToken = localStorage.getItem('lumina_hf_token') || null;

  try {
    let endpoint = currentMode === 'image' ? '/api/generate/image' : '/api/generate/video';
    let payload = {};

    const storedUser = localStorage.getItem('belzora_user') || localStorage.getItem('pixora_user');
    let currentUserId = "usr_demo_01";
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u.id) currentUserId = u.id;
      } catch (e) {}
    }

    const negInput = document.getElementById('negative-prompt');
    const modelSelect = document.getElementById('model-select');

    if (currentMode === 'image') {
      const strengthEl = document.getElementById('guidance-strength');
      const guidanceStrength = strengthEl ? parseFloat(strengthEl.value) / 100 : 0.7;

      payload = {
        prompt: prompt,
        negative_prompt: negInput ? negInput.value : "",
        aspect_ratio: selectedRatio,
        style: selectedStyle,
        model: modelSelect ? modelSelect.value : "sdxl",
        steps: 4,
        image_url: uploadedImageData,
        image_analysis: currentImageAnalysis,
        guidance_strength: guidanceStrength,
        api_key: apiToken,
        hf_token: hfToken,
        user_id: currentUserId
      };
    } else {
      payload = {
        prompt: prompt,
        image_url: uploadedImageData,
        motion_type: "Motion Dynamics",
        duration: 5,
        aspect_ratio: selectedRatio,
        model: modelSelect ? modelSelect.value : "kling-v1.6",
        api_key: apiToken,
        user_id: currentUserId
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || "Generation request failed");
    }

    const item = await res.json();
    deductUserTokens(4);

    clearInterval(ticker);
    if (progressFill) progressFill.style.width = '100%';
    if (progressPercent) progressPercent.textContent = '100%';

    setTimeout(() => {
      if (genCard) genCard.classList.add('hidden');
      fetchCreations();
      openInspector(item);
    }, 400);

  } catch (err) {
    clearInterval(ticker);
    if (genCard) genCard.classList.add('hidden');
    console.error("Generation error:", err);
    alert("Generation notice: " + err.message);
  } finally {
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.classList.remove('opacity-70');
    }
  }
}

// 2. AI 4K UPSCALER ACTION
async function upscaleCurrentCreation() {
  if (!inspectorItem || !inspectorItem.id) return;
  const btn = document.getElementById('inspector-upscale-btn');
  const btnText = document.getElementById('upscale-btn-text');
  const originalText = btnText.textContent;

  btn.disabled = true;
  btnText.textContent = "✨ Restoring Faces & Upscaling to 4K...";

  try {
    const res = await fetch('/api/upscale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inspectorItem.id, factor: 2 })
    });
    const data = await res.json();
    if (data.success) {
      inspectorItem.url = data.url;
      const img = document.getElementById('inspector-img');
      if (img) img.src = data.url;
      const ratioEl = document.getElementById('inspector-ratio');
      if (ratioEl) ratioEl.textContent = data.dimensions || "2048 × 2048 (4K)";
      
      btnText.textContent = "✅ Faces Restored & 4K Super-Res!";
      fetchCreations();
      setTimeout(() => { btnText.textContent = originalText; btn.disabled = false; }, 3000);
    }
  } catch (e) {
    console.error("Upscale error:", e);
    alert("Could not upscale this image right now.");
    btnText.textContent = originalText;
    btn.disabled = false;
  }
}

// 3. 1-CLICK VARIATIONS (MIDJOURNEY GRID)
async function makeVariationsCurrent() {
  if (!inspectorItem) return;
  const btn = document.getElementById('inspector-var-btn');
  const btnText = document.getElementById('var-btn-text');
  const originalText = btnText.textContent;

  btn.disabled = true;
  btnText.textContent = "⏳ Generating 2 Unique Variations...";

  try {
    const storedUser = localStorage.getItem('belzora_user') || localStorage.getItem('pixora_user');
    let currentUserId = "usr_demo_01";
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u.id) currentUserId = u.id;
      } catch (e) {}
    }

    const res = await fetch('/api/generate/variations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: inspectorItem.prompt,
        style: inspectorItem.style || selectedStyle,
        aspect_ratio: inspectorItem.aspect_ratio || selectedRatio,
        count: 2,
        user_id: currentUserId
      })
    });
    const data = await res.json();
    if (data.success && data.variations && data.variations.length > 0) {
      closeInspector();
      fetchCreations();
      openInspector(data.variations[0]);
    }
  } catch (e) {
    console.error("Variations error:", e);
    alert("Could not generate variations right now.");
  } finally {
    btnText.textContent = originalText;
    btn.disabled = false;
  }
}

// 4. FAVORITE / STAR TOGGLE
async function toggleFavorite(id) {
  try {
    const res = await fetch('/api/history/favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      if (creationsMap[id]) {
        creationsMap[id].favorite = data.favorite;
      }
      if (inspectorItem && inspectorItem.id === id) {
        inspectorItem.favorite = data.favorite;
        updateInspectorFavIcon();
      }
      renderGallery();
    }
  } catch (e) {
    console.error("Favorite toggle error:", e);
  }
}

function toggleInspectorFavorite() {
  if (inspectorItem && inspectorItem.id) {
    toggleFavorite(inspectorItem.id);
  }
}

function updateInspectorFavIcon() {
  const favBtn = document.getElementById('inspector-fav-btn');
  if (!favBtn || !inspectorItem) return;
  if (inspectorItem.favorite) {
    favBtn.className = "p-1.5 rounded-xl bg-amber-50 text-amber-500 transition shadow-sm";
  } else {
    favBtn.className = "p-1.5 rounded-xl hover:bg-slate-100 transition text-slate-400 hover:text-amber-500";
  }
}

// 5. DELETE CREATION
async function deleteCreation(id) {
  if (!confirm("Are you sure you want to delete this creation?")) return;
  try {
    const res = await fetch('/api/history/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      delete creationsMap[id];
      allCreations = allCreations.filter(c => c.id !== id);
      renderGallery();
    }
  } catch (e) {
    console.error("Delete error:", e);
  }
}

function deleteInspectorItem() {
  if (!inspectorItem || !inspectorItem.id) return;
  const id = inspectorItem.id;
  closeInspector();
  deleteCreation(id);
}

// Fetch creations from backend history (strictly isolated per user)
async function fetchCreations() {
  try {
    const stored = localStorage.getItem('belzora_user') || localStorage.getItem('pixora_user');
    let historyUrl = '/api/history';
    if (stored) {
      try {
        const u = JSON.parse(stored);
        const uid = u.id || '';
        const uemail = u.email || '';
        historyUrl = `/api/history?user_id=${encodeURIComponent(uid)}&email=${encodeURIComponent(uemail)}`;
      } catch (e) {}
    } else {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        historyUrl = '/api/history?user_id=usr_demo_01&email=demo@belzora.ai';
      }
    }

    const res = await fetch(historyUrl);
    const data = await res.json();
    allCreations = data.history || [];
    
    creationsMap = {};
    allCreations.forEach(item => {
      if (item && item.id) {
        creationsMap[item.id] = item;
      }
    });

    renderGallery();
  } catch (err) {
    console.error("Fetch creations error:", err);
  }
}

// Filter feed gallery (All | Starred | Images | Videos)
function filterGallery(type) {
  currentFilter = type;
  document.querySelectorAll('.feed-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-filter') === type) {
      btn.className = "feed-filter-btn px-3 py-1 rounded-xl bg-purple-100 text-purple-800 border border-purple-300 font-black text-xs shadow-sm";
    } else {
      btn.className = "feed-filter-btn px-3 py-1 rounded-xl bg-white text-slate-600 hover:text-slate-900 border border-slate-200 text-xs font-bold shadow-sm";
    }
  });
  renderGallery();
}

// Render Leonardo Gallery Grid
function renderGallery() {
  const grid = document.getElementById('leo-gallery-grid');
  const emptyState = document.getElementById('empty-state');
  if (!grid) return;

  const filtered = allCreations.filter(item => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'favorite') return Boolean(item.favorite);
    return item.type === currentFilter;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  grid.innerHTML = filtered.map(item => {
    const isVid = item.type === 'video';
    const isFav = Boolean(item.favorite);
    const thumb = isVid ? (item.thumbnail || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80') : item.url;
    
    const safePrompt = (item.prompt || '').replace(/"/g, '&quot;');
    const safeId = item.id || `item_${Math.random()}`;

    return `
      <div class="feed-item group">
        <!-- Thumbnail -->
        <div class="relative w-full aspect-square overflow-hidden bg-slate-100 cursor-pointer" onclick="openInspectorById('${safeId}')">
          <img src="${thumb}" alt="artwork" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
          
          <!-- Top Left Badge -->
          <div class="absolute top-3 left-3 flex items-center space-x-1.5">
            <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${isVid ? 'bg-cyan-600 text-white' : 'bg-pink-600 text-white'} shadow-md">
              ${isVid ? '🎬 Motion' : '🖼️ FLUX.1'}
            </span>
            ${item.is_upscaled ? `<span class="px-2 py-0.5 rounded-lg text-[9px] font-black bg-purple-600 text-white shadow-md">4K</span>` : ''}
            ${item.is_remix ? `<span class="px-2 py-0.5 rounded-lg text-[9px] font-black bg-cyan-500 text-white shadow-md">REMIX</span>` : ''}
          </div>

          <!-- Top Right Actions (Star & Aspect) -->
          <div class="absolute top-3 right-3 flex items-center space-x-1.5">
            <button onclick="event.stopPropagation(); toggleFavorite('${safeId}')" title="${isFav ? 'Unstar' : 'Star Favorite'}" class="p-1 rounded-lg backdrop-blur-md transition ${isFav ? 'bg-amber-400 text-white shadow-md' : 'bg-black/50 text-white hover:text-amber-300'}">
              <i data-lucide="star" class="w-3.5 h-3.5 ${isFav ? 'fill-white' : ''}"></i>
            </button>
            <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/85 text-slate-800 backdrop-blur-md border border-slate-200 shadow-sm">
              ${item.aspect_ratio || '1:1'}
            </span>
          </div>

          <!-- Hover Overlay -->
          <div class="feed-overlay absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/30 to-transparent flex flex-col justify-between p-4">
            <div class="flex justify-end space-x-2">
              <button onclick="event.stopPropagation(); copyPromptById('${safeId}')" title="Copy Prompt" class="p-2 rounded-xl bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition shadow-md">
                <i data-lucide="copy" class="w-4 h-4"></i>
              </button>
              <button onclick="event.stopPropagation(); deleteCreation('${safeId}')" title="Delete" class="p-2 rounded-xl bg-rose-600/60 hover:bg-rose-600 text-white backdrop-blur-md transition shadow-md">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
              <a href="${item.url}" download onclick="event.stopPropagation()" title="Download" class="p-2 rounded-xl bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition shadow-md">
                <i data-lucide="download" class="w-4 h-4"></i>
              </a>
            </div>

            <div>
              <p class="text-xs font-bold text-white line-clamp-2 mb-2 leading-relaxed">${safePrompt}</p>
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-pink-300">${item.style || 'Photoreal'}</span>
                ${!isVid ? `
                  <button onclick="event.stopPropagation(); triggerMotionById('${safeId}')" class="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-[10px] font-black shadow-lg transition">
                    <i data-lucide="film" class="w-3.5 h-3.5"></i>
                    <span>Motion</span>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  safeLucide();
}

// Copy prompt helper by ID
function copyPromptById(id) {
  const item = creationsMap[id];
  if (item && item.prompt) {
    navigator.clipboard.writeText(item.prompt);
    alert("Prompt copied to clipboard!");
  }
}

// Copy Image directly to clipboard (for WhatsApp, Photoshop, Discord paste)
async function copyImageToClipboard() {
  if (!inspectorItem || !inspectorItem.url) return;
  const btnText = document.getElementById('copy-img-btn-text');
  const originalText = btnText ? btnText.textContent : '📋 Copy Image to Clipboard';
  
  try {
    if (btnText) btnText.textContent = '⏳ Copying Image...';
    const response = await fetch(inspectorItem.url);
    const blob = await response.blob();
    
    let pngBlob = blob;
    if (blob.type !== 'image/png') {
      const img = new Image();
      const imgLoadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
      });
      await imgLoadPromise;
      
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    }
    
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': pngBlob })
    ]);
    
    if (btnText) btnText.textContent = '✅ Copied to Clipboard!';
    setTimeout(() => {
      if (btnText) btnText.textContent = originalText;
    }, 2500);
  } catch (err) {
    console.warn("Clipboard copy fallback:", err);
    if (btnText) btnText.textContent = '⚠️ Copy Failed (Use Download)';
    setTimeout(() => {
      if (btnText) btnText.textContent = originalText;
    }, 2500);
  }
}

// Open Inspector by ID
function openInspectorById(id) {
  const item = creationsMap[id];
  if (item) {
    openInspector(item);
  }
}

// Leonardo Image Inspector Modal
function openInspector(item) {
  inspectorItem = item;
  const modal = document.getElementById('inspector-modal');
  const img = document.getElementById('inspector-img');
  const vid = document.getElementById('inspector-video');
  const promptEl = document.getElementById('inspector-prompt');
  const modelEl = document.getElementById('inspector-model');
  const ratioEl = document.getElementById('inspector-ratio');
  const styleEl = document.getElementById('inspector-style');
  const downloadBtn = document.getElementById('inspector-download-btn');
  const motionBtn = document.getElementById('inspector-motion-btn');
  const upscaleBtn = document.getElementById('inspector-upscale-btn');
  const varBtn = document.getElementById('inspector-var-btn');

  if (promptEl) promptEl.textContent = item.prompt || "";
  if (modelEl) modelEl.textContent = item.model || 'FLUX.1-schnell';
  if (ratioEl) ratioEl.textContent = item.dimensions || item.aspect_ratio || '1024 × 1024';
  if (styleEl) styleEl.textContent = item.style || 'Photoreal';
  if (downloadBtn) downloadBtn.href = item.url;

  updateInspectorFavIcon();

  if (item.type === 'video') {
    if (img) img.classList.add('hidden');
    if (vid) {
      vid.classList.remove('hidden');
      vid.src = item.url;
      vid.play();
    }
    if (motionBtn) motionBtn.classList.add('hidden');
    if (upscaleBtn) upscaleBtn.classList.add('hidden');
    if (varBtn) varBtn.classList.add('hidden');
  } else {
    if (vid) vid.classList.add('hidden');
    if (img) {
      img.classList.remove('hidden');
      img.src = item.url;
    }
    if (motionBtn) motionBtn.classList.remove('hidden');
    if (upscaleBtn) upscaleBtn.classList.remove('hidden');
    if (varBtn) varBtn.classList.remove('hidden');
  }

  // Reference image preview in inspector
  const refBox = document.getElementById('inspector-ref-box');
  const refImg = document.getElementById('inspector-ref-img');
  if (item.reference_url) {
    if (refBox) refBox.classList.remove('hidden');
    if (refImg) refImg.src = item.reference_url;
  } else {
    if (refBox) refBox.classList.add('hidden');
  }

  if (modal) modal.classList.remove('hidden');
  safeLucide();
}

function closeInspector() {
  const modal = document.getElementById('inspector-modal');
  if (modal) modal.classList.add('hidden');
  const vid = document.getElementById('inspector-video');
  if (vid) vid.pause();
}

// Animate from inspector
function animateFromInspector() {
  if (!inspectorItem) return;
  closeInspector();
  triggerMotionById(inspectorItem.id);
}

function triggerMotionById(id) {
  const item = creationsMap[id] || inspectorItem;
  if (!item) return;

  switchLeonardoTab('video');
  uploadedImageData = item.url;

  const placeholder = document.getElementById('upload-placeholder');
  const preview = document.getElementById('upload-preview-container');
  const previewImg = document.getElementById('upload-preview-img');
  const promptInput = document.getElementById('prompt-input');

  if (placeholder) placeholder.classList.add('hidden');
  if (preview) preview.classList.remove('hidden');
  if (previewImg) previewImg.src = item.url;
  if (promptInput) promptInput.value = `Cinematic camera motion gliding smoothly across ${item.prompt}`;
}

// API settings modal
function openSettingsModal() {
  const input = document.getElementById('hf-token-input');
  if (input) input.value = localStorage.getItem('lumina_hf_token') || '';
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('hidden');
}

function saveApiSettings() {
  const input = document.getElementById('hf-token-input');
  const token = input ? input.value.trim() : "";
  if (token) {
    localStorage.setItem('lumina_hf_token', token);
  } else {
    localStorage.removeItem('lumina_hf_token');
  }
  closeSettingsModal();
  alert("Settings saved! Free Hugging Face Token active.");
}

// Smart Floating Scroll Button (Single dynamic button: Scroll Down when at top, Scroll Up when scrolled)
let isScrollNearBottom = false;

function updateSmartScrollButton() {
  const scrollBtn = document.getElementById('smart-scroll-btn');
  const downIcon = document.getElementById('smart-scroll-down-icon');
  const upIcon = document.getElementById('smart-scroll-up-icon');
  const scrollText = document.getElementById('smart-scroll-text');
  if (!scrollBtn || !scrollText) return;

  const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;

  // When scrolled down past 320px, switch into "Scroll Up" mode
  if (currentScroll > 320) {
    isScrollNearBottom = true;
    scrollText.textContent = "Scroll Up";
    scrollBtn.title = "Scroll Up";
    if (downIcon) downIcon.classList.add('hidden');
    if (upIcon) upIcon.classList.remove('hidden');
  } else {
    isScrollNearBottom = false;
    scrollText.textContent = "Scroll Down";
    scrollBtn.title = "Scroll Down";
    if (downIcon) downIcon.classList.remove('hidden');
    if (upIcon) upIcon.classList.add('hidden');
  }
}

function handleSmartScroll() {
  const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
  if (isScrollNearBottom || currentScroll > 320) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    const maxScroll = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      document.documentElement.clientHeight * 2
    );
    window.scrollTo({ top: maxScroll, behavior: 'smooth' });
  }
}

function scrollToBottomFeed() {
  handleSmartScroll();
}

function scrollToTopFeed() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Attach scroll listener
window.addEventListener('scroll', () => {
  requestAnimationFrame(updateSmartScrollButton);
}, { passive: true });

// =========================================================================
// 1-CLICK AI FACE CLEANER, BRIGHTENER & NEURAL RESTORER ENGINE
// =========================================================================

function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  const name = (file.name || '').toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.jfif', '.bmp', '.heic', '.heif', '.gif', '.tif', '.tiff'];
  return validExtensions.some(ext => name.endsWith(ext));
}

function loadFaceFile(file) {
  if (!file) return;
  if (!isImageFile(file)) {
    alert("Please upload a valid image file (JPG, PNG, or WEBP).");
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    let result = e.target.result;
    if (result && !result.startsWith('data:image/')) {
      const parts = result.split(',');
      if (parts.length === 2) {
        result = 'data:image/jpeg;base64,' + parts[1];
      }
    }
    selectedFaceBase64 = result;
    const origImg = document.getElementById('face-original-img');
    if (origImg) origImg.src = selectedFaceBase64;

    const uploadZone = document.getElementById('face-upload-zone');
    const previewSection = document.getElementById('face-preview-section');
    if (uploadZone) uploadZone.classList.add('hidden');
    if (previewSection) previewSection.classList.remove('hidden');

    const placeholder = document.getElementById('face-result-placeholder');
    const processView = document.getElementById('face-processing-view');
    const restoredImg = document.getElementById('face-restored-img');
    const downloadBtn = document.getElementById('face-download-btn');
    const cleanBtn = document.getElementById('face-clean-btn');
    const cleanBtnText = document.getElementById('face-clean-btn-text');

    if (placeholder) placeholder.classList.remove('hidden');
    if (processView) processView.classList.add('hidden');
    if (restoredImg) restoredImg.classList.add('hidden');
    if (downloadBtn) downloadBtn.classList.add('hidden');
    if (cleanBtn) {
      cleanBtn.classList.remove('hidden', 'opacity-75', 'cursor-not-allowed');
      cleanBtn.disabled = false;
    }
    if (cleanBtnText) cleanBtnText.textContent = "✨ Clean & Restore Face Now (1-Click)";

    const badge = document.getElementById('face-status-badge');
    if (badge) {
      badge.textContent = 'Ready to Clean';
      badge.className = 'text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600';
    }
    safeLucide();
  };
  reader.onerror = function() {
    alert("Could not read file. Please try another image.");
  };
  reader.readAsDataURL(file);
}

function handleFacePhotoSelect(event) {
  if (event.target && event.target.files && event.target.files[0]) {
    loadFaceFile(event.target.files[0]);
  }
}

function handleFaceDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const zone = document.getElementById('face-upload-zone');
  if (zone) zone.classList.add('border-pink-500', 'bg-pink-100/50');
}

function handleFaceDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const zone = document.getElementById('face-upload-zone');
  if (zone) zone.classList.remove('border-pink-500', 'bg-pink-100/50');
}

function handleFaceDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const zone = document.getElementById('face-upload-zone');
  if (zone) zone.classList.remove('border-pink-500', 'bg-pink-100/50');
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
    loadFaceFile(e.dataTransfer.files[0]);
  }
}

async function loadSampleFacePhoto(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  try {
    const res = await fetch('/static/images/sample_face_demo.jpg?v=' + Date.now());
    if (!res.ok) throw new Error("Could not fetch sample photo");
    const blob = await res.blob();
    const reader = new FileReader();
    reader.onload = function(e) {
      selectedFaceBase64 = e.target.result;
      const origImg = document.getElementById('face-original-img');
      if (origImg) origImg.src = selectedFaceBase64;

      const uploadZone = document.getElementById('face-upload-zone');
      const previewSection = document.getElementById('face-preview-section');
      if (uploadZone) uploadZone.classList.add('hidden');
      if (previewSection) previewSection.classList.remove('hidden');

      const placeholder = document.getElementById('face-result-placeholder');
      const processView = document.getElementById('face-processing-view');
      const restoredImg = document.getElementById('face-restored-img');
      const downloadBtn = document.getElementById('face-download-btn');
      const cleanBtn = document.getElementById('face-clean-btn');
      const cleanBtnText = document.getElementById('face-clean-btn-text');

      if (placeholder) placeholder.classList.remove('hidden');
      if (processView) processView.classList.add('hidden');
      if (restoredImg) restoredImg.classList.add('hidden');
      if (downloadBtn) downloadBtn.classList.add('hidden');
      if (cleanBtn) {
        cleanBtn.classList.remove('hidden', 'opacity-75', 'cursor-not-allowed');
        cleanBtn.disabled = false;
      }
      if (cleanBtnText) cleanBtnText.textContent = "✨ Clean & Restore Face Now (1-Click)";

      const badge = document.getElementById('face-status-badge');
      if (badge) {
        badge.textContent = 'Demo Sample Loaded • Ready to Clean';
        badge.className = 'text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-100 text-pink-700';
      }
      safeLucide();
    };
    reader.readAsDataURL(blob);
  } catch (err) {
    console.warn("Failed to load sample face photo:", err);
    alert("Could not load sample. Please browse a photo from your device.");
  }
}

async function executeFaceRestore() {
  if (!selectedFaceBase64) {
    alert("Please upload or drop a face photo first!");
    return;
  }

  const cleanBtn = document.getElementById('face-clean-btn');
  const cleanBtnText = document.getElementById('face-clean-btn-text');
  const placeholder = document.getElementById('face-result-placeholder');
  const processView = document.getElementById('face-processing-view');
  const processTitle = document.getElementById('face-process-title');
  const processSub = document.getElementById('face-process-sub');
  const progressBar = document.getElementById('face-process-bar');
  const statusBadge = document.getElementById('face-status-badge');
  const restoredImg = document.getElementById('face-restored-img');
  const downloadBtn = document.getElementById('face-download-btn');
  const autoBrighten = document.getElementById('face-auto-brighten') ? document.getElementById('face-auto-brighten').checked : true;

  // Set processing state
  if (cleanBtn) {
    cleanBtn.disabled = true;
    cleanBtn.classList.add('opacity-75', 'cursor-not-allowed');
  }
  if (cleanBtnText) cleanBtnText.textContent = "Cleaning Face with AI...";
  if (placeholder) placeholder.classList.add('hidden');
  if (processView) processView.classList.remove('hidden');
  if (restoredImg) restoredImg.classList.add('hidden');
  if (downloadBtn) downloadBtn.classList.add('hidden');

  if (statusBadge) {
    statusBadge.textContent = 'Neural Processing...';
    statusBadge.className = 'text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 animate-pulse';
  }

  // Animated status progress
  let progress = 15;
  if (progressBar) progressBar.style.width = `${progress}%`;
  
  const progressInterval = setInterval(() => {
    if (progress < 40) {
      progress += 8;
      if (processTitle) processTitle.textContent = "Detecting Facial Landmarks...";
      if (processSub) processSub.textContent = "Aligning eyes, nose, lips and facial contours...";
    } else if (progress < 75) {
      progress += 5;
      if (processTitle) processTitle.textContent = "Neural Pixel Reconstruction...";
      if (processSub) processSub.textContent = "Restoring blurry pupils, eyebrows, teeth & skin texture via CodeFormer...";
    } else if (progress < 92) {
      progress += 2;
      if (processTitle) processTitle.textContent = "Auto-Luminance & 2048px Super-Res...";
      if (processSub) processSub.textContent = "Clearing dark shadows and balancing skin tone vibrancy...";
    }
    if (progressBar) progressBar.style.width = `${progress}%`;
  }, 1100);

  try {
    const userStr = localStorage.getItem('belzora_user') || localStorage.getItem('pixora_user');
    let userId = "usr_demo_01";
    if (userStr) {
      try { userId = JSON.parse(userStr).id || "usr_demo_01"; } catch(e){}
    }

    const response = await fetch('/api/restore-face', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: selectedFaceBase64,
        brighten_face: autoBrighten,
        fidelity: 0.6,
        upscale: 2,
        user_id: userId
      })
    });

    clearInterval(progressInterval);

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.detail || "Face restoration service busy");
    }

    const data = await response.json();
    restoredFaceUrl = data.restored_url;

    if (progressBar) progressBar.style.width = '100%';
    if (processTitle) processTitle.textContent = "Face Restored Successfully!";

    setTimeout(() => {
      if (processView) processView.classList.add('hidden');
      if (restoredImg) {
        restoredImg.src = `${data.restored_url}?t=${Date.now()}`;
        restoredImg.classList.remove('hidden');
      }
      if (downloadBtn) downloadBtn.classList.remove('hidden');
      if (cleanBtn) {
        cleanBtn.disabled = false;
        cleanBtn.classList.remove('opacity-75', 'cursor-not-allowed');
      }
      if (cleanBtnText) cleanBtnText.textContent = "✨ Clean Again (1-Click)";

      if (statusBadge) {
        statusBadge.textContent = '2048px Crystal Clean HD ✨';
        statusBadge.className = 'text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
      }

      // Deduct small token cost for restoration
      deductUserTokens(2);
      // Refresh creation feed so the restored item shows in gallery too
      fetchCreations();
      safeLucide();
    }, 400);

  } catch (err) {
    clearInterval(progressInterval);
    console.error("Face restore error:", err);
    alert("Error restoring face: " + (err.message || "Please try again!"));
    if (processView) processView.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    if (cleanBtn) {
      cleanBtn.disabled = false;
      cleanBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
    if (cleanBtnText) cleanBtnText.textContent = "✨ Try Again";
    if (statusBadge) {
      statusBadge.textContent = 'Error';
      statusBadge.className = 'text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700';
    }
    safeLucide();
  }
}

function downloadRestoredFace() {
  if (!restoredFaceUrl) return;
  const a = document.createElement('a');
  a.href = restoredFaceUrl;
  a.download = `belzora_clean_face_hd_${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function resetFaceRestore() {
  selectedFaceBase64 = null;
  restoredFaceUrl = null;
  const fileInput = document.getElementById('face-file-input');
  if (fileInput) fileInput.value = '';

  const uploadZone = document.getElementById('face-upload-zone');
  const previewSection = document.getElementById('face-preview-section');
  if (uploadZone) uploadZone.classList.remove('hidden');
  if (previewSection) previewSection.classList.add('hidden');

  const placeholder = document.getElementById('face-result-placeholder');
  const processView = document.getElementById('face-processing-view');
  const restoredImg = document.getElementById('face-restored-img');
  const downloadBtn = document.getElementById('face-download-btn');
  const cleanBtn = document.getElementById('face-clean-btn');
  const cleanBtnText = document.getElementById('face-clean-btn-text');

  if (placeholder) placeholder.classList.remove('hidden');
  if (processView) processView.classList.add('hidden');
  if (restoredImg) restoredImg.classList.add('hidden');
  if (downloadBtn) downloadBtn.classList.add('hidden');

  if (cleanBtn) {
    cleanBtn.disabled = false;
    cleanBtn.classList.remove('opacity-75', 'cursor-not-allowed');
  }
  if (cleanBtnText) cleanBtnText.textContent = "✨ Clean & Restore Face Now (1-Click)";
  safeLucide();
}
