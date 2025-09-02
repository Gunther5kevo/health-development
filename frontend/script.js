// =======================
// script.js (Fixed Navigation + Markdown Support + Enhanced Emergency Protocols)
// =======================

import { API, UTILS } from "./config.js";
let currentUser = null;
let userProgress = {};
let navigationHistory = [];

// -----------------------
// Tab Navigation (FIXED)
// -----------------------
function showSection(sectionId, skipHistory = false) {
  // Hide all sections
  document.querySelectorAll(".section").forEach((s) => {
    s.classList.remove("active");
  });
  
  // Hide module view specifically
  const moduleView = document.getElementById("module-view");
  if (moduleView) {
    moduleView.classList.remove("active");
    moduleView.hidden = true;
  }
  
  // Remove active from all tabs
  document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
  
  // Show target section
  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add("active");
    if (target.id === "module-view") {
      target.hidden = false;
    }
  }
  
  // Highlight correct tab
  const tab = document.querySelector(`.nav-tab[data-section="${sectionId}"]`);
  if (tab) tab.classList.add("active");
  
  // Update URL hash without triggering popstate
  if (!skipHistory) {
    const desiredHash = `#${sectionId}`;
    if (location.hash !== desiredHash) {
      history.pushState({ section: sectionId, timestamp: Date.now() }, "", desiredHash);
    }
  }
  
  // Initialize section-specific content
  if (sectionId === "community" && !document.getElementById("community-content")) {
    initializeCommunity();
  } else if (sectionId === "ai-assistant" && !chatInitialized) {
    initializeAIChat();
  }
  
  trackPageView(sectionId);
}

document.addEventListener("DOMContentLoaded", async () => {
  await initializeApp();
  setupEventListeners();
  animateProgressBars();
  checkUrlHash();
});

// -----------------------
// Initialization
// -----------------------
async function initializeApp() {
  console.log("HealthGuide Community App Initialized");
  await loadUserData();
  await loadTrainingModules();
  updateDashboardStats();
  checkNotifications();
}

// -----------------------
// Training with Markdown Support
// -----------------------
async function loadTrainingModules() {
  try {
    const token = UTILS.getFromLocal("auth_token");
    if (!token) {
      console.log("No auth token. Skipping /training/modules fetch.");
      return;
    }
    const data = await API.getTrainingModules();
    if (data?.modules) updateTrainingSection(data.modules);
  } catch (e) {
    console.log("Failed to load training modules:", e.message);
  }
}

