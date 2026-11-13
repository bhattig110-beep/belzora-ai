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

  // User session initialization (Guest by default, unless logged in)
  let stored = localStorage.getItem('belzora_user') || localStorage.getItem('pixora_user');

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
  const avatarImg = document.getElementById('sidebar-user-avatar-img');
  const logoutBtn = document.getElementById('sidebar-logout-btn');
  const loginBtn = document.getElementById('sidebar-login-btn');

  if (stored) {
    try {
      const user = JSON.parse(stored);
      tokenBalance = user.tokens ?? 150;
      updateTokenDisplay();
      if (avatarImg && user.avatar) avatarImg.src = user.avatar;
      if (logoutBtn) logoutBtn.classList.remove('hidden');
      if (loginBtn) loginBtn.classList.add('hidden');
    } catch (e) {
      console.warn("User load note:", e);
    }
  } else {
    tokenBalance = 0;
    updateTokenDisplay();
    if (avatarImg) avatarImg.src = "https://api.dicebear.com/7.x/bottts/svg?seed=Guest";
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (loginBtn) loginBtn.classList.remove('hidden');
  }
  updateFaceTrialBadge();
}

function updateTokenDisplay() {
  const tokenEl = document.getElementById('token-count');
  const mobTokenEl = document.getElementById('mobile-token-count');
  const stored = localStorage.getItem('belzora_user') || localStorage.getItem('pixora_user');
  
  if (stored) {
    if (tokenEl) tokenEl.textContent = `${tokenBalance} TK`;
    if (mobTokenEl) mobTokenEl.textContent = `${tokenBalance} TK`;
  } else {
    if (tokenEl) tokenEl.textContent = `Guest`;
    if (mobTokenEl) mobTokenEl.textContent = `Guest`;
  }
}

function updateFaceTrialBadge() {
  const stored = localStorage.getItem('belzora_user') || localStorage.getItem('pixora_user');
  const badgeText = document.getElementById('face-token-badge-text');
  const trialBannerAvail = document.getElementById('face-guest-trial-banner');
  const trialBannerExhausted = document.getElementById('face-guest-exhausted-banner');
  const trialUsed = localStorage.getItem('belzora_face_trial_used') === 'true';

  if (stored) {
    if (badgeText) badgeText.textContent = `2 Tokens / Clean (${tokenBalance} TK)`;
    if (trialBannerAvail) trialBannerAvail.classList.add('hidden');
    if (trialBannerExhausted) trialBannerExhausted.classList.add('hidden');
  } else {
    if (trialUsed) {
      if (badgeText) badgeText.textContent = `Trial Used • Sign In (150 TK)`;
      if (trialBannerAvail) trialBannerAvail.classList.add('hidden');
      if (trialBannerExhausted) trialBannerExhausted.classList.remove('hidden');
    } else {
      if (badgeText) badgeText.textContent = `🎁 1 Free Trial (No Login)`;
      if (trialBannerAvail) trialBannerAvail.classList.remove('hidden');
      if (trialBannerExhausted) trialBannerExhausted.classList.add('hidden');
    }
  }
  safeLucide();
}

function handleFaceBadgeClick() {
  const stored = localStorage.getItem('belzora_user') || localStorage.getItem('pixora_user');
  if (!stored) {
    openStudioAuthModal();
  }
}

