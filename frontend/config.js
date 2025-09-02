// =======================
// Enhanced config.js for HealthGuide Community
// =======================

const API_BASE = "http://127.0.0.1:5000/api"; // Flask backend base URL

// ===== ENHANCED UTILS =====
const UTILS = {
  // Local storage with error handling
  saveToLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }
  },

  getFromLocal(key) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      console.error("Failed to read from localStorage:", e);
      return null;
    }
  },

  removeFromLocal(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("Failed to remove from localStorage:", e);
    }
  },

  // Enhanced notification system
  showNotification(msg, type = "info") {
    // Create a simple toast notification
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${this.getNotificationIcon(type)}</span>
        <span class="toast-message">${msg}</span>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
      </div>
    `;

    // Add styles if not already present
    if (!document.getElementById("toast-styles")) {
      const styles = document.createElement("style");
      styles.id = "toast-styles";
      styles.textContent = `
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          min-width: 300px;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          z-index: 9999;
          animation: slideIn 0.3s ease-out;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .toast-info { background: #e3f2fd; border-left: 4px solid #2196f3; color: #1976d2; }
        .toast-success { background: #e8f5e8; border-left: 4px solid #4caf50; color: #2e7d32; }
        .toast-warning { background: #fff3e0; border-left: 4px solid #ff9800; color: #f57c00; }
        .toast-error { background: #ffebee; border-left: 4px solid #f44336; color: #d32f2f; }
        .toast-content { display: flex; align-items: center; gap: 10px; }
        .toast-close { background: none; border: none; font-size: 18px; cursor: pointer; margin-left: auto; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = "slideOut 0.3s ease-in";
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
  },

  getNotificationIcon(type) {
    const icons = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
    };
    return icons[type] || icons.info;
  },

  // Format timestamps
  formatTimestamp(isoString) {
    try {
      return new Date(isoString).toLocaleString();
    } catch (e) {
      return "Unknown time";
    }
  },

  // Format date for display
  formatDate(isoString) {
    try {
      return new Date(isoString).toLocaleDateString();
    } catch (e) {
      return "Unknown date";
    }
  },

  // Get relative time (e.g., "2 hours ago")
  getRelativeTime(isoString) {
    try {
      const now = new Date();
      const date = new Date(isoString);
      const diff = now - date;

      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return "Just now";
      if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
      if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
      if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

      return this.formatDate(isoString);
    } catch (e) {
      return "Unknown time";
    }
  },

  // Debounce function for API calls
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Check if user is online
  isOnline() {
    return navigator.onLine;
  },

  // Sanitize HTML to prevent XSS
  sanitizeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },

  // Truncate text
  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  },
};

// ===== ENHANCED API CLIENT =====
const API = {
  // Helper for handling responses with retry logic
  async handleResponse(res, retryCount = 0) {
    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = { error: "Invalid server response" };
    }

    if (!res.ok) {
      if (res.status === 401) {
        console.log("401 Unauthorized - clearing auth and redirecting");
        UTILS.removeFromLocal("auth_token");
        UTILS.removeFromLocal("user_data");
        UTILS.showNotification("Session expired. Please log in again.", "error");
        // Don't redirect here, let the calling function handle it
        throw new Error("Unauthorized - session expired");
      } else if (res.status === 429 && retryCount < 3) {
        // Rate limiting - wait and retry
        await new Promise((resolve) => setTimeout(resolve, 2000 * (retryCount + 1)));
        // Note: We can't easily retry here without the original request info
        throw new Error("Rate limited - please try again");
      } else if (res.status >= 500 && retryCount < 2) {
        // Server error
        throw new Error("Server error - please try again");
      }
      
      // Extract error message
      const errorMsg = data.error || data.message || `HTTP ${res.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },

  // Generic GET with offline handling
  async get(path) {
    if (!UTILS.isOnline()) {
      UTILS.showNotification("You're offline. Please check your connection.", "warning");
      throw new Error("Offline");
    }

    const token = UTILS.getFromLocal("auth_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${API_BASE}${path}`, { headers });
      return this.handleResponse(res);
    } catch (error) {
      if (error.message === "Failed to fetch") {
        UTILS.showNotification("Network error. Please check your connection.", "error");
      }
      throw error;
    }
  },

  // Generic POST with enhanced error handling
  async post(path, body = {}) {
    if (!UTILS.isOnline()) {
      UTILS.showNotification("You're offline. Please check your connection.", "warning");
      throw new Error("Offline");
    }

    const token = UTILS.getFromLocal("auth_token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      return this.handleResponse(res);
    } catch (error) {
      if (error.message === "Failed to fetch") {
        UTILS.showNotification("Network error. Please check your connection.", "error");
      }
      throw error;
    }
  },

  // Generic PUT
  async put(path, body = {}) {
    if (!UTILS.isOnline()) {
      UTILS.showNotification("You're offline. Please check your connection.", "warning");
      throw new Error("Offline");
    }

    const token = UTILS.getFromLocal("auth_token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      return this.handleResponse(res);
    } catch (error) {
      if (error.message === "Failed to fetch") {
        UTILS.showNotification("Network error. Please check your connection.", "error");
      }
      throw error;
    }
  },

  // ===== AUTH =====
  async login(email, password) {
    try {
      const res = await this.post("/auth/login", { email, password });
      console.log("Login response:", res);

      const token = res.access_token || res.token || res.authToken || res.jwt || null;

      if (token) {
        UTILS.saveToLocal("auth_token", token);
        UTILS.saveToLocal("user_data", res.user);
        UTILS.showNotification("Welcome back! Login successful.", "success");
        return res;
      } else {
        const errorMsg = res.error || "No authentication token received";
        UTILS.showNotification(`Login failed: ${errorMsg}`, "error");
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error("Login error:", error);
      const errorMsg = error.message || "Login failed";
      UTILS.showNotification(`Login failed: ${errorMsg}`, "error");
      throw error;
    }
  },

  async register(name, email, password, location) {
    try {
      const res = await this.post("/auth/register", {
        name,
        email,
        password,
        location,
      });
  
      // Debugging line to inspect backend response
      
  
      // If no response
      if (!res) {
        throw new Error("Empty server response");
      }
  
      // Check error property (backend sends {error: "..."} on failure)
      if (res.error) {
        throw new Error(res.error);
      }
  
      return res; // res should contain {message, user}
    } catch (error) {
      console.error("Registration error:", error);
  
      let errorMsg = "Registration failed";
      if (error.response && error.response.data) {
        errorMsg =
          error.response.data.error ||
          error.response.data.message ||
          errorMsg;
      } else if (error.message) {
        errorMsg = error.message;
      }
  
      throw new Error(errorMsg);
    }
  },

  async logout() {
    try {
      UTILS.removeFromLocal("auth_token");
      UTILS.removeFromLocal("user_data");
      UTILS.showNotification("Successfully logged out!", "success");
    } catch (error) {
      console.error("Logout error:", error);
    }
  },

  // ===== USER PROFILE =====
  async getProfile() {
    try {
      return await this.get("/users/profile");
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      throw error;
    }
  },

  async updateProfile(data) {
    try {
      const result = await this.put("/users/profile", data);
      UTILS.showNotification("Profile updated successfully!", "success");
      return result;
    } catch (error) {
      console.error("Failed to update profile:", error);
      UTILS.showNotification("Failed to update profile. Please try again.", "error");
      throw error;
    }
  },

  // ===== TRAINING =====
async getTrainingModules() {
  try {
    return await this.get("/training/modules");
  } catch (error) {
    console.error("Failed to fetch training modules:", error);
    throw error;
  }
},

async getTrainingModule(identifier) {
  try {
    return await this.get(`/training/modules/${encodeURIComponent(identifier)}`);
  } catch (error) {
    console.error("Failed to fetch training module:", error);
    throw error;
  }
},

async updateProgress(moduleId, progress) {
  try {
    const result = await this.post("/training/progress", { moduleId, progress });
    UTILS.showNotification("Progress saved!", "success");
    return result;
  } catch (error) {
    console.error("Failed to update progress:", error);
    throw error;
  }
},

async getProgress() {
  try {
    return await this.get("/training/progress");
  } catch (error) {
    console.error("Failed to fetch progress:", error);
    throw error;
  }
},

// ✅ FIXED: define markModuleComplete as a method, not assignment
async markModuleComplete(moduleId, moduleTitle = "Module") {
  const token = UTILS.getFromLocal("auth_token");
  if (!token) {
    UTILS.showNotification("Please log in to mark modules as complete.", "error");
    return false;
  }

  const completionData = {
    module_id: moduleId,
    completed: true,
    progress: 100,
    completed_at: new Date().toISOString(),
  };

  try {
    await this.post(
      `/training/modules/${encodeURIComponent(moduleId)}/complete`,
      completionData
    );
    UTILS.showNotification(`${moduleTitle} marked as complete!`, "success");
    return true; // ✅ always return boolean
  } catch (error) {
    UTILS.showNotification(
      `Failed to mark ${moduleTitle} as complete: ${error.message}`,
      "error"
    );
    return false; // ✅ fallback
  }
},



  

  // ===== AI CHAT =====
  async chatWithAI(message) {
    try {
      if (!message.trim()) {
        throw new Error("Message cannot be empty");
      }

      const res = await this.post("/ai/chat", { message: message.trim() });
      return {
        reply: res.response || "I'm sorry, I couldn't generate a response at the moment.",
        timestamp: res.timestamp,
        model: res.model_used || "unknown",
      };
    } catch (error) {
      console.error("AI chat error:", error);

      let errorMsg = "I'm having trouble responding right now. Please try again.";

      if (error.message.includes("Offline")) {
        errorMsg = "You're offline. Please check your internet connection.";
      } else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        errorMsg = "Please log in to use the AI assistant.";
      } else if (error.message.includes("429")) {
        errorMsg = "I'm receiving too many requests. Please wait a moment and try again.";
      }

      return { reply: errorMsg };
    }
  },

  async testAI(message) {
    try {
      if (!message.trim()) {
        throw new Error("Message cannot be empty");
      }

      const res = await this.post("/ai/test", { message: message.trim() });
      return {
        reply: res.response || "Test response not available.",
        timestamp: res.timestamp,
        isTest: true,
      };
    } catch (error) {
      console.error("AI test error:", error);
      return {
        reply: "Test mode is currently unavailable. Please try again later.",
      };
    }
  },

  // ===== SYMPTOM CHECKER =====
  async checkSymptoms(symptoms) {
    try {
      if (!symptoms || (Array.isArray(symptoms) && symptoms.length === 0)) {
        throw new Error("Please provide symptoms to check");
      }

      const res = await this.post("/ai/symptom-check", { symptoms });
      return {
        result: res.ai_analysis || "Unable to analyze symptoms at the moment.",
        urgency: res.urgency_level || "low",
        recommendations: res.recommendations || [],
        timestamp: res.timestamp,
      };
    } catch (error) {
      console.error("Symptom check error:", error);

      let errorMsg = "Symptom checker is currently unavailable. Please consult a healthcare professional.";

      if (error.message.includes("Offline")) {
        errorMsg = "You're offline. Please check your internet connection to use the symptom checker.";
      }

      return {
        result: errorMsg,
        urgency: "unknown",
        recommendations: ["Consult a healthcare professional", "Monitor symptoms carefully"],
      };
    }
  },
  // ===== DRUG INTERACTION CHECKER =====