function updateTrainingSection(modules) {
  const trainingSection = document.getElementById("training");
  if (!trainingSection) return;
  trainingSection.innerHTML = "";

  modules.forEach((module) => {
    const identifier = module?.id ?? module?.slug;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${module.title}</h3>
      <p>${module.description || "Training module for health workers."}</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${
          module.completed ? "100%" : "0%"
        }"></div>
      </div>
      <button class="btn"
        data-module-id="${identifier ?? ""}"
        data-module-slug="${module?.slug ?? ""}">
        ${module.completed ? "✓ Completed" : "Start Module"}
      </button>
    `;
    trainingSection.appendChild(card);
  });
}

async function startTrainingModule(button) {
  const token = UTILS.getFromLocal("auth_token");
  if (!token) {
    UTILS.showNotification("Please log in to view modules.", "warning");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
    return;
  }
  
  const identifier = button.dataset.moduleId || button.dataset.moduleSlug;
  if (!identifier) {
    UTILS.showNotification("This module has no identifier. Please refresh.", "warning");
    return;
  }
  
  showLoading(button);
  
  try {
    const res = await API.get(`/training/modules/${encodeURIComponent(identifier)}`);
    if (!res?.content) throw new Error("Module not found");
    showModule(res, identifier);
  } catch (error) {
    // Use enhanced error handler
    if (!handleApiError(error, "Load training module")) {
      UTILS.showNotification("Error loading module: " + error.message, "error");
    }
  } finally {
    hideLoading(button);
  }
}

function showModule(module, identifier = "") {
  const moduleView = document.getElementById("module-view");
  if (!moduleView) return;

  // Parse markdown content if marked is available
  let renderedContent = module.content;
  if (typeof marked !== "undefined" && marked.parse) {
    try {
      marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false,
      });
      renderedContent = marked.parse(module.content);
    } catch (e) {
      console.log("Markdown parsing failed, using raw content");
      renderedContent = `<pre>${module.content}</pre>`;
    }
  }

  moduleView.innerHTML = `
    <div class="card module-card">
      <div class="module-header">
        <h2>${module.title}</h2>
        <p class="module-description">${module.description || ""}</p>
      </div>
      <div class="module-body markdown-content">${renderedContent}</div>
      <div class="module-footer">
        <button class="btn btn-secondary" id="back-to-training">← Back to Training</button>
        ${module.quiz ? `<button class="btn" id="take-quiz">Take Quiz</button>` : ""}
        <button class="btn btn-primary" id="mark-complete">Mark as Complete</button>
      </div>
    </div>
  `;

  // Hide all sections
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));

  // Show module view
  moduleView.hidden = false;
  moduleView.classList.add("active");

  // Keep training tab highlighted
  document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
  const trainingTab = document.querySelector('.nav-tab[data-section="training"]');
  if (trainingTab) trainingTab.classList.add("active");

  // Update history with module-specific URL
  const modHash = `#training/${encodeURIComponent(
    identifier || module.slug || module.id || "module"
  )}`;
  history.pushState(
    { section: "module-view", moduleId: identifier, timestamp: Date.now() },
    "",
    modHash
  );

  // Event listeners
  document.getElementById("back-to-training")?.addEventListener("click", () => {
    history.back();
  });

  // ✅ Simplified Mark Complete functionality (Option 1)
  document.getElementById("mark-complete")?.addEventListener("click", async () => {
    const markCompleteBtn = document.getElementById("mark-complete");

    const token = UTILS.getFromLocal("auth_token");
    if (!token) {
      UTILS.showNotification("Please log in to mark modules as complete.", "error");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
      return;
    }

    markCompleteBtn.disabled = true;
    markCompleteBtn.textContent = "Marking...";

    try {
      const moduleId = identifier || module.slug || module.id;
      const success = await API.markModuleComplete(moduleId, module.title);

      if (success) {
        // Update local state
        if (currentUser) {
          currentUser.completedModules = (currentUser.completedModules || 0) + 1;
          currentUser.progress = Math.round(
            (currentUser.completedModules / currentUser.totalModules) * 100
          );
          updateUserInterface();
          updateDashboardStats();
        }

        // Update button state
        markCompleteBtn.innerHTML = "✓ Completed";
        markCompleteBtn.classList.add("completed");
        markCompleteBtn.disabled = true;

        // Auto-redirect back to training after 2 seconds
        setTimeout(() => {
          showSection("training");
          loadTrainingModules();
        }, 2000);
      } else {
        throw new Error("Unable to mark module as complete. Please try again later.");
      }
    } catch (error) {
      console.error("Mark complete error:", error);
      const errorMessage = error?.message || "Unknown error occurred";
      UTILS.showNotification(`Failed to mark as complete: ${errorMessage}`, "error");
      markCompleteBtn.disabled = false;
      markCompleteBtn.textContent = "Mark as Complete";
    }
  });

  document.getElementById("take-quiz")?.addEventListener("click", () => {
    showQuiz(module.quiz);
  });
}




// -----------------------
// Enhanced Emergency Protocols
// -----------------------
function showEmergencyProtocols() {
  const modal = document.createElement("div");
  modal.className = "emergency-modal";
  modal.innerHTML = `
    <div class="emergency-content">
      <h2>🚨 Emergency Protocols</h2>
      
      <div class="emergency-tabs">
        <button class="emergency-tab active" data-protocol="general">General Emergency</button>
        <button class="emergency-tab" data-protocol="cardiac">Cardiac Arrest</button>
        <button class="emergency-tab" data-protocol="bleeding">Severe Bleeding</button>
        <button class="emergency-tab" data-protocol="choking">Choking</button>
        <button class="emergency-tab" data-protocol="burns">Burns</button>
      </div>
      
      <div id="protocol-content" class="protocol-content">
        <div class="protocol-section active" data-protocol="general">
          <h3>General Emergency Response</h3>
          <ol class="protocol-steps">
            <li><strong>Ensure Safety:</strong> Check the scene for safety hazards before approaching</li>
            <li><strong>Call Emergency Services:</strong> Dial local emergency number immediately</li>
            <li><strong>Assess the Patient:</strong>
              <ul>
                <li>Check responsiveness (tap and shout)</li>
                <li>Check breathing (look, listen, feel)</li>
                <li>Check for severe bleeding</li>
              </ul>
            </li>
            <li><strong>Provide Care:</strong> Administer appropriate first aid based on condition</li>
            <li><strong>Monitor:</strong> Stay with patient, monitor vital signs</li>
            <li><strong>Document:</strong> Record time, symptoms, and actions taken</li>
          </ol>
        </div>
        
        <div class="protocol-section" data-protocol="cardiac">
          <h3>Cardiac Arrest Protocol</h3>
          <ol class="protocol-steps">
            <li><strong>Call for Help:</strong> Shout for assistance and call emergency services</li>
            <li><strong>Position Patient:</strong> Place on firm, flat surface</li>
            <li><strong>Start CPR:</strong>
              <ul>
                <li>30 chest compressions (2 inches deep, 100-120/min)</li>
                <li>2 rescue breaths</li>
                <li>Continue 30:2 ratio</li>
              </ul>
            </li>
            <li><strong>Use AED if Available:</strong> Follow device prompts</li>
            <li><strong>Continue Until:</strong> Help arrives or patient responds</li>
          </ol>
        </div>
        
        <div class="protocol-section" data-protocol="bleeding">
          <h3>Severe Bleeding Control</h3>
          <ol class="protocol-steps">
            <li><strong>Apply Direct Pressure:</strong> Use clean cloth/gauze, press firmly</li>
            <li><strong>Elevate:</strong> Raise injured area above heart if possible</li>
            <li><strong>Pressure Points:</strong> Apply pressure to artery if needed</li>
            <li><strong>Tourniquet:</strong> Last resort for life-threatening limb bleeding</li>
            <li><strong>Monitor:</strong> Watch for shock symptoms</li>
          </ol>
        </div>
        
        <div class="protocol-section" data-protocol="choking">
          <h3>Choking Response</h3>
          <ol class="protocol-steps">
            <li><strong>Assess:</strong> Ask "Are you choking?" Look for universal sign</li>
            <li><strong>For Conscious Adult:</strong>
              <ul>
                <li>5 back blows between shoulder blades</li>
                <li>5 abdominal thrusts (Heimlich maneuver)</li>
                <li>Repeat until object dislodges</li>
              </ul>
            </li>
            <li><strong>If Unconscious:</strong> Begin CPR</li>
          </ol>
        </div>
        
        <div class="protocol-section" data-protocol="burns">
          <h3>Burn Treatment</h3>
          <ol class="protocol-steps">
            <li><strong>Stop Burning:</strong> Remove from heat source</li>
            <li><strong>Cool Burn:</strong> Run cool (not ice) water for 10-20 minutes</li>
            <li><strong>Remove Jewelry:</strong> Before swelling begins</li>
            <li><strong>Cover:</strong> Use clean, dry cloth or sterile gauze</li>
            <li><strong>Do NOT:</strong> Apply ice, butter, or ointments</li>
          </ol>
        </div>
      </div>
      
      <div class="emergency-footer">
        <button class="btn btn-primary" id="close-emergency">Close</button>
        <button class="btn" id="print-protocols">Print Protocols</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Tab switching
  modal.querySelectorAll(".emergency-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      modal.querySelectorAll(".emergency-tab").forEach(t => t.classList.remove("active"));
      modal.querySelectorAll(".protocol-section").forEach(s => s.classList.remove("active"));
      
      tab.classList.add("active");
      modal.querySelector(`.protocol-section[data-protocol="${tab.dataset.protocol}"]`).classList.add("active");
    });
  });
  
  // Close modal
  document.getElementById("close-emergency").addEventListener("click", () => {
    modal.remove();
  });
  
  // Print functionality
  document.getElementById("print-protocols").addEventListener("click", () => {
    window.print();
  });
  
  // Close on escape key
  const escapeHandler = (e) => {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", escapeHandler);
    }
  };
  document.addEventListener("keydown", escapeHandler);
}

// -----------------------
// User Data
// -----------------------
async function loadUserData() {
  const token = UTILS.getFromLocal("auth_token");
  if (!token) {
    showLoginPrompt();
    updateAuthButtons(false);
    return;
  }
  await refreshProfileFromBackend();
  updateAuthButtons(true);
}