// STUDIO AUTH MODAL HANDLERS
function openStudioAuthModal(reason = 'default') {
  const modal = document.getElementById('studio-auth-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const badge = document.getElementById('auth-modal-badge');
  const title = document.getElementById('auth-modal-title');
  const sub = document.getElementById('auth-modal-subtitle');

  if (reason === 'trial_exhausted') {
    if (badge) badge.textContent = "1 Free Trial Completed";
    if (title) title.textContent = "Unlock Unlimited Face Cleaning";
    if (sub) sub.innerHTML = 'Aapne 1 free photo trial use kar liya hai! Agli photos clean karne ke liye free account banayein aur <b class="text-purple-600">150 Free Starter Tokens</b> hasil karein.';
  } else {
    if (badge) badge.textContent = "Claim 150 Free Tokens";
    if (title) title.textContent = "Join Belzora AI Studio";
    if (sub) sub.innerHTML = 'Create your free account in 10 seconds to unlock <b class="text-purple-600">150 Free Daily Tokens</b> for 8K FLUX generation and face restoration.';
  }

  const signupErr = document.getElementById('studio-signup-error');
  const loginErr = document.getElementById('studio-login-error');
  if (signupErr) signupErr.classList.add('hidden');
  if (loginErr) loginErr.classList.add('hidden');

  switchStudioAuthTab('signup');
  safeLucide();
}

function closeStudioAuthModal() {
  const modal = document.getElementById('studio-auth-modal');
  if (modal) modal.classList.add('hidden');
}

function switchStudioAuthTab(tab) {
  const signupForm = document.getElementById('studio-signup-form');
  const loginForm = document.getElementById('studio-login-form');
  const signupTab = document.getElementById('auth-tab-signup');
  const loginTab = document.getElementById('auth-tab-login');

  if (tab === 'signup') {
    if (signupForm) signupForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    if (signupTab) signupTab.className = "flex-1 py-2 rounded-xl text-xs font-black bg-white text-purple-700 shadow-sm transition";
    if (loginTab) loginTab.className = "flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition";
  } else {
    if (signupForm) signupForm.classList.add('hidden');
    if (loginForm) loginForm.classList.remove('hidden');
    if (signupTab) signupTab.className = "flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition";
    if (loginTab) loginTab.className = "flex-1 py-2 rounded-xl text-xs font-black bg-white text-purple-700 shadow-sm transition";
  }
}

async function handleStudioSignup(e) {
  e.preventDefault();
  const name = document.getElementById('studio-signup-name').value.trim();
  const email = document.getElementById('studio-signup-email').value.trim();
  const password = document.getElementById('studio-signup-password').value;
  const errorBox = document.getElementById('studio-signup-error');
  const btn = document.getElementById('studio-signup-btn');

  if (!name || !email || !password) return;
  if (btn) { btn.disabled = true; btn.classList.add('opacity-75'); }
  if (errorBox) errorBox.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}` })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.detail || "Signup failed. Please try a different email.");
    }

    localStorage.setItem('belzora_user', JSON.stringify(data.user));
    localStorage.setItem('pixora_user', JSON.stringify(data.user));
    closeStudioAuthModal();
    loadUserProfile();

    if (selectedFaceBase64) {
      setTimeout(() => {
        executeFaceRestore();
      }, 500);
    }
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message || "Failed to create account.";
      errorBox.classList.remove('hidden');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('opacity-75'); }
  }
}

async function handleStudioLogin(e) {
  e.preventDefault();
  const email = document.getElementById('studio-login-email').value.trim();
  const password = document.getElementById('studio-login-password').value;
  const errorBox = document.getElementById('studio-login-error');
  const btn = document.getElementById('studio-login-btn');

  if (!email || !password) return;
  if (btn) { btn.disabled = true; btn.classList.add('opacity-75'); }
  if (errorBox) errorBox.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.detail || "Invalid email or password.");
    }

    localStorage.setItem('belzora_user', JSON.stringify(data.user));
    localStorage.setItem('pixora_user', JSON.stringify(data.user));
    closeStudioAuthModal();
    loadUserProfile();

    if (selectedFaceBase64) {
      setTimeout(() => {
        executeFaceRestore();
      }, 500);
    }
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message || "Login failed.";
      errorBox.classList.remove('hidden');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('opacity-75'); }
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
  const histBtn = document.getElementById('nav-history-btn');
  const mobileImgBtn = document.getElementById('mobile-nav-image-btn');
  const mobileFaceBtn = document.getElementById('mobile-nav-face-btn');
  const mobileHistBtn = document.getElementById('mobile-nav-history-btn');
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
  if (histBtn) histBtn.className = defaultBtnClass;

  if (mobileImgBtn) mobileImgBtn.className = "flex flex-col items-center text-slate-500 hover:text-purple-600 transition";
  if (mobileFaceBtn) mobileFaceBtn.className = "flex flex-col items-center text-slate-500 hover:text-pink-600 transition";
  if (mobileHistBtn) mobileHistBtn.className = "flex flex-col items-center text-slate-500 hover:text-purple-600 transition";

  if (tab === 'history') {
    if (histBtn) histBtn.className = "w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-xs transition relative bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30";
    if (mobileHistBtn) mobileHistBtn.className = "flex flex-col items-center text-purple-600 transition";

    if (settingsRail) settingsRail.style.display = '';
    if (facePanel) facePanel.classList.add('hidden');
    if (galleryFeed) galleryFeed.classList.remove('hidden');
    if (promptTopBar) promptTopBar.classList.remove('hidden');

    filterGallery('all');
    setTimeout(() => {
      if (galleryFeed) galleryFeed.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    safeLucide();
    return;
  }

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

    renderFaceCleanHistory();
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
    
    // Merge all seeded historical clean face photos if not already present
    if (typeof INITIAL_FACE_CLEAN_HISTORY !== 'undefined' && Array.isArray(INITIAL_FACE_CLEAN_HISTORY)) {
      INITIAL_FACE_CLEAN_HISTORY.forEach(initItem => {
        if (!allCreations.some(c => c && c.id === initItem.id)) {
          allCreations.push(initItem);
        }
      });
    }

    creationsMap = {};
    allCreations.forEach(item => {
      if (item && item.id) {
        creationsMap[item.id] = item;
      }
    });

    renderGallery();
    renderFaceCleanHistory();
  } catch (err) {
    console.error("Fetch creations error:", err);
  }
}

// Filter feed gallery (All | Clean Faces | Starred | Images | Videos)
function filterGallery(type) {
  currentFilter = type;
  document.querySelectorAll('.feed-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-filter') === type) {
      btn.className = "feed-filter-btn px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 border border-purple-300 font-black text-xs shadow-sm";
    } else {
      btn.className = "feed-filter-btn px-2.5 py-1 rounded-xl bg-white text-slate-600 hover:text-slate-900 border border-slate-200 text-xs font-bold shadow-sm";
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
    if (currentFilter === 'face_restore') {
      return item.type === 'face_restore' || (item.model && item.model.includes('Face Cleaner')) || (item.id && item.id.startsWith('face_clean_'));
    }
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
    const isFace = item.type === 'face_restore' || (item.model && item.model.includes('Face Cleaner')) || (item.id && item.id.startsWith('face_clean_'));
    const isFav = Boolean(item.favorite);
    const thumb = isVid ? (item.thumbnail || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80') : item.url;
    
    let badgeText = '🖼️ FLUX.1';
    let badgeBg = 'bg-pink-600 text-white';
    if (isVid) {
      badgeText = '🎬 Motion';
      badgeBg = 'bg-cyan-600 text-white';
    } else if (isFace) {
      badgeText = '✨ Clean HD';
      badgeBg = 'bg-gradient-to-r from-pink-600 to-purple-600 text-white';
    }

    const safePrompt = (item.prompt || '').replace(/"/g, '&quot;');
    const safeId = item.id || `item_${Math.random()}`;

    return `
      <div class="feed-item group">
        <!-- Thumbnail -->
        <div class="relative w-full aspect-square overflow-hidden bg-slate-100 cursor-pointer" onclick="openInspectorById('${safeId}')">
          <img src="${thumb}" alt="artwork" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
          
          <!-- Top Left Badge -->
          <div class="absolute top-3 left-3 flex items-center space-x-1.5">
            <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${badgeBg} shadow-md">
              ${badgeText}
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
                ${isFace ? `
                  <button onclick="event.stopPropagation(); loadHistoryItemIntoViewer('${safeId}')" class="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-black shadow-lg transition cursor-pointer">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <span>View Clean</span>
                  </button>
                ` : (!isVid ? `
                  <button onclick="event.stopPropagation(); triggerMotionById('${safeId}')" class="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-[10px] font-black shadow-lg transition">
                    <i data-lucide="film" class="w-3.5 h-3.5"></i>
                    <span>Motion</span>
                  </button>
                ` : '')}
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
// =========================================================================
// 1-CLICK AI FACE CLEANER, BRIGHTENER & NEURAL RESTORER ENGINE
// =========================================================================

function loadFaceFile(file, badgeOptions) {
  if (!file || !file.type.startsWith('image/')) {
    alert("Please upload a valid image file (JPG, PNG, or WEBP).");
    return;
  }

  const applyFaceDataUrl = (dataUrl) => {
    selectedFaceBase64 = dataUrl;
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
      badge.textContent = (badgeOptions && badgeOptions.text) || 'Ready to Clean';
      badge.className = (badgeOptions && badgeOptions.className) || 'text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600';
    }
    safeLucide();
  };

  const reader = new FileReader();
  reader.onload = function(e) {
    const rawDataUrl = e.target.result;
    const maxEdge = 1600;
    const img = new Image();
    img.onload = function() {
      const longest = Math.max(img.width, img.height);
      if (longest > maxEdge || file.size > 1500000) {
        const scale = Math.min(1, maxEdge / (longest || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          applyFaceDataUrl(canvas.toDataURL('image/jpeg', 0.92));
          return;
        }
      }
      applyFaceDataUrl(rawDataUrl);
    };
    img.onerror = function() {
      applyFaceDataUrl(rawDataUrl);
    };
    img.src = rawDataUrl;
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
  if (event) event.stopPropagation();
  try {
    const res = await fetch('/static/images/sample_face_demo.jpg');
    const blob = await res.blob();
    const file = new File([blob], "sample_face_demo.jpg", { type: "image/jpeg" });
    loadFaceFile(file, {
      text: 'Demo Sample Loaded • Ready to Clean',
      className: 'text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-100 text-pink-700'
    });
  } catch (err) {
    console.warn("Failed to load sample face photo:", err);
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

    const payloadStr = JSON.stringify({
      image_base64: selectedFaceBase64,
      brighten_face: autoBrighten,
      fidelity: 0.6,
      upscale: 2,
      user_id: userId
    });

    let response;
    let lastNetworkErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch('/api/restore-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr
        });
        lastNetworkErr = null;
        break;
      } catch (netErr) {
        lastNetworkErr = netErr;
        if (attempt === 0) {
          if (processTitle) processTitle.textContent = "Reconnecting to Belzora AI Server...";
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
    if (lastNetworkErr || !response) {
      throw new Error("Connection interrupted while enhancing. Please try again.");
    }

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

      // Save to local face clean history cache so user never loses it
      try {
        let faceHistory = JSON.parse(localStorage.getItem('belzora_face_clean_history') || '[]');
        const newEntry = {
          id: data.id,
          url: data.restored_url,
          reference_url: data.original_url || selectedFaceBase64,
          dimensions: `${data.width} × ${data.height} HD`,
          created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
          model: "Belzora Neural Face Cleaner HD (CodeFormer)",
          type: "face_restore"
        };
        faceHistory = faceHistory.filter(h => h.id !== data.id);
        faceHistory.unshift(newEntry);
        localStorage.setItem('belzora_face_clean_history', JSON.stringify(faceHistory.slice(0, 50)));
      } catch (e) {}

      // Refresh creation feed so the restored item shows in gallery too
      fetchCreations();
      renderFaceCleanHistory();
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

// =========================================================================
// CLEANED FACES HISTORY MANAGEMENT (Database + Persistent Local Cache)
// =========================================================================

const INITIAL_FACE_CLEAN_HISTORY = [
  {
    "id": "face_clean_woman_id_01",
    "title": "\u2728 Woman ID Photo Restoration",
    "prompt": "\u2728 Woman ID Photo Clean, Reconstruct & HD Brighten",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "4:5",
    "dimensions": "800 \u00d7 1000 HD",
    "url": "/static/history_faces/clean_01_woman_id.jpg",
    "reference_url": "/static/history_faces/orig_01_woman_id.jpg",
    "created_at": "2026-11-13 13:01:38",
    "is_upscaled": true
  },
  {
    "id": "face_clean_blazer_man_02",
    "title": "\u2728 Executive Sitting Blazer Portrait",
    "prompt": "\u2728 Executive Sitting Blazer Portrait \u2022 2048px Crystal Clean HD",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "6:5",
    "dimensions": "600 \u00d7 504 HD",
    "url": "/static/history_faces/clean_02_blazer_man.jpg",
    "reference_url": "/static/history_faces/orig_02_blazer_man.jpg",
    "created_at": "2026-11-11 18:05:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_three_friends_crystal_03",
    "title": "\u2728 3 Friends Full Group (Crystal Clean HD)",
    "prompt": "\u2728 3 Friends Traditional Shalwar Kameez Portrait \u2022 Crystal Clean & Smooth HD",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "16:9",
    "dimensions": "2048 \u00d7 1152 Ultra HD",
    "url": "/static/history_faces/clean_03_three_friends_crystal.jpg",
    "reference_url": "/static/history_faces/orig_03_three_friends.jpg",
    "created_at": "2026-11-10 17:00:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_three_friends_ultra_04",
    "title": "\u2728 3 Friends Full Group (Remini Pro Ultra-Sharp)",
    "prompt": "\u2728 Remini Pro Ultra-Sharp \u2022 Deep Eye & Beard Facial Precision",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "16:9",
    "dimensions": "2048 \u00d7 1152 Ultra HD",
    "url": "/static/history_faces/clean_04_three_friends_ultra.jpg",
    "reference_url": "/static/history_faces/orig_04_three_friends.jpg",
    "created_at": "2026-11-10 16:55:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_three_friends_yesterday_05",
    "title": "\u2728 3 Friends First Restored Masterpiece",
    "prompt": "\u2728 3 Friends Original First Restored Masterpiece \u2022 Warm Natural Tone",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "2:1",
    "dimensions": "2048 \u00d7 1052 HD",
    "url": "/static/history_faces/clean_05_three_friends_yesterday.jpg",
    "reference_url": "/static/history_faces/orig_05_three_friends.jpg",
    "created_at": "2026-11-09 23:30:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_three_friends_codeformer_06",
    "title": "\u2728 3 Friends True Aligned Neural Clean",
    "prompt": "\u2728 CodeFormer True Aligned Multi-Face Reconstruction 2048px",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "16:9",
    "dimensions": "2048 \u00d7 1152 Ultra HD",
    "url": "/static/history_faces/clean_06_three_friends_codeformer.jpg",
    "reference_url": "/static/history_faces/orig_06_three_friends.jpg",
    "created_at": "2026-11-10 16:40:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_center_man_detail_07",
    "title": "\u2728 Center Man Beard & Eye Detail",
    "prompt": "\u2728 Center Man Facial Landmark & Beard Precision Neural Restore",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "1:1",
    "dimensions": "1024 \u00d7 1024 HD",
    "url": "/static/history_faces/clean_07_center_man_detail.jpg",
    "reference_url": "/static/history_faces/orig_07_center_man.jpg",
    "created_at": "2026-11-10 16:15:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_left_man_detail_08",
    "title": "\u2728 Left Man Blue Shalwar Kameez Detail",
    "prompt": "\u2728 Left Man Traditional Shalwar Kameez Portrait Detail Restore",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "1:1",
    "dimensions": "1024 \u00d7 1024 HD",
    "url": "/static/history_faces/clean_08_left_man_detail.jpg",
    "reference_url": "/static/history_faces/orig_08_left_man.jpg",
    "created_at": "2026-11-10 16:10:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_right_man_detail_09",
    "title": "\u2728 Right Man Executive Black Coat Detail",
    "prompt": "\u2728 Right Man Executive Black Coat Portrait Detail Restore",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "1:1",
    "dimensions": "1024 \u00d7 1024 HD",
    "url": "/static/history_faces/clean_09_right_man_detail.jpg",
    "reference_url": "/static/history_faces/orig_09_right_man.jpg",
    "created_at": "2026-11-10 16:12:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_all_3_faces_zoom_10",
    "title": "\u2728 All 3 Faces 2.5x Zoom Comparison",
    "prompt": "\u2728 All 3 Faces 2.5x Close-Up Comparative Neural Inspection",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "16:10",
    "dimensions": "1640 \u00d7 1040 HD",
    "url": "/static/history_faces/clean_10_all_3_faces_zoom.jpg",
    "reference_url": "/static/history_faces/orig_10_all_3_faces_orig.jpg",
    "created_at": "2026-11-10 16:35:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_three_friends_live_11",
    "title": "\u2728 3 Friends Live Production Enhanced",
    "prompt": "\u2728 Belzora AI Live Production 2048px Full Restoration",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "2:1",
    "dimensions": "2048 \u00d7 1052 HD",
    "url": "/static/history_faces/clean_11_three_friends_live.jpg",
    "reference_url": "/static/history_faces/orig_11_three_friends.jpg",
    "created_at": "2026-11-10 16:30:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_demo_model_12",
    "title": "\u2728 Belzora Model Demo Portrait",
    "prompt": "\u2728 Belzora Model Demo Portrait \u2022 2048px Crystal Clean HD",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "1:1",
    "dimensions": "1536 \u00d7 1536 HD",
    "url": "/static/history_faces/clean_12_demo_model.jpg",
    "reference_url": "/static/history_faces/orig_12_demo_model.jpg",
    "created_at": "2026-11-09 22:30:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_deep_codeformer_13",
    "title": "\u2728 Neural Deep CodeFormer 2048px Master",
    "prompt": "\u2728 CodeFormer High-Fidelity Deep Neural Face Restoration",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "1:1",
    "dimensions": "2048 \u00d7 2048 Ultra HD",
    "url": "/static/history_faces/clean_13_deep_codeformer.jpg",
    "reference_url": "/static/history_faces/orig_13_deep_codeformer.jpg",
    "created_at": "2026-11-10 15:50:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_belzora_pro_14",
    "title": "\u2728 Belzora Pro Complete Enhanced",
    "prompt": "\u2728 Belzora Pro Multi-Pass Facial & Background Clarity Master",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "2:1",
    "dimensions": "2048 \u00d7 1052 HD",
    "url": "/static/history_faces/clean_14_belzora_pro.jpg",
    "reference_url": "/static/history_faces/orig_14_belzora_pro.jpg",
    "created_at": "2026-11-10 15:40:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_pass1_15",
    "title": "\u2728 Neural Clean Studio Pass 1",
    "prompt": "\u2728 Neural Cleaner Automatic Eye & Skin Luminance Pass 1",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "2:1",
    "dimensions": "2048 \u00d7 1052 HD",
    "url": "/static/history_faces/clean_15_pass1.jpg",
    "reference_url": "/static/history_faces/orig_15_pass1.jpg",
    "created_at": "2026-11-10 15:20:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_pass2_16",
    "title": "\u2728 Neural Clean Studio Pass 2",
    "prompt": "\u2728 Neural Cleaner Automatic Eye & Skin Luminance Pass 2",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "2:1",
    "dimensions": "2048 \u00d7 1052 HD",
    "url": "/static/history_faces/clean_16_pass2.jpg",
    "reference_url": "/static/history_faces/orig_16_pass2.jpg",
    "created_at": "2026-11-10 15:25:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_test_studio_17",
    "title": "\u2728 Studio Complete Enhance 2048px",
    "prompt": "\u2728 Belzora Neural Studio Complete Dynamic Range Enhance",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "2:1",
    "dimensions": "2048 \u00d7 1052 HD",
    "url": "/static/history_faces/clean_17_test_studio.jpg",
    "reference_url": "/static/history_faces/orig_17_test_studio.jpg",
    "created_at": "2026-11-10 15:15:00",
    "is_upscaled": true
  },
  {
    "id": "face_clean_studio_comparison_18",
    "title": "\u2728 Studio 3 Faces Facial Grid Comparison",
    "prompt": "\u2728 3 Faces Neural Grid Inspection & Comparison View",
    "model": "Belzora Neural Face Cleaner HD (CodeFormer)",
    "style": "PhotoReal Clear & Bright",
    "type": "face_restore",
    "aspect_ratio": "6:5",
    "dimensions": "1720 \u00d7 1440 HD",
    "url": "/static/history_faces/clean_18_studio_comparison.jpg",
    "reference_url": "/static/history_faces/orig_18_studio_comparison.jpg",
    "created_at": "2026-11-10 15:10:00",
    "is_upscaled": true
  }
];

function renderFaceCleanHistory() {
  const grid = document.getElementById('face-clean-history-grid');
  const emptyState = document.getElementById('face-clean-history-empty');
  const countBadge = document.getElementById('face-history-count');
  if (!grid) return;

  let localCache = [];
  try {
    localCache = JSON.parse(localStorage.getItem('belzora_face_clean_history') || '[]');
  } catch (e) {}

  const backendFaceItems = (allCreations || []).filter(item => {
    return item && (item.type === 'face_restore' || (item.model && item.model.includes('Face Cleaner')) || (item.id && String(item.id).startsWith('face_clean_')));
  });

  const map = new Map();
  // 1. Seeded historical images from project start
  INITIAL_FACE_CLEAN_HISTORY.forEach(item => { if (item && item.id) map.set(item.id, item); });
  // 2. Database items
  backendFaceItems.forEach(item => { if (item && item.id) map.set(item.id, item); });
  // 3. Client session cache
  localCache.forEach(item => { if (item && item.id) map.set(item.id, item); });

  const faceItems = Array.from(map.values()).sort((a, b) => {
    const tA = new Date(a.created_at || a.timestamp || 0).getTime();
    const tB = new Date(b.created_at || b.timestamp || 0).getTime();
    return tB - tA;
  });

  if (countBadge) {
    countBadge.textContent = `${faceItems.length} Photo${faceItems.length === 1 ? '' : 's'}`;
  }

  if (faceItems.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  grid.innerHTML = faceItems.map(item => {
    const cleanUrl = item.url;
    const dateStr = item.created_at ? item.created_at.split(' ')[0] : 'Recent';
    const dims = item.dimensions || '2048px HD';
    const safeId = item.id;

    return `
      <div class="group relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-xl transition-all duration-300">
        <!-- Thumbnail -->
        <div class="relative aspect-square w-full bg-slate-100 overflow-hidden cursor-pointer" onclick="loadHistoryItemIntoViewer('${safeId}')">
          <img src="${cleanUrl}" alt="Restored Face" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
          
          <!-- Top Badge -->
          <div class="absolute top-2 left-2 flex items-center space-x-1">
            <span class="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-600/90 text-white backdrop-blur-md shadow-sm">
              ✨ ${dims}
            </span>
          </div>

          <!-- Quick Action Hover -->
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
            <div class="flex items-center justify-between text-white text-[10px] font-bold">
              <span>${dateStr}</span>
              <span class="bg-white/20 px-2 py-0.5 rounded backdrop-blur-md">Click to View</span>
            </div>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="p-2.5 flex items-center justify-between bg-slate-50 border-t border-slate-100">
          <button onclick="loadHistoryItemIntoViewer('${safeId}')" class="text-[11px] font-black text-pink-600 hover:text-pink-700 flex items-center space-x-1 cursor-pointer">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            <span>Compare</span>
          </button>
          
          <div class="flex items-center space-x-1">
            <a href="${cleanUrl}" download="belzora_clean_${safeId}.png" onclick="event.stopPropagation()" title="Download HD" class="p-1 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
            </a>
            <button onclick="deleteFaceCleanHistoryItem('${safeId}', event)" title="Delete" class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  safeLucide();
}

function loadHistoryItemIntoViewer(itemId) {
  let item = (creationsMap || {})[itemId];
  if (!item && typeof INITIAL_FACE_CLEAN_HISTORY !== 'undefined') {
    item = INITIAL_FACE_CLEAN_HISTORY.find(x => x.id === itemId);
  }
  if (!item) {
    try {
      const localCache = JSON.parse(localStorage.getItem('belzora_face_clean_history') || '[]');
      item = localCache.find(x => x.id === itemId);
    } catch(e) {}
  }
  if (!item) return;

  if (currentMode !== 'face') {
    switchLeonardoTab('face');
  }

  restoredFaceUrl = item.url;
  selectedFaceBase64 = item.reference_url || item.url;

  const origImg = document.getElementById('face-original-img');
  const restoredImg = document.getElementById('face-restored-img');
  const uploadZone = document.getElementById('face-upload-zone');
  const previewSection = document.getElementById('face-preview-section');
  const placeholder = document.getElementById('face-result-placeholder');
  const processView = document.getElementById('face-processing-view');
  const downloadBtn = document.getElementById('face-download-btn');
  const cleanBtn = document.getElementById('face-clean-btn');
  const cleanBtnText = document.getElementById('face-clean-btn-text');
  const statusBadge = document.getElementById('face-status-badge');

  if (origImg) origImg.src = item.reference_url || item.url;
  if (restoredImg) {
    restoredImg.src = item.url;
    restoredImg.classList.remove('hidden');
  }
  if (uploadZone) uploadZone.classList.add('hidden');
  if (previewSection) previewSection.classList.remove('hidden');
  if (placeholder) placeholder.classList.add('hidden');
  if (processView) processView.classList.add('hidden');
  if (downloadBtn) downloadBtn.classList.remove('hidden');
  if (cleanBtn) {
    cleanBtn.classList.remove('hidden', 'opacity-75', 'cursor-not-allowed');
    cleanBtn.disabled = false;
  }
  if (cleanBtnText) cleanBtnText.textContent = "✨ Clean Again (1-Click)";
  if (statusBadge) {
    statusBadge.textContent = '2048px Crystal Clean HD ✨';
    statusBadge.className = 'text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
  }

  const topPanel = document.getElementById('face-restore-panel');
  if (topPanel) {
    topPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  safeLucide();
}

async function deleteFaceCleanHistoryItem(id, event) {
  if (event) event.stopPropagation();
  if (!confirm("Are you sure you want to remove this cleaned photo from history?")) return;

  try {
    let localCache = JSON.parse(localStorage.getItem('belzora_face_clean_history') || '[]');
    localCache = localCache.filter(item => item.id !== id);
    localStorage.setItem('belzora_face_clean_history', JSON.stringify(localCache));
  } catch(e) {}

  try {
    await fetch('/api/history/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  } catch(e) {}

  allCreations = (allCreations || []).filter(item => item.id !== id);
  if (creationsMap) delete creationsMap[id];

  renderFaceCleanHistory();
  renderGallery();
}