async checkDrugInteractions(drugs) {
  try {
    if (!drugs || !Array.isArray(drugs) || drugs.length < 2) {
      throw new Error("Please provide at least two drugs to check interactions");
    }

    const res = await this.post("/ai/drug-interaction", { drugs });

    return {
      drugs: res.drugs_checked || drugs,
      severity: res.severity || "unknown",
      analysis: res.ai_analysis || "Unable to analyze drug interactions at the moment.",
      timestamp: res.timestamp,
    };
  } catch (error) {
    console.error("Drug interaction check error:", error);

    let errorMsg = "Drug interaction checker is currently unavailable. Please consult a healthcare professional.";

    if (error.message.includes("Offline")) {
      errorMsg = "You're offline. Please check your internet connection to use the drug interaction checker.";
    } else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
      errorMsg = "Please log in to use the drug interaction checker.";
    }

    return {
      drugs: drugs || [],
      severity: "unknown",
      analysis: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
},

// Add to the API object after the existing methods

// ===== SUBSCRIPTION MANAGEMENT =====
async createSubscription(planId) {
  try {
    const result = await this.post("/payments/create-subscription", { plan: planId });
    UTILS.showNotification("Subscription created successfully!", "success");
    return result;
  } catch (error) {
    console.error("Failed to create subscription:", error);
    UTILS.showNotification("Failed to create subscription: " + error.message, "error");
    throw error;
  }
},

async getSubscriptionStatus() {
  try {
    return await this.get("/users/subscription-status");
  } catch (error) {
    console.error("Failed to get subscription status:", error);
    throw error;
  }
},

async cancelSubscription() {
  try {
    const result = await this.post("/payments/cancel-subscription");
    UTILS.showNotification("Subscription cancelled successfully!", "success");
    return result;
  } catch (error) {
    console.error("Failed to cancel subscription:", error);
    UTILS.showNotification("Failed to cancel subscription: " + error.message, "error");
    throw error;
  }
},

  // ===== COMMUNITY FEATURES =====

  // Forum Posts - Fixed endpoints to match backend
  async getForumPosts(page = 1, limit = 20) {
    try {
      return await this.get(`/community/posts?page=${page}&limit=${limit}`);
    } catch (error) {
      console.error("Failed to fetch forum posts:", error);
      throw error;
    }
  },

  async createForumPost(data) {
    try {
      const result = await this.post("/community/posts", data);
      // Don't show notification here, let the calling function handle it
      return result;
    } catch (error) {
      console.error("Failed to create forum post:", error);
      throw error;
    }
  },

  async getForumPost(postId) {
    try {
      return await this.get(`/community/posts/${postId}`);
    } catch (error) {
      console.error("Failed to fetch forum post:", error);
      throw error;
    }
  },

  async addComment(postId, data) {
    try {
      const result = await this.post(`/community/posts/${postId}/comments`, data);
      return result;
    } catch (error) {
      console.error("Failed to add comment:", error);
      throw error;
    }
  },

  // Success Stories - Fixed endpoints
  async getSuccessStories(page = 1, limit = 10) {
    try {
      return await this.get(`/community/success-stories?page=${page}&limit=${limit}`);
    } catch (error) {
      console.error("Failed to fetch success stories:", error);
      throw error;
    }
  },

  async submitSuccessStory(data) {
    try {
      const result = await this.post("/community/success-stories", data);
      return result;
    } catch (error) {
      console.error("Failed to submit success story:", error);
      throw error;
    }
  },

  // Local Events - Fixed endpoints
  async getLocalEvents() {
    try {
      return await this.get("/community/events");
    } catch (error) {
      console.error("Failed to fetch local events:", error);
      throw error;
    }
  },

  async createLocalEvent(eventData) {
    try {
      const result = await this.post("/community/events", eventData);
      return result;
    } catch (error) {
      console.error("Failed to create event:", error);
      throw error;
    }
  },

  // Community Stats
  async getCommunityStats() {
    try {
      return await this.get("/community/stats");
    } catch (error) {
      console.error("Failed to fetch community stats:", error);
      throw error;
    }
  },

  // Search
  async searchForumPosts(query) {
    try {
      if (!query || query.trim().length < 3) {
        throw new Error("Search query must be at least 3 characters");
      }
      return await this.get(`/community/search?q=${encodeURIComponent(query.trim())}`);
    } catch (error) {
      console.error("Failed to search forum posts:", error);
      throw error;
    }
  },

  // ===== SYSTEM STATUS =====
  async getSystemStatus() {
    try {
      return await fetch(`${API_BASE.replace("/api", "")}/health`, {
        method: "GET",
        timeout: 5000,
      }).then((res) => res.json());
    } catch (error) {
      console.error("Failed to check system status:", error);
      return { status: "unknown", error: error.message };
    }
  },
};



// ===== ENHANCED OFFLINE SUPPORT =====
window.addEventListener("online", () => {
  UTILS.showNotification("Connection restored! You're back online.", "success");
});

window.addEventListener("offline", () => {
  UTILS.showNotification("You're offline. Some features may not work.", "warning");
});

// ===== ERROR BOUNDARY =====
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error);
  UTILS.showNotification(
    "An unexpected error occurred. Please refresh the page if problems persist.",
    "error"
  );
});

// ===== EXPORT =====
export { API, UTILS };