function showLoginPrompt() {
  const header = document.querySelector(".header");
  if (header && !header.querySelector(".login-prompt")) {
    const div = document.createElement("div");
    div.className = "login-prompt";
    div.innerHTML = `<p>Please <a href="login.html">log in</a> to access your personalized dashboard.</p>`;
    header.appendChild(div);
  }
}

function updateAuthButtons(isLoggedIn) {
  const authButtons = document.getElementById("auth-buttons");
  if (!authButtons) return;

  if (isLoggedIn) {
    authButtons.innerHTML = `
      <button class="btn btn-secondary" id="logout-btn">Logout</button>
    `;
    document
      .getElementById("logout-btn")
      .addEventListener("click", handleLogout);
  } else {
    authButtons.innerHTML = `
      <a href="login.html" class="btn btn-secondary">Login</a>
      <a href="signup.html" class="btn">Sign Up</a>
    `;
  }
}

async function handleLogout(showNotification = true) {
  try {
    // Clear user data immediately
    currentUser = null;
    userProgress = {};
    
    // Clear local storage
    UTILS.removeFromLocal("auth_token");
    UTILS.removeFromLocal("user_data");
    
    // Try to call API logout (but don't block if it fails)
    try {
      await API.logout();
    } catch (error) {
      console.log("API logout failed (possibly already logged out):", error);
    }
    
    // Update UI
    updateAuthButtons(false);
    showLoginPrompt();
    
    // Show notification if requested
    if (showNotification) {
      UTILS.showNotification("You have been logged out.", "info");
    }
    
    // Redirect to login page
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
    
  } catch (error) {
    console.error("Logout error:", error);
    // Even if logout fails, still redirect to login
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1000);
  }
}

function handleSessionExpired() {
  UTILS.showNotification("Session expired. Please log in again.", "error");
  
  // Automatically trigger logout after showing notification
  setTimeout(async () => {
    await handleLogout(false); // Don't show additional logout notification
  }, 2000); // Wait 2 seconds to let user see the message
}

// -----------------------
// Enhanced API Error Handler
// -----------------------
function handleApiError(error, context = "API call") {
  console.error(`${context} error:`, error);
  
  // Check for authentication errors
  if (isAuthError(error)) {
    handleSessionExpired();
    return true; // Indicates auth error was handled
  }
  
  // Handle other types of errors
  const message = error?.message || "An error occurred";
  UTILS.showNotification(`Error: ${message}`, "error");
  
  return false; // Indicates non-auth error
}

// -----------------------
// Check if error is authentication related
// -----------------------
function isAuthError(error) {
  if (!error) return false;
  
  const message = String(error.message || error.toString()).toLowerCase();
  const status = error.status || error.statusCode;
  
  return (
    status === 401 ||
    status === 403 ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("token") ||
    message.includes("session") ||
    message.includes("expired") ||
    message.includes("invalid credentials")
  );
}

async function refreshProfileFromBackend() {
  try {
    const data = await API.getProfile();
    if (!data?.profile) return;
    
    currentUser = {
      id: data.profile.id,
      name: data.profile.name,
      progress: 0,
      completedModules: 0,
      totalModules: 8,
      location: data.profile.location,
      subscriptionStatus: 'free', // Default
    };
    
    // Get subscription status
    try {
      const subscriptionData = await API.getSubscriptionStatus();
      currentUser.subscriptionStatus = subscriptionData.status || 'free';
      currentUser.subscriptionPlan = subscriptionData.plan || null;
    } catch (error) {
      console.log("Could not fetch subscription status:", error.message);
    }
    
    const progressData = await API.getProgress();
    if (progressData?.progress) {
      currentUser.completedModules = progressData.progress.filter(
        (p) => p.completed
      ).length;
      currentUser.progress = Math.round(
        (currentUser.completedModules / currentUser.totalModules) * 100
      );
    }
    
    updateUserInterface();
    updateDashboardStats();
  } catch (error) {
    if (handleApiError(error, "Profile refresh")) {
      return;
    }
    console.log("Profile refresh failed:", error.message);
  }
}

function updateDashboardStats() {
  if (!currentUser) return;
  
  const statsNumbers = document.querySelectorAll(".stat-number");
  if (statsNumbers.length >= 2) {
    statsNumbers[0].textContent = currentUser.completedModules;
    statsNumbers[1].textContent = currentUser.progress + "%";
  }

  // Update subscription status in dashboard
  const subscriptionStatus = document.querySelector(".subscription-badge");
  if (subscriptionStatus) {
    subscriptionStatus.textContent = currentUser.subscriptionStatus === 'active' ? 'Premium' : 'Free';
    subscriptionStatus.className = `subscription-badge ${currentUser.subscriptionStatus}`;
  }
}

function updateUserInterface() {
  document.querySelectorAll(".progress-fill").forEach((fill) => {
    fill.style.width = currentUser.progress + "%";
  });
}

// -----------------------
// AI Assistant
// -----------------------
let chatInitialized = false;

function initializeAIChat() {
  if (chatInitialized) return;
  chatInitialized = true;

  const aiSection = document.getElementById("ai-assistant");
  if (!aiSection) return;

  aiSection.innerHTML = `
    <div class="card">
      <h2>AI Health Assistant</h2>
      <div id="chat-box" class="chat-box"></div>
      <div class="chat-input">
        <input id="chat-message" type="text" placeholder="Type your question..." />
        <button id="send-chat" class="btn">Send</button>
      </div>
    </div>
  `;

  const input = document.getElementById("chat-message");
  const sendBtn = document.getElementById("send-chat");

  sendBtn.addEventListener("click", () => sendMessage(input.value));
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage(input.value);
  });
}

