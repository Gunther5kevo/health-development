// =======================
// login.js - Enhanced for Login and Reset Password Pages
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
  // RESET PASSWORD PAGE HANDLERS
  // (Only runs when on reset-password.html page)
  // -----------------------
  if (window.location.pathname.includes('reset-password.html') || document.getElementById('reset-form-section')) {
    
    // Extract tokens from URL hash (Supabase uses hash, not search params)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const error = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');

    console.log('Reset Password Page - Hash Params:', {
      accessToken: accessToken ? 'present' : 'missing',
      error,
      errorDescription
    });

    // Check for errors first
    if (error || !accessToken) {
      console.log('Error detected or no access token');
      showResetSection('error');
      
      // Show specific error message if available
      if (errorDescription) {
        const errorText = errorDescription.replace(/\+/g, ' ');
        const errorEl = document.querySelector('#error-section .confirmation-text');
        if (errorEl) {
          errorEl.textContent = `Error: ${errorText}`;
        }
      }
    } else {
      console.log('Access token found, showing reset form');
      showResetSection('form');

      // Get form elements
      const resetForm = document.getElementById('reset-password-form');
      const newPasswordInput = document.getElementById('new-password');
      const confirmPasswordInput = document.getElementById('confirm-password');
      const submitBtn = document.getElementById('reset-submit');
      const passwordStrengthEl = document.getElementById('password-strength');
      const passwordMatchEl = document.getElementById('password-match');

      // Password visibility toggles
      const passwordToggle = document.getElementById('password-toggle');
      const confirmPasswordToggle = document.getElementById('confirm-password-toggle');

      if (passwordToggle && newPasswordInput) {
        passwordToggle.addEventListener('click', (e) => {
          e.preventDefault();
          togglePassword(newPasswordInput, passwordToggle);
        });
      }

      if (confirmPasswordToggle && confirmPasswordInput) {
        confirmPasswordToggle.addEventListener('click', (e) => {
          e.preventDefault();
          togglePassword(confirmPasswordInput, confirmPasswordToggle);
        });
      }

      // Password strength and match validation
      newPasswordInput?.addEventListener('input', () => {
        checkPasswordStrength(newPasswordInput, passwordStrengthEl);
        if (confirmPasswordInput.value) {
          checkPasswordMatch(newPasswordInput, confirmPasswordInput, passwordMatchEl);
        }
      });

      confirmPasswordInput?.addEventListener('input', () => {
        checkPasswordMatch(newPasswordInput, confirmPasswordInput, passwordMatchEl);
      });

      // Form submission
      if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const newPassword = newPasswordInput.value.trim();
          const confirmPassword = confirmPasswordInput.value.trim();
          const errorMessage = document.getElementById('error-message');
          const successMessage = document.getElementById('success-message');

          // Clear previous messages
          if (errorMessage) errorMessage.style.display = 'none';
          if (successMessage) successMessage.style.display = 'none';

          // Validation
          if (!newPassword || !confirmPassword) {
            showError(errorMessage, 'Please fill in all fields');
            return;
          }

          if (newPassword !== confirmPassword) {
            showError(errorMessage, 'Passwords do not match');
            return;
          }

          if (newPassword.length < 8) {
            showError(errorMessage, 'Password must be at least 8 characters long');
            return;
          }

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="loading"></span>Updating Password...';

          try {
            // Get API base URL
            const apiBase = getApiBase();
            
            const response = await fetch(`${apiBase}/auth/reset-password`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                access_token: accessToken,
                password: newPassword
              })
            });

            const result = await response.json();

            if (result.success) {
              showResetSection('success');
              // Clear the URL hash to prevent reuse
              window.location.hash = '';
            } else {
              throw new Error(result.error?.message || 'Failed to reset password');
            }
          } catch (error) {
            console.error('Password reset error:', error);
            showError(errorMessage, error.message || 'An error occurred. Please try again.');
          } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Update Password';
          }
        });
      }
    }
    
    // Exit early - we're on reset password page, don't run login page logic
    return;
  }

  // -----------------------
  // LOGIN PAGE LOGIC (only runs on login.html)
  // -----------------------

  // Section references (only for login page)
  const loginSection = document.getElementById("login-section");
  const forgotPasswordSection = document.getElementById("forgot-password-section");

  // Navigation buttons
  const showForgotPasswordBtn = document.getElementById("show-forgot-password");
  const backToLoginBtn = document.getElementById("back-to-login");

  // -----------------------
  // NAVIGATION HANDLERS
  // -----------------------
  showForgotPasswordBtn?.addEventListener("click", () => {
    showSection("forgot-password");
  });

  backToLoginBtn?.addEventListener("click", () => {
    showSection("login");
    clearForgotPasswordForm();
  });

  function showSection(section) {
    if (loginSection) loginSection.style.display = section === "login" ? "block" : "none";
    if (forgotPasswordSection) forgotPasswordSection.style.display = section === "forgot-password" ? "block" : "none";
    
    // Clear any error/success messages when switching sections
    clearMessages();
  }

  function clearMessages() {
    const messages = document.querySelectorAll(".error-message, .success-message");
    messages.forEach(msg => {
      msg.style.display = "none";
      msg.textContent = "";
    });
  }

  function clearForgotPasswordForm() {
    const forgotForm = document.getElementById("forgot-password-form");
    if (forgotForm) {
      forgotForm.reset();
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
  // FORGOT PASSWORD HANDLERS
  // -----------------------
  const forgotPasswordForm = document.getElementById("forgot-password-form");
  if (forgotPasswordForm) {
    const submitBtn = document.getElementById("forgot-submit");
    const errorMessage = document.getElementById("forgot-error-message");
    const successMessage = document.getElementById("forgot-success-message");

    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("forgot-email").value.trim();

      errorMessage.style.display = "none";
      successMessage.style.display = "none";

      if (!email) {
        showError(errorMessage, "Please enter your email address.");
        return;
      }

      if (!isValidEmail(email)) {
        showError(errorMessage, "Please enter a valid email address.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading"></span>Sending...';

      try {
        const res = await API.requestPasswordReset(email);
        
        if (res.success || res.message) {
          showSuccess(successMessage, "Password reset email sent! Please check your email and follow the instructions.");
          // Clear the form
          forgotPasswordForm.reset();
          // Optionally go back to login after a delay
          setTimeout(() => {
            showSection("login");
          }, 3000);
        } else {
          throw new Error(res.error || "Failed to send reset email");
        }
      } catch (error) {
        console.error("Password reset error:", error);
        showError(errorMessage, "Failed to send reset email. Please check your email address and try again.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Send Reset Link";
      }
    });
  }

  // -----------------------
  // SIGNUP PAGE HANDLERS (unchanged)
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
});

// -----------------------
// UTILITY FUNCTIONS
// -----------------------

function showResetSection(section) {
  const formSection = document.getElementById('reset-form-section');
  const successSection = document.getElementById('success-section');
  const errorSection = document.getElementById('error-section');

  if (formSection) formSection.style.display = section === 'form' ? 'block' : 'none';
  if (successSection) successSection.style.display = section === 'success' ? 'block' : 'none';
  if (errorSection) errorSection.style.display = section === 'error' ? 'block' : 'none';
}

function getApiBase() {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return "https://health-development.onrender.com/api";
  }
  return "http://127.0.0.1:5000/api";
}

function togglePassword(input, toggle) {
  const type = input.getAttribute("type") === "password" ? "text" : "password";
  input.setAttribute("type", type);
  toggle.textContent = type === "password" ? "👁️" : "🙈";
}

function checkPasswordStrength(passwordInput, strengthEl) {
  if (!strengthEl) return;
  
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
  if (!matchEl) return;
  
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
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  }
}

function showSuccess(el, message) {
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}