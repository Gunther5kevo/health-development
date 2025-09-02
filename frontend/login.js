// =======================
// login.js - Shared JS for Login & Signup
// =======================
import { API, UTILS } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  // Check URL query params for email verification
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get("status");
  if (status === "verified") {
    const successMessage = document.getElementById("success-message");
    if (successMessage) {
      successMessage.style.display = "block";
      successMessage.textContent = "✅ Email confirmed! You can now log in.";
    }
  }

  // -----------------------
  // LOGIN PAGE HANDLERS
  // -----------------------
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    const submitBtn = document.getElementById("login-submit");
    const errorMessage = document.getElementById("error-message");
    const successMessage = document.getElementById("success-message");
    const passwordToggle = document.getElementById("password-toggle");
    const passwordInput = document.getElementById("login-password");

    // Password visibility toggle
    passwordToggle?.addEventListener("click", (e) => {
      e.preventDefault();
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);
      passwordToggle.textContent = type === "password" ? "👁️" : "🙈";
    });

    // Form submission
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value.trim();

      errorMessage.style.display = "none";
      successMessage.style.display = "none";

      if (!email || !password) {
        showError(errorMessage, "Please fill in all fields.");
        return;
      }

      if (!isValidEmail(email)) {
        showError(errorMessage, "Please enter a valid email address.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading"></span>Logging in...';

      try {
        const res = await API.login(email, password);
        if (res.access_token) {
          showSuccess(successMessage, "Login successful! Redirecting...");
          setTimeout(() => {
            window.location.href = "index.html";
          }, 1500);
        } else {
          throw new Error("Login failed");
        }
      } catch (error) {
        console.error("Login error:", error);
        showError(errorMessage, "Invalid email or password. Please try again.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Login";
      }
    });
  }

  // -----------------------
  // SIGNUP PAGE HANDLERS
  // -----------------------
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    const submitBtn = document.getElementById("signup-submit");
    const errorMessage = document.getElementById("error-message");
    const successMessage = document.getElementById("success-message");
    const emailConfirmation = document.getElementById("email-confirmation");
    const userEmail = document.getElementById("user-email");

    const passwordInput = document.getElementById("signup-password");
    const confirmPasswordInput = document.getElementById("signup-confirm-password");
    const passwordToggle = document.getElementById("password-toggle");
    const confirmPasswordToggle = document.getElementById("confirm-password-toggle");
    const passwordStrength = document.getElementById("password-strength");
    const passwordMatch = document.getElementById("password-match");

    // Toggle passwords
    passwordToggle?.addEventListener("click", (e) => {
      e.preventDefault();
      togglePassword(passwordInput, passwordToggle);
    });
    confirmPasswordToggle?.addEventListener("click", (e) => {
      e.preventDefault();
      togglePassword(confirmPasswordInput, confirmPasswordToggle);
    });

    // Password strength + match
    passwordInput?.addEventListener("input", () => {
      checkPasswordStrength(passwordInput, passwordStrength);
      checkPasswordMatch(passwordInput, confirmPasswordInput, passwordMatch);
    });
    confirmPasswordInput?.addEventListener("input", () => {
      checkPasswordMatch(passwordInput, confirmPasswordInput, passwordMatch);
    });

    // Form submission
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("signup-name").value.trim();
      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value.trim();
      const confirmPassword = document.getElementById("signup-confirm-password").value.trim();
      const location = document.getElementById("signup-location").value.trim();

      errorMessage.style.display = "none";
      successMessage.style.display = "none";
      emailConfirmation.style.display = "none";

      if (!name || !email || !password || !confirmPassword) {
        showError(errorMessage, "Please fill in all required fields.");
        return;
      }
      if (!isValidEmail(email)) {
        showError(errorMessage, "Please enter a valid email address.");
        return;
      }
      if (password !== confirmPassword) {
        showError(errorMessage, "Passwords do not match.");
        return;
      }
      if (password.length < 8) {
        showError(errorMessage, "Password must be at least 8 characters long.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading"></span>Creating account...';

      try {
        const res = await API.register(name, email, password, location);
      
        if (res.error) {
          throw new Error(res.error.message || "Registration failed.");
        }
      
        // Signup success (even if user is null due to email confirmation)
        showError(
          errorMessage,
          "Account created! Please check your email to confirm your account."
        );
      
        signupForm.style.display = "none";
        userEmail.textContent = email;
        emailConfirmation.style.display = "block";
      
      } catch (error) {
        console.error("Signup error:", error);
        showError(errorMessage, error.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Create Account";
      }
      
      
      
      
    });
  }

  // -----------------------
  // Utility Functions
  // -----------------------
  function togglePassword(input, toggle) {
    const type = input.getAttribute("type") === "password" ? "text" : "password";
    input.setAttribute("type", type);
    toggle.textContent = type === "password" ? "👁️" : "🙈";
  }

  function checkPasswordStrength(passwordInput, strengthEl) {
    const password = passwordInput.value;
    if (!password) {
      strengthEl.style.display = "none";
      return;
    }
    const checks = [
      password.length >= 8,
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*(),.?":{}|<>]/.test(password),
    ];
    const score = checks.filter(Boolean).length;

    strengthEl.style.display = "block";
    if (score <= 2) {
      strengthEl.className = "password-strength weak";
      strengthEl.textContent = "Weak password. Add uppercase, numbers, and special characters.";
    } else if (score <= 3) {
      strengthEl.className = "password-strength medium";
      strengthEl.textContent = "Medium password. Consider adding more character types.";
    } else {
      strengthEl.className = "password-strength strong";
      strengthEl.textContent = "Strong password!";
    }
  }

  function checkPasswordMatch(passwordInput, confirmInput, matchEl) {
    if (!confirmInput.value) {
      matchEl.style.display = "none";
      confirmInput.classList.remove("valid", "invalid");
      return;
    }
    matchEl.style.display = "block";
    if (passwordInput.value === confirmInput.value) {
      matchEl.className = "password-match match";
      matchEl.textContent = "Passwords match";
      confirmInput.classList.add("valid");
      confirmInput.classList.remove("invalid");
    } else {
      matchEl.className = "password-match no-match";
      matchEl.textContent = "Passwords do not match";
      confirmInput.classList.add("invalid");
      confirmInput.classList.remove("valid");
    }
  }

  function showError(el, message) {
    el.textContent = message;
    el.style.display = "block";
  }

  function showSuccess(el, message) {
    el.textContent = message;
    el.style.display = "block";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
});