async function sendMessage(message) {
  if (!message.trim()) return;

  const chatBox = document.getElementById("chat-box");

  appendMessage("You", message, "user");
  document.getElementById("chat-message").value = "";

  try {
    appendMessage("AI", "⏳ Thinking...", "ai", true);

    const res = await API.chatWithAI(message);
    let reply = res.reply || "⚠️ Sorry, I could not generate a response.";

    const [mainReply, disclaimer] = reply.split("⚠️ Disclaimer:");
    updateLastAIMessage(mainReply.trim());

    if (disclaimer) {
      appendMessage("Note", "⚠️ " + disclaimer.trim(), "disclaimer");
    }
  } catch (err) {
    updateLastAIMessage("⚠️ Error: " + err.message);
  }

  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendMessage(sender, text, type = "user", temporary = false) {
  const chatBox = document.getElementById("chat-box");
  const msg = document.createElement("div");
  msg.className = `chat-message ${type}`;
  msg.innerHTML = `<strong>${sender}:</strong> <span>${text}</span>`;
  if (temporary) msg.dataset.temp = "true";
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function updateLastAIMessage(newText) {
  const chatBox = document.getElementById("chat-box");
  const tempMsg = chatBox.querySelector('.chat-message.ai[data-temp="true"]');
  if (tempMsg) {
    tempMsg.querySelector("span").textContent = newText;
    delete tempMsg.dataset.temp;
  } else {
    appendMessage("AI", newText, "ai");
  }
}

// -----------------------
// Symptom Checker
// -----------------------
function openSymptomChecker() {
  const aiSection = document.getElementById("ai-assistant");
  if (!aiSection) return;

  aiSection.innerHTML = `
    <div class="card">
      <h2>Symptom Checker</h2>
      <textarea id="symptom-input" rows="4" placeholder="Enter symptoms..."></textarea>
      <button id="check-symptoms" class="btn">Check</button>
      <div id="symptom-result" class="symptom-result"></div>
    </div>
  `;

  document
    .getElementById("check-symptoms")
    .addEventListener("click", async () => {
      const symptoms = document.getElementById("symptom-input").value;
      if (!symptoms.trim()) return;

      const resultBox = document.getElementById("symptom-result");
      resultBox.textContent = "⏳ Checking...";
      try {
        const res = await API.checkSymptoms(symptoms);
        resultBox.textContent = res.result || "No suggestion available.";
      } catch (err) {
        resultBox.textContent = "⚠️ Error: " + err.message;
      }
    });
}

// -----------------------
// Drug Interaction Checker
// -----------------------
function openDrugInteractionChecker() {
  const aiSection = document.getElementById("ai-assistant");
  if (!aiSection) return;

  aiSection.innerHTML = `
    <div class="card">
      <h2>Drug Interaction Checker</h2>
      <p>Enter two or more drug names to check for possible interactions.</p>
      <textarea id="drug-input" rows="3" placeholder="e.g., ibuprofen, paracetamol, aspirin"></textarea>
      <button id="check-drugs" class="btn">Check Interactions</button>
      <div id="drug-result" class="drug-result"></div>
    </div>
  `;

  document
    .getElementById("check-drugs")
    .addEventListener("click", async () => {
      const input = document.getElementById("drug-input").value;
      if (!input.trim()) return;

      const drugs = input.split(",").map((d) => d.trim()).filter(Boolean);

      if (drugs.length < 2) {
        UTILS.showNotification("Please enter at least two drugs.", "warning");
        return;
      }

      const resultBox = document.getElementById("drug-result");
      resultBox.textContent = "⏳ Checking interactions...";

      try {
        const res = await API.checkDrugInteractions(drugs);

        resultBox.innerHTML = `
          <div class="interaction-report">
            <p><strong>Drugs checked:</strong> ${res.drugs.join(", ")}</p>
            <p><strong>Severity:</strong> ${res.severity}</p>
            <div class="analysis"><strong>Analysis:</strong><br>${res.analysis}</div>
            <p class="timestamp"><em>Checked at ${UTILS.formatDate(res.timestamp)}</em></p>
          </div>
        `;
      } catch (err) {
        resultBox.textContent = "⚠️ Error: " + err.message;
      }
    });
}


// -----------------------
// Community Features
// -----------------------
let currentCommunitySection = "posts";

function initializeCommunity() {
  const communitySection = document.getElementById("community");
  if (!communitySection) return;

  // Check if already initialized
  if (communitySection.querySelector(".community-header")) {
    return;
  }

  communitySection.innerHTML = `
    <div class="community-header">
      <h2>Community Hub</h2>
      <div class="community-nav">
        <button class="btn btn-secondary active" data-section="posts">Forum Posts</button>
        <button class="btn btn-secondary" data-section="stories">Success Stories</button>
        <button class="btn btn-secondary" data-section="events">Local Events</button>
        <button class="btn btn-secondary" data-section="stats">Community Stats</button>
      </div>
    </div>
    <div id="community-content" class="community-content">
      <div class="loading">Loading community content...</div>
    </div>
  `;

  // Add event listeners for community navigation
  document.querySelectorAll(".community-nav button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;
      currentCommunitySection = section;
      loadCommunitySection(section);

      // Update active button
      document
        .querySelectorAll(".community-nav button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Load default section
  loadCommunitySection("posts");
}

async function loadCommunitySection(section) {
  const content = document.getElementById("community-content");
  if (!content) return;

  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    switch (section) {
      case "posts":
        await loadForumPosts();
        break;
      case "stories":
        await loadSuccessStories();
        break;
      case "events":
        await loadLocalEvents();
        break;
      case "stats":
        await loadCommunityStats();
        break;
    }
  } catch (error) {
    console.error("Error loading community section:", error);
    
    // Handle authentication errors
    if (handleApiError(error, `Loading ${section}`)) {
      return; // Auth error handled, stop processing
    }
    
    // Handle other errors
    content.innerHTML = `<div class="error">Error loading ${section}: ${error.message}</div>`;
  }
}

async function loadForumPosts() {
  const content = document.getElementById("community-content");
  
  try {
    const posts = await API.getForumPosts();

    content.innerHTML = `
      <div class="forum-header">
        <h3>Community Discussions</h3>
        <button class="btn" id="create-post-btn">Create New Post</button>
      </div>
      <div class="search-box">
        <input type="text" id="search-posts" placeholder="Search posts...">
        <button class="btn btn-secondary" id="search-btn">Search</button>
      </div>
      <div id="posts-list" class="posts-list">
        ${posts.posts && posts.posts.length > 0
          ? posts.posts
              .map(
                (post) => `
          <div class="post-card" data-post-id="${post.id}">
            <h4>${UTILS.sanitizeHtml(post.title)}</h4>
            <p class="post-meta">By ${
              post.profiles?.name || "Anonymous"
            } • ${UTILS.formatDate(post.created_at)}</p>
            <p class="post-excerpt">${UTILS.truncateText(
              UTILS.sanitizeHtml(post.content),
              150
            )}</p>
            <div class="post-actions">
              <button class="btn btn-small" onclick="viewPost(${
                post.id
              })">View Discussion</button>
            </div>
          </div>
        `
              )
              .join("")
          : '<p class="no-content">No posts yet. Be the first to start a discussion!</p>'
        }
      </div>
    `;

    // Add event listeners
    const createBtn = document.getElementById("create-post-btn");
    if (createBtn) {
      createBtn.addEventListener("click", showCreatePostForm);
    }
    
    const searchBtn = document.getElementById("search-btn");
    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        const query = document.getElementById("search-posts").value;
        if (query.trim()) searchPosts(query);
      });
    }
  } catch (error) {
    console.error("Error loading forum posts:", error);
    throw error;
  }
}

async function loadSuccessStories() {
  const content = document.getElementById("community-content");
  
  try {
    const stories = await API.getSuccessStories();

    content.innerHTML = `
      <div class="stories-header">
        <h3>Success Stories</h3>
        <button class="btn" id="submit-story-btn">Share Your Story</button>
      </div>
      <div id="stories-list" class="stories-list">
        ${stories.stories && stories.stories.length > 0
          ? stories.stories
              .map(
                (story) => `
          <div class="story-card">
            <h4>${UTILS.sanitizeHtml(story.title)}</h4>
            <p class="story-meta">By ${
              story.profiles?.name || "Anonymous"
            } • ${UTILS.formatDate(story.created_at)}</p>
            <p class="story-excerpt">${UTILS.truncateText(
              UTILS.sanitizeHtml(story.story),
              200
            )}</p>
          </div>
        `
              )
              .join("")
          : '<p class="no-content">No success stories yet. Share your inspiring story!</p>'
        }
      </div>
    `;

    const submitBtn = document.getElementById("submit-story-btn");
    if (submitBtn) {
      submitBtn.addEventListener("click", showSubmitStoryForm);
    }
  } catch (error) {
    console.error("Error loading success stories:", error);
    throw error;
  }
}

async function loadLocalEvents() {
  const content = document.getElementById("community-content");
  
  try {
    const events = await API.getLocalEvents();

    content.innerHTML = `
      <div class="events-header">
        <h3>Local Events</h3>
        <button class="btn" id="create-event-btn">Create Event</button>
      </div>
      <div id="events-list" class="events-list">
        ${events.events && events.events.length > 0
          ? events.events
              .map(
                (event) => `
          <div class="event-card">
            <h4>${UTILS.sanitizeHtml(event.title)}</h4>
            <p class="event-meta">
              📅 ${UTILS.formatDate(event.event_date)}
              ${event.event_time ? `🕒 ${event.event_time}` : ""}
              📍 ${UTILS.sanitizeHtml(event.location || "Location TBD")}
            </p>
            <p class="event-description">${UTILS.sanitizeHtml(
              event.description || ""
            )}</p>
          </div>
        `
              )
              .join("")
          : '<p class="no-content">No upcoming events. Create one for your community!</p>'
        }
      </div>
    `;

    const createBtn = document.getElementById("create-event-btn");
    if (createBtn) {
      createBtn.addEventListener("click", showCreateEventForm);
    }
  } catch (error) {
    console.error("Error loading local events:", error);
    throw error;
  }
}


async function loadCommunityStats() {
  const content = document.getElementById("community-content");
  
  try {
    const stats = await API.getCommunityStats();

    content.innerHTML = `
      <div class="stats-header">
        <h3>Community Statistics</h3>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <h4>${stats.stats.active_discussions || 0}</h4>
          <p>Active Discussions</p>
        </div>
        <div class="stat-card">
          <h4>${stats.stats.total_members || 0}</h4>
          <p>Total Members</p>
        </div>
        <div class="stat-card">
          <h4>${stats.stats.success_stories || 0}</h4>
          <p>Success Stories</p>
        </div>
        <div class="stat-card">
          <h4>${stats.stats.upcoming_events || 0}</h4>
          <p>Upcoming Events</p>
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Error loading community stats:", error);
    throw error;
  }
}

// -----------------------
// Forum Functions
// -----------------------
function showCreatePostForm() {
  // Auth guard
  const token = UTILS.getFromLocal("auth_token");
  if (!token) {
    UTILS.showNotification("Please log in to create a post", "error");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
    return;
  }

  const content = document.getElementById("community-content");
  if (!content) return;

  content.innerHTML = `
    <div class="card">
      <h3>Create New Post</h3>
      <form id="create-post-form">
        <div class="form-group">
          <label for="post-title">Title *</label>
          <input id="post-title" type="text" placeholder="Enter post title" required />
        </div>
        <div class="form-group">
          <label for="post-content">Content *</label>
          <textarea id="post-content" placeholder="Write your post content" rows="8" required></textarea>
        </div>
        <div class="form-group">
          <label for="post-category">Category</label>
          <select id="post-category">
            <option value="general">General Discussion</option>
            <option value="best_practices">Best Practices</option>
            <option value="case_studies">Case Studies</option>
            <option value="resources">Resources</option>
            <option value="success_stories">Success Stories</option>
            <option value="questions">Questions</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn" id="submit-post">Create Post</button>
          <button type="button" class="btn btn-secondary" id="cancel-post">Cancel</button>
        </div>
      </form>
    </div>
  `;

  const form = document.getElementById("create-post-form");
  const cancelBtn = document.getElementById("cancel-post");

  cancelBtn.addEventListener("click", () => {
    loadCommunitySection("posts");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const title = document.getElementById("post-title").value.trim();
    const content = document.getElementById("post-content").value.trim();
    const category = document.getElementById("post-category").value;

    if (!title || !content) {
      UTILS.showNotification("Please fill in title and content.", "warning");
      return;
    }

    if (title.length < 5) {
      UTILS.showNotification("Title must be at least 5 characters long.", "warning");
      return;
    }

    if (content.length < 10) {
      UTILS.showNotification("Content must be at least 10 characters long.", "warning");
      return;
    }

    const submitBtn = document.getElementById("submit-post");
    showLoading(submitBtn);

    try {
      await API.createForumPost({ title, content, category });
      UTILS.showNotification("Post created successfully!", "success");
      loadCommunitySection("posts");
    } catch (error) {
      // Use enhanced error handler
      if (!handleApiError(error, "Create post")) {
        // Non-auth error, stay on form
        UTILS.showNotification("Failed to create post: " + error.message, "error");
      }
    } finally {
      hideLoading(submitBtn);
    }
  });
}

async function addCommentWithSessionHandling(postId, content) {
  try {
    await API.addComment(postId, { content });
    UTILS.showNotification("Comment added successfully!", "success");
    viewPost(postId); // Reload the post
  } catch (error) {
    // Use enhanced error handler
    if (!handleApiError(error, "Add comment")) {
      UTILS.showNotification("Failed to add comment: " + error.message, "error");
    }
  }
}

async function viewPost(postId) {
  const content = document.getElementById("community-content");
  
  try {
    const postData = await API.getForumPost(postId);

    content.innerHTML = `
      <div class="post-detail">
        <button class="btn btn-secondary" onclick="loadCommunitySection('posts')">← Back to Posts</button>
        <div class="post-full">
          <h3>${UTILS.sanitizeHtml(postData.post.title)}</h3>
          <p class="post-meta">By ${
            postData.post.profiles?.name || "Anonymous"
          } • ${UTILS.formatDate(postData.post.created_at)}</p>
          <div class="post-content">${UTILS.sanitizeHtml(postData.post.content)}</div>
        </div>
        <div class="comments-section">
          <h4>Comments (${postData.comments?.length || 0})</h4>
          <div id="comments-list">
            ${postData.comments && postData.comments.length > 0
              ? postData.comments
                  .map(
                    (comment) => `
              <div class="comment">
                <p class="comment-meta">${
                  comment.profiles?.name || "Anonymous"
                } • ${UTILS.formatDate(comment.created_at)}</p>
                <p>${UTILS.sanitizeHtml(comment.content)}</p>
              </div>
            `
                  )
                  .join("")
              : '<p class="no-content">No comments yet. Be the first to comment!</p>'
            }
          </div>
          <form id="add-comment-form" class="comment-form">
            <div class="form-group">
              <textarea id="comment-content" placeholder="Add a comment..." rows="3" required></textarea>
            </div>
            <button type="submit" class="btn">Add Comment</button>
          </form>
        </div>
      </div>
    `;

    const commentForm = document.getElementById("add-comment-form");
    commentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const content = document.getElementById("comment-content").value.trim();
      
      if (!content) {
        UTILS.showNotification("Please enter a comment.", "warning");
        return;
      }

      if (content.length < 5) {
        UTILS.showNotification("Comment must be at least 5 characters long.", "warning");
        return;
      }

      try {
        await API.addComment(postId, { content });
        UTILS.showNotification("Comment added successfully!", "success");
        viewPost(postId); // Reload the post
      } catch (error) {
        console.error("Add comment error:", error);
        if (error.message.includes("Unauthorized") || error.message.includes("401")) {
          UTILS.showNotification("Session expired, please log in again.", "error");
          setTimeout(() => {
            window.location.href = "login.html";
          }, 2000);
        } else {
          UTILS.showNotification("Failed to add comment: " + error.message, "error");
        }
      }
    });
  } catch (error) {
    console.error("Error viewing post:", error);
    content.innerHTML = `<div class="error">Error loading post: ${error.message}</div>`;
  }
}

async function searchPosts(query) {
  const content = document.getElementById("community-content");
  
  try {
    const results = await API.searchForumPosts(query);

    content.innerHTML = `
      <div class="search-results">
        <h3>Search Results for "${UTILS.sanitizeHtml(query)}"</h3>
        <button class="btn btn-secondary" onclick="loadCommunitySection('posts')">← Back to All Posts</button>
        <div id="search-results-list">
          ${results.posts && results.posts.length > 0
            ? results.posts
                .map(
                  (post) => `
            <div class="post-card" data-post-id="${post.id}">
              <h4>${UTILS.sanitizeHtml(post.title)}</h4>
              <p class="post-meta">By ${
                post.profiles?.name || "Anonymous"
              } • ${UTILS.formatDate(post.created_at)}</p>
              <p class="post-excerpt">${UTILS.truncateText(
                UTILS.sanitizeHtml(post.content),
                150
              )}</p>
              <div class="post-actions">
                <button class="btn btn-small" onclick="viewPost(${
                  post.id
                })">View Discussion</button>
              </div>
            </div>
          `
                )
                .join("")
            : '<p class="no-content">No posts found for your search.</p>'
          }
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Search error:", error);
    content.innerHTML = `<div class="error">Search failed: ${error.message}</div>`;
  }
}

// -----------------------
// Success Stories Functions
// -----------------------
function showSubmitStoryForm() {
  const token = UTILS.getFromLocal("auth_token");
  if (!token) {
    UTILS.showNotification("Please log in to submit a story", "error");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
    return;
  }

  const content = document.getElementById("community-content");
  if (!content) return;

  content.innerHTML = `
    <div class="card">
      <h3>Share Your Success Story</h3>
      <form id="submit-story-form">
        <div class="form-group">
          <label for="story-title">Title *</label>
          <input id="story-title" type="text" placeholder="Give your story a title" required />
        </div>
        <div class="form-group">
          <label for="story-content">Your Story *</label>
          <textarea id="story-content" placeholder="Share your inspiring story..." rows="10" required></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn" id="submit-story">Submit Story</button>
          <button type="button" class="btn btn-secondary" id="cancel-story">Cancel</button>
        </div>
      </form>
    </div>
  `;

  const form = document.getElementById("submit-story-form");
  const cancelBtn = document.getElementById("cancel-story");

  cancelBtn.addEventListener("click", () => {
    loadCommunitySection("stories");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const title = document.getElementById("story-title").value.trim();
    const story = document.getElementById("story-content").value.trim();

    if (!title || !story) {
      UTILS.showNotification("Please fill in title and story.", "warning");
      return;
    }

    if (title.length < 10) {
      UTILS.showNotification("Title must be at least 10 characters long.", "warning");
      return;
    }

    if (story.length < 50) {
      UTILS.showNotification("Story must be at least 50 characters long.", "warning");
      return;
    }

    const submitBtn = document.getElementById("submit-story");
    showLoading(submitBtn);

    try {
      await API.submitSuccessStory({ title, story });
      UTILS.showNotification("Success story submitted successfully!", "success");
      loadCommunitySection("stories");
    } catch (error) {
      // Use enhanced error handler
      if (!handleApiError(error, "Submit story")) {
        UTILS.showNotification("Failed to submit story: " + error.message, "error");
      }
    } finally {
      hideLoading(submitBtn);
    }
  });
}
// -----------------------
// Events Functions
// -----------------------
function showCreateEventForm() {
  const token = UTILS.getFromLocal("auth_token");
  if (!token) {
    UTILS.showNotification("Please log in to create an event", "error");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
    return;
  }

  const content = document.getElementById("community-content");
  if (!content) return;

  content.innerHTML = `
    <div class="card">
      <h3>Create New Event</h3>
      <form id="create-event-form">
        <div class="form-group">
          <label for="event-title">Event Title *</label>
          <input id="event-title" type="text" placeholder="Enter event title" required />
        </div>
        <div class="form-group">
          <label for="event-date">Event Date *</label>
          <input id="event-date" type="date" required />
        </div>
        <div class="form-group">
          <label for="event-time">Event Time</label>
          <input id="event-time" type="time" />
        </div>
        <div class="form-group">
          <label for="event-location">Location *</label>
          <input id="event-location" type="text" placeholder="Event location" required />
        </div>
        <div class="form-group">
          <label for="event-description">Description</label>
          <textarea id="event-description" placeholder="Event description..." rows="6"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn" id="submit-event">Create Event</button>
          <button type="button" class="btn btn-secondary" id="cancel-event">Cancel</button>
        </div>
      </form>
    </div>
  `;

  const form = document.getElementById("create-event-form");
  const cancelBtn = document.getElementById("cancel-event");

  cancelBtn.addEventListener("click", () => {
    loadCommunitySection("events");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const title = document.getElementById("event-title").value.trim();
    const event_date = document.getElementById("event-date").value.trim();
    const event_time = document.getElementById("event-time").value.trim();
    const location = document.getElementById("event-location").value.trim();
    const description = document.getElementById("event-description").value.trim();

    if (!title || !event_date || !location) {
      UTILS.showNotification("Please fill in title, date, and location.", "warning");
      return;
    }

    if (title.length < 5) {
      UTILS.showNotification("Title must be at least 5 characters long.", "warning");
      return;
    }

    const submitBtn = document.getElementById("submit-event");
    showLoading(submitBtn);

    try {
      if (API.createEvent) {
        await API.createEvent({ title, description, event_date, event_time, location });
      } else {
        await API.post("/community/events", { title, description, event_date, event_time, location });
      }
      UTILS.showNotification("Event created successfully!", "success");
      loadCommunitySection("events");
    } catch (error) {
      // Use enhanced error handler
      if (!handleApiError(error, "Create event")) {
        UTILS.showNotification("Failed to create event: " + error.message, "error");
      }
    } finally {
      hideLoading(submitBtn);
    }
  });
}


function joinEvent(eventId) {
  UTILS.showNotification(`You joined event ${eventId}`, "success");
}

// -----------------------
// Quiz Function (referenced in showModule)
// -----------------------
function showQuiz(quiz) {
  if (!quiz) {
    UTILS.showNotification("No quiz available for this module.", "warning");
    return;
  }

  const moduleView = document.getElementById("module-view");
  if (!moduleView) return;

  moduleView.innerHTML = `
    <div class="card quiz-card">
      <div class="quiz-header">
        <h2>Module Quiz</h2>
        <p>Test your knowledge from this module</p>
      </div>
      <div class="quiz-body">
        <div class="quiz-question">
          <h3>Question 1 of ${quiz.questions?.length || 1}</h3>
          <p>${quiz.questions?.[0]?.question || "Sample quiz question will appear here."}</p>
          <div class="quiz-options">
            ${quiz.questions?.[0]?.options?.map((option, index) => `
              <label class="quiz-option">
                <input type="radio" name="quiz-answer" value="${index}">
                <span>${option}</span>
              </label>
            `).join('') || `
              <label class="quiz-option">
                <input type="radio" name="quiz-answer" value="0">
                <span>Sample answer A</span>
              </label>
              <label class="quiz-option">
                <input type="radio" name="quiz-answer" value="1">
                <span>Sample answer B</span>
              </label>
              <label class="quiz-option">
                <input type="radio" name="quiz-answer" value="2">
                <span>Sample answer C</span>
              </label>
            `}
          </div>
        </div>
      </div>
      <div class="quiz-footer">
        <button class="btn btn-secondary" id="back-to-module">← Back to Module</button>
        <button class="btn btn-primary" id="submit-quiz">Submit Answer</button>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById("back-to-module")?.addEventListener("click", () => {
    history.back();
  });

  document.getElementById("submit-quiz")?.addEventListener("click", async () => {
    const selectedAnswer = document.querySelector('input[name="quiz-answer"]:checked');
    if (!selectedAnswer) {
      UTILS.showNotification("Please select an answer.", "warning");
      return;
    }

    try {
      // Submit quiz answer (implement based on your API)
      UTILS.showNotification("Quiz submitted successfully!", "success");
      // Could redirect back to module or show results
      history.back();
    } catch (e) {
      UTILS.showNotification("Failed to submit quiz", "error");
    }
  });
}

// Add these functions to script.js

async function handleSubscription(planId) {
  const token = UTILS.getFromLocal("auth_token");
  if (!token) {
    UTILS.showNotification("Please log in to subscribe", "error");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
    return;
  }

  try {
    const result = await API.createSubscription(planId);
    
    // Update user subscription status
    if (currentUser) {
      currentUser.subscriptionStatus = 'active';
      currentUser.subscriptionPlan = planId;
    }
    
    updateSubscriptionUI();
    UTILS.showNotification("Subscription activated successfully!", "success");
  } catch (error) {
    if (!handleApiError(error, "Create subscription")) {
      UTILS.showNotification("Failed to create subscription: " + error.message, "error");
    }
  }
}

function updateSubscriptionUI() {
  const statusDiv = document.getElementById("subscription-status");
  if (!statusDiv || !currentUser) return;

  const isActive = currentUser.subscriptionStatus === 'active';
  
  statusDiv.className = `subscription-status ${isActive ? 'subscription-active' : 'subscription-inactive'}`;
  statusDiv.innerHTML = `
    <h4>Current Status: ${isActive ? 'Premium Member' : 'Free Member'}</h4>
    ${isActive 
      ? `<p>You have access to all premium features!</p>
         <button class="btn btn-secondary" id="cancel-subscription">Cancel Subscription</button>`
      : '<p>Upgrade to premium for unlimited access to all features.</p>'
    }
  `;

  // Update plan cards
  document.querySelectorAll('.plan-card').forEach(card => {
    const button = card.querySelector('.btn');
    const planType = button?.dataset.plan;
    
    if (isActive && planType === 'premium') {
      button.textContent = 'Current Plan';
      button.disabled = true;
      button.className = 'btn btn-secondary';
    } else if (!isActive && planType === 'premium') {
      button.textContent = 'Subscribe Now';
      button.disabled = false;
      button.className = 'btn';
    }
  });

  // Add cancel subscription handler
  const cancelBtn = document.getElementById("cancel-subscription");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to cancel your subscription?")) {
        try {
          await API.cancelSubscription();
          if (currentUser) {
            currentUser.subscriptionStatus = 'free';
            currentUser.subscriptionPlan = null;
          }
          updateSubscriptionUI();
        } catch (error) {
          console.error("Cancel subscription error:", error);
        }
      }
    });
  }
}

// Add subscription requirement check for premium features
function checkSubscriptionAccess(featureName) {
  if (!currentUser || currentUser.subscriptionStatus !== 'active') {
    UTILS.showNotification(`${featureName} requires a premium subscription. Please upgrade to access this feature.`, "warning");
    showSection("subscription");
    return false;
  }
  return true;
}

// -----------------------
// UI / Utils Functions
// -----------------------
function showLoading(button) {
  if (!button) return;
  button.dataset.originalText = button.textContent;
  button.innerHTML = '<span class="loading"></span> Loading...';
  button.disabled = true;
}

function hideLoading(button) {
  if (!button) return;
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

function trackPageView(sectionId) {
  console.log(`Page view: ${sectionId}`);
}

function setupSearch() {
  console.log("Search functionality ready");
}

function animateProgressBars() {
  setTimeout(() => {
    document.querySelectorAll(".progress-fill").forEach((bar) => {
      const targetWidth = bar.style.width;
      bar.style.width = "0%";
      setTimeout(() => (bar.style.width = targetWidth), 100);
    });
  }, 500);
}

function checkUrlHash() {
  const hash = window.location.hash.substring(1);
  if (!hash) return;
  
  // Handle nested routes like #training/module-id
  const [section, moduleId] = hash.split("/");
  
  if (section && document.getElementById(section)) {
    if (section === "training" && moduleId) {
      // Handle direct module access
      showSection("training", true);
      // Load the specific module if needed
      setTimeout(() => {
        const moduleBtn = document.querySelector(`[data-module-id="${decodeURIComponent(moduleId)}"]`);
        if (moduleBtn) {
          startTrainingModule(moduleBtn);
        }
      }, 100);
    } else {
      showSection(section, true);
    }
  }
}

function checkNotifications() {
  setTimeout(
    () => UTILS.showNotification("Welcome to HealthGuide Community!", "success"),
    1500
  );
}

function handleOnline() {
  UTILS.showNotification("Connection restored", "success");
}

function handleOffline() {
  UTILS.showNotification(
    "App is offline. Some features may not work.",
    "warning"
  );
}

// -----------------------
// Navigation Helpers
// -----------------------
function navigateToTraining() {
  showSection("training");
  setTimeout(() => {
    const incompleteModule = document.querySelector('.progress-fill[style*="60%"], .progress-fill[style*="0%"]');
    if (incompleteModule) {
      incompleteModule
        .closest(".card")
        .scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 300);
}

// -----------------------
// Event Listeners Setup
// -----------------------
function setupEventListeners() {
  // Navigation tabs
  document
    .querySelectorAll(".nav-tab")
    .forEach((tab) =>
      tab.addEventListener("click", () => showSection(tab.dataset.section))
    );

  // General button handler (single place for all buttons)
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn) return;

    const txt = btn.textContent.trim();
    const action = btn.dataset.action;

    if (btn.dataset.moduleId || btn.dataset.moduleSlug) {
      startTrainingModule(btn);
      return;
    }

    // Prefer data-action over text matching
    switch (action || txt) {
      case "continue-learning":
      case "Continue Learning":
        navigateToTraining();
        break;

      case "emergency-protocols":
      case "Emergency Protocols":
        showEmergencyProtocols();
        break;

      case "ai-assistant":
      case "Ask AI Assistant":
        showSection("ai-assistant");
        break;

      // AI Tools
      case "chat-ai":
      case "Start Chat with AI":
        showSection("ai-assistant");
        if (!chatInitialized) {
          initializeAIChat();
        }
        break;

      case "symptom-checker":
      case "Open Symptom Checker":
        showSection("ai-assistant");
        openSymptomChecker();
        break;

      case "drug-checker":
      case "Drug Interaction Checker":
      case "Check Interactions":
        showSection("ai-assistant");
        openDrugInteractionChecker();
        break;

      // Community
      case "forum":
      case "Join Discussions":
        showSection("community");
        if (!document.getElementById("community-content")) {
          initializeCommunity();
        }
        loadCommunitySection("posts");
        break;

      case "stories":
      case "Read Stories":
        showSection("community");
        if (!document.getElementById("community-content")) {
          initializeCommunity();
        }
        loadCommunitySection("stories");
        break;

      case "ask-question":
      case "Post a Question":
        showSection("community");
        if (!document.getElementById("community-content")) {
          initializeCommunity();
        }
        setTimeout(() => showCreatePostForm(), 100);
        break;

      case "events":
      case "View All Events":
        showSection("community");
        if (!document.getElementById("community-content")) {
          initializeCommunity();
        }
        loadCommunitySection("events");
        break;

        case "subscribe":
        case "Subscribe Now":
        const planId = btn.dataset.plan;
          if (planId) {
         handleSubscription(planId);
        }
        break;

      default:
        console.log("Button clicked:", txt);
    }
  });

  setupSearch();
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
}

// -----------------------
// Browser Back/Forward Handler
// -----------------------
window.addEventListener("popstate", (e) => {
  const hash = window.location.hash.substring(1);
  
  if (!hash) {
    showSection("dashboard", true);
    return;
  }
  
  const [section, moduleId] = hash.split("/");
  
  if (section === "training" && !moduleId) {
    // Going back to training section from module view
    const moduleView = document.getElementById("module-view");
    if (moduleView && moduleView.classList.contains("active")) {
      moduleView.classList.remove("active");
      moduleView.hidden = true;
    }
    showSection("training", true);
  } else if (section === "module-view" || (section === "training" && moduleId)) {
    // Module view is being accessed
    // The showModule function should handle this
  } else if (section && document.getElementById(section)) {
    showSection(section, true);
  }
});

// -----------------------
// Service Worker Registration
// -----------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => console.log("ServiceWorker registration successful"))
      .catch((e) => console.log("ServiceWorker registration failed:", e));
  });
}

// -----------------------
// Forum Function (compatibility)
// -----------------------
function openForum() {
  showSection("community");
  if (!document.getElementById("community-content")) {
    initializeCommunity();
  }
  loadCommunitySection("posts");
}

// -----------------------
// Global Function Exports for onclick handlers
// -----------------------
window.viewPost = viewPost;
window.loadCommunitySection = loadCommunitySection;
window.openForum = openForum;
window.joinEvent = joinEvent;