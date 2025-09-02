from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
from datetime import datetime, timezone, timedelta

from functools import wraps
import requests
import time
import random
import openai
from openai import OpenAI

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)


# Environment config
FLASK_ENV = os.getenv('FLASK_ENV', 'development')
FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
# Update your CORS configuration
CORS(
    app,
    resources={r"/api/*": {
        "origins": [
            "http://127.0.0.1:5500",       # Local static server (e.g. VSCode Live Server)
            "http://localhost:5173",       # Vite/React dev server
            "http://127.0.0.1:5173",       # Alternate localhost
            "https://health-development.netlify.app"  # Production frontend
        ]
    }},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)

# Supabase config
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

# AI Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
HF_API_KEY = os.getenv('HF_API_KEY')


# Replace the existing hf_api_request function with this enhanced version
def ai_request_with_fallback(prompt, max_length=200):
    """
    Enhanced AI request system with multiple fallback options:
    1. First check medical knowledge base
    2. Try OpenAI API if available
    3. Fall back to Hugging Face if OpenAI fails
    4. Use local knowledge base as final fallback
    """
    
    # Check for common medical questions in knowledge base first
    prompt_lower = prompt.lower()
    
    # Enhanced medical knowledge base for common questions
    medical_responses = {
        "malaria": """Malaria is a serious mosquito-borne disease caused by Plasmodium parasites.

**Key Facts:**
• Transmitted by infected female Anopheles mosquitoes
• Symptoms: fever, chills, headache, muscle aches, fatigue, nausea, vomiting
• Can be life-threatening without prompt treatment
• Most prevalent in sub-Saharan Africa

**Prevention:**
• Use insecticide-treated bed nets
• Apply mosquito repellent
• Take antimalarial medication if traveling to endemic areas
• Eliminate standing water around homes

**When to seek help:** Immediate medical attention for fever in malaria-endemic areas

⚠️ Disclaimer: This is educational information only. Consult a healthcare professional for medical advice.""",
        
        "fever": """Fever is the body's natural response to infection and helps fight illness.

**Normal vs Fever:**
• Normal body temperature: 98.6°F (37°C)
• Low-grade fever: 99-100.4°F (37.2-38°C)
• Fever: Above 100.4°F (38°C)
• High fever: Above 103°F (39.4°C)

**Management:**
• Stay hydrated with water, clear broths
• Rest in a cool, comfortable environment
• Use light clothing and blankets
• Tepid sponge baths for comfort

**Seek immediate care if:**
• Fever above 104°F (40°C)
• Signs of dehydration
• Difficulty breathing
• Severe headache or neck stiffness
• Fever lasting more than 3 days

⚠️ Disclaimer: This is educational information only. Consult a healthcare professional for medical advice.""",
        
        "diabetes": """Diabetes is a chronic condition affecting how your body processes blood sugar (glucose).

**Types:**
• Type 1: Body produces little/no insulin (autoimmune)
• Type 2: Body doesn't use insulin effectively
• Gestational: Develops during pregnancy

**Common symptoms:**
• Increased thirst and frequent urination
• Extreme fatigue
• Blurred vision
• Slow-healing cuts/bruises
• Unexpected weight loss

**Management:**
• Regular blood sugar monitoring
• Healthy diet with controlled carbohydrates
• Regular physical activity
• Medication as prescribed
• Regular medical check-ups

**Complications if unmanaged:**
• Heart disease, stroke, kidney damage, nerve damage, vision problems

⚠️ Disclaimer: This is educational information only. Consult a healthcare professional for medical advice.""",
        
        "diarrhea": """Diarrhea is characterized by loose, watery stools occurring more frequently than normal.

**Common causes:**
• Viral infections (most common)
• Bacterial infections
• Food poisoning
• Medications
• Digestive disorders

**Management:**
• Stay hydrated - drink clear fluids, ORS
• BRAT diet: Bananas, Rice, Applesauce, Toast
• Avoid dairy, fatty, spicy foods
• Rest

**Seek medical help if:**
• Blood in stools
• High fever (above 102°F/39°C)
• Severe dehydration
• Lasting more than 3 days
• Severe abdominal pain

**Prevention:**
• Wash hands frequently
• Safe food handling
• Clean drinking water
• Proper sanitation

⚠️ Disclaimer: This is educational information only. Consult a healthcare professional for medical advice.""",
        
        "cough": """Cough is a reflex action to clear airways of irritants, mucus, or foreign particles.

**Types:**
• Dry cough: No mucus produced
• Wet cough: Produces mucus/phlegm
• Acute: Less than 3 weeks
• Chronic: More than 8 weeks

**Common causes:**
• Viral infections (colds, flu)
• Bacterial infections
• Allergies
• Asthma
• GERD

**Home management:**
• Stay hydrated
• Honey (for children over 1 year)
• Warm salt water gargling
• Humidifier or steam inhalation
• Avoid smoke and irritants

**Seek medical care if:**
• Blood in sputum
• High fever
• Difficulty breathing
• Chest pain
• Cough lasting more than 3 weeks

⚠️ Disclaimer: This is educational information only. Consult a healthcare professional for medical advice."""
    }
    
    # Step 1: Check if the prompt contains any medical terms in knowledge base
    for term, response in medical_responses.items():
        if term in prompt_lower:
            return response
    
    # Step 2: Try OpenAI API if available
    if OPENAI_API_KEY:
        try:
            print("Attempting OpenAI API request...")
            client = OpenAI(api_key=OPENAI_API_KEY)
            
            # Enhanced prompt for health context
            system_prompt = """You are a knowledgeable health education assistant helping community health workers. 
            Provide accurate, helpful medical information while emphasizing the importance of professional medical consultation. 
            Keep responses concise and practical for field use."""
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",  # You can use "gpt-4" if you have access
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=max_length,
                temperature=0.7,
                timeout=10
            )
            
            ai_text = response.choices[0].message.content.strip()
            
            if ai_text and len(ai_text) > 10:
                print("OpenAI API request successful")
                return ai_text + "\n\n⚠️ Disclaimer: This information is for educational purposes only. Always consult a licensed healthcare professional for medical advice."
                
        except openai.APIError as e:
            print(f"OpenAI API error: {e}")
        except openai.APIConnectionError as e:
            print(f"OpenAI connection error: {e}")
        except openai.RateLimitError as e:
            print(f"OpenAI rate limit error: {e}")
        except Exception as e:
            print(f"Unexpected OpenAI error: {e}")
    
    # Step 3: Fall back to Hugging Face if OpenAI fails or is not available
    if HF_API_KEY:
        print("Falling back to Hugging Face API...")
        
        # List of models to try (best for free tier, ordered by preference)
        models_to_try = [
            "mistralai/Mistral-7B-Instruct-v0.2",  # Good for conversations
            "google/flan-t5-base",  # Original choice
            "HuggingFaceH4/zephyr-7b-beta",  # Smaller, faster
            "tiiuae/falcon-7b-instruct-v2",  # Larger but might have rate limits
        ]
        
        for model in models_to_try:
            try:
                url = f"https://api-inference.huggingface.co/models/{model}"
                headers = {
                    "Authorization": f"Bearer {HF_API_KEY}",
                    "Content-Type": "application/json"
                }

                # Enhance prompt for health context
                enhanced_prompt = f"""As a health education assistant, respond to this health-related question with accurate, helpful information: {prompt}

Please provide clear, actionable guidance while emphasizing the importance of professional medical consultation."""

                payload = {
                    "inputs": enhanced_prompt,
                    "parameters": {
                        "max_length": max_length,
                        "temperature": 0.7,
                        "do_sample": True,
                        "return_full_text": False,
                        "pad_token_id": 50256
                    },
                    "options": {
                        "wait_for_model": True,
                        "use_cache": False
                    }
                }

                response = requests.post(url, headers=headers, json=payload, timeout=30)

                if response.status_code == 200:
                    result = response.json()
                    ai_text = None

                    if isinstance(result, list) and len(result) > 0:
                        ai_text = result[0].get("generated_text", "").strip()
                    elif isinstance(result, dict):
                        ai_text = result.get("generated_text", "").strip()

                    if ai_text and len(ai_text) > 10:  # Valid response
                        # Clean up the response
                        if ai_text.startswith(enhanced_prompt):
                            ai_text = ai_text[len(enhanced_prompt):].strip()
                        
                        print(f"Hugging Face API request successful with model {model}")
                        # Add health disclaimer
                        return ai_text + "\n\n⚠️ Disclaimer: This information is for educational purposes only. Always consult a licensed healthcare professional for medical advice."
                    
                elif response.status_code == 503:
                    print(f"Model {model} loading, trying next...")
                    continue  # Try next model
                else:
                    print(f"Model {model} failed with {response.status_code}: {response.text}")
                    continue  # Try next model
                    
            except requests.RequestException as e:
                print(f"Request error with model {model}: {e}")
                continue  # Try next model
    
    # Step 4: Final fallback - provide helpful generic response
    print("All AI services unavailable, using fallback response")
    return f"""I understand you're asking about: "{prompt[:100]}{'...' if len(prompt) > 100 else ''}"

**For health-related questions, I recommend:**
• Consulting with a qualified healthcare professional
• Visiting your local health facility
• Calling your country's health helpline
• Using official health organization resources (WHO, CDC, local health ministry)

**Common health topics I can help with:**
• Malaria prevention and symptoms
• Fever management
• Diabetes basics
• Diarrhea treatment
• Cough care
• Basic first aid
• Nutrition guidelines
• Hygiene practices

**To enable AI-powered responses:**
1. Set OPENAI_API_KEY in your .env file for OpenAI (primary)
2. Set HF_API_KEY in your .env file for Hugging Face (fallback)

⚠️ Disclaimer: This is educational information only. Always consult a licensed healthcare professional for medical advice."""


def supabase_request(method, endpoint, data=None, params=None, use_service_key=False):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    api_key = SUPABASE_SERVICE_KEY if use_service_key else SUPABASE_KEY

    headers = {
        'apikey': api_key,
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'  # 👈 ensures Supabase returns JSON rows
    }

    try:
        if method == 'GET':
            resp = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == 'POST':
            resp = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == 'PATCH':
            resp = requests.patch(url, headers=headers, json=data, timeout=10)
        elif method == 'DELETE':
            resp = requests.delete(url, headers=headers, timeout=10)
        else:
            return None

        if resp.status_code < 400:
            if resp.text.strip():  # only parse JSON if not empty
                return resp.json()
            return []  # return empty list if no body
        else:
            print(f"Supabase error {resp.status_code}: {resp.text}")
            return None
    except requests.RequestException as e:
        print(f"Supabase request error: {e}")
        return None


# ----------------------
# Auth Middleware
# ----------------------

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Authorization header missing'}), 401

        try:
            token = auth_header.split(' ')[1]

            # Validate token with Supabase
            url = f"{SUPABASE_URL}/auth/v1/user"
            headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"}
            resp = requests.get(url, headers=headers, timeout=10)

            if resp.status_code >= 400:
                return jsonify({'error': 'Invalid Supabase token'}), 401

            user = resp.json()
            current_user_id = user["id"]

        except Exception as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401

        return f(current_user_id, *args, **kwargs)
    return decorated


# ----------------------
# Routes
# ----------------------

@app.route('/')
def index():
    return jsonify({
        'message': 'HealthGuide Community API',
        'version': '2.1',
        'status': 'active',
        'ai_enabled': bool(HF_API_KEY),
        'features': ['auth', 'training', 'ai_chat', 'symptom_checker', 'community']
    })


# Auth: Register user
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    location = data.get('location')
    role = data.get('role', 'health_worker')

    if not email or not password or not name or not location:
        return jsonify({'error': 'Missing required fields'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    # Call Supabase signup API
    url = f"{SUPABASE_URL}/auth/v1/signup"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "email": email,
        "password": password,
        "data": {
            "name": name,
            "location": location,
            "role": role
        },
        "redirect_to": "http://127.0.0.1:5500/frontend/login.html?status=verified"
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=10)

    if resp.status_code >= 400:
        return jsonify({'error': resp.text}), resp.status_code

    resp_json = resp.json()
    user = resp_json.get("user")

    # If Supabase doesn't return a user yet (email confirmation required)
    if not user:
        return jsonify({
            "message": "User created. Please check your email to confirm your account.",
            "user": None,
            "supabase_response": resp_json
        }), 201

    # Insert into profiles table with correct ID
    supabase_request('POST', 'profiles', {
        'id': user["id"],
        'name': name,
        'location': location,
        'role': role
    }, use_service_key=True)

    return jsonify({
        'message': 'User registered successfully. Please check your email to confirm.',
        'user': user
    }), 201



# Auth: Login user
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400

    # Supabase login endpoint
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json"
    }
    payload = {"email": email, "password": password}
    resp = requests.post(url, headers=headers, json=payload, timeout=10)

    if resp.status_code >= 400:
        return jsonify({'error': resp.text}), resp.status_code

    data = resp.json()
    user = data.get("user")
    access_token = data.get("access_token")
    refresh_token = data.get("refresh_token")

    if not user or not user.get("id"):
        return jsonify({'error': 'Login successful, but user object missing'}), 200

    user_id = user["id"]

    # --- Check if profile exists ---
    profile_resp = supabase_request('GET', f'profiles?id=eq.{user_id}', use_service_key=True)

    if isinstance(profile_resp, list) and len(profile_resp) == 0:
        # Profile does not exist -> create it
        user_metadata = user.get("user_metadata", {})
        name = user_metadata.get("name", "")
        location = user_metadata.get("location", "")
        role = user_metadata.get("role", "health_worker")

        supabase_request('POST', 'profiles', {
            "id": user_id,
            "name": name,
            "location": location,
            "role": role
        }, use_service_key=True)

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user
    }), 200


# Profile
@app.route('/api/users/profile', methods=['GET'])
@token_required
def get_profile(current_user_id):
    profile = supabase_request('GET', f'profiles?id=eq.{current_user_id}')
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404
    return jsonify({'profile': profile[0]}), 200

import requests
from flask import request, jsonify

INTASEND_SECRET_KEY = os.getenv("INTASEND_SECRET_KEY")
API_BASE = "https://sandbox.intasend.com/api/v1"

@app.route("/api/payments/create-subscription", methods=["POST"])
@token_required
def create_subscription(current_user_id):
    data = request.get_json()
    plan_id = data.get("plan")

    resp = requests.post(f"{API_BASE}/subscriptions/", 
        headers={"Authorization": f"Bearer {INTASEND_SECRET_KEY}"},
        json={
            "plan": plan_id,
            "customer": {"user_id": current_user_id}
        })

    if resp.status_code != 200:
        return jsonify({"error": resp.text}), resp.status_code

    sub = resp.json()
    # Save subscription ID to Supabase – similar to Stripe flow
    supabase_request("POST", "subscriptions", {
        "user_id": current_user_id,
        "status": "active",
        "intasend_subscription_id": sub["id"]
    }, use_service_key=True)

    return jsonify(sub), 200
def subscription_required(f):
    @wraps(f)
    def decorated(current_user_id, *args, **kwargs):
        subs = supabase_request(
            "GET", f"subscriptions?user_id=eq.{current_user_id}&status=eq.active"
        )
        if not subs:
            return jsonify({"error": "Active subscription required"}), 403
        return f(current_user_id, *args, **kwargs)
    return decorated

# Training modules list
@app.route('/api/training/modules', methods=['GET'])
@token_required
def get_training_modules(current_user_id):
    modules = supabase_request('GET', 'modules?is_published=eq.true') or []
    progress = supabase_request('GET', f'user_progress?user_id=eq.{current_user_id}') or []
    completed_ids = [p['module_id'] for p in progress]

    data = []
    for m in modules:
        data.append({
            'id': m['id'],
            'title': m['title'],
            'slug': m.get('slug'),
            'difficulty': m.get('difficulty'),
            'estimated_time': m.get('estimated_time'),
            'completed': m['id'] in completed_ids
        })
    return jsonify({'modules': data}), 200


# Training module details
@app.route('/api/training/modules/<identifier>', methods=['GET'])
@token_required
def get_training_module(current_user_id, identifier):
    if identifier.isdigit():
        filter_query = f'id=eq.{identifier}'
    else:
        filter_query = f'slug=eq.{identifier}'

    modules = supabase_request('GET', f'modules?{filter_query}&is_published=eq.true')
    if not modules:
        return jsonify({'error': 'Module not found'}), 404

    module = modules[0]
    return jsonify({
        'id': module['id'],
        'title': module['title'],
        'description': module.get('description'),
        'content': module.get('content'),
        'slug': module.get('slug'),
        'difficulty': module.get('difficulty'),
        'estimated_time': module.get('estimated_time'),
        'created_at': module.get('created_at'),
        'updated_at': module.get('updated_at')
    }), 200


# Update profile
@app.route('/api/users/profile', methods=['PUT'])
@token_required
def update_profile(current_user_id):
    data = request.get_json()
    # Use PATCH instead of PUT and add proper filter
    profile = supabase_request('PATCH', f'profiles?id=eq.{current_user_id}', data, use_service_key=True)
    if not profile:
        return jsonify({'error': 'Failed to update profile'}), 500
    return jsonify({'profile': profile[0] if profile else {}}), 200


# Training progress
@app.route('/api/training/progress', methods=['GET'])
@token_required
def get_progress(current_user_id):
    progress = supabase_request('GET', f'user_progress?user_id=eq.{current_user_id}') or []
    return jsonify({'progress': progress}), 200


@app.route('/api/training/progress', methods=['POST'])
@token_required
def update_progress(current_user_id):
    data = request.get_json() or {}
    module_id = data.get('moduleId')
    progress = data.get('progress', 0)  # frontend sends "progress"

    if not module_id:
        return jsonify({'error': 'Module ID required'}), 400

    # Map progress → score
    progress_data = {
        "user_id": current_user_id,
        "module_id": module_id,
        "score": progress,  # use score column instead of progress
        "completed": progress >= 100,  # auto-complete if full progress
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    # Optional: add completed_at only when fully done
    if progress >= 100:
        progress_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    # Upsert ensures (user_id, module_id) is unique
    result = supabase_request(
        "POST",
        "user_progress",
        progress_data,
        use_service_key=True
    )

    if not result:
        return jsonify({"error": "Failed to update progress"}), 500

    return jsonify({"progress": result[0]}), 200

# Mark training module complete
from datetime import datetime, timezone

@app.route('/api/training/modules/<int:module_id>/complete', methods=['POST'])
@token_required
def mark_module_complete(current_user_id, module_id):
    """Mark a training module as complete for the current user"""

    # Check if user profile exists
    user_check = supabase_request(
        "GET",
        "profiles",
        {"id": current_user_id},
        use_service_key=True
    )

    if not user_check:
        # Auto-create a profile with default values
        profile_data = {
            "id": current_user_id,
            "name": f"User {current_user_id[:8]}",  # fallback name
            "location": "Unknown",
            "role": "health_worker",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        create_profile = supabase_request(
            "POST",
            "profiles",
            profile_data,
            use_service_key=True
        )

        if not create_profile:
            return jsonify({
                "error": "Failed to create user profile. Cannot mark module complete."
            }), 500

    # Insert module completion into user_progress
    completion_data = {
        "user_id": current_user_id,
        "module_id": module_id,
        "score": 100,       # or progress
        "completed": True,
        "completed_at": datetime.now(timezone.utc).isoformat()
    }

    result = supabase_request("POST", "user_progress", completion_data, use_service_key=True)

    if not result:
        return jsonify({"error": "Failed to mark module as complete"}), 500

    return jsonify({"success": True, "progress": result[0]}), 200

# AI Chat
@app.route('/api/ai/chat', methods=['POST'])
@token_required
def ai_chat(current_user_id):
    data = request.get_json()
    message = data.get('message', '')

    if not message:
        return jsonify({'error': 'Message required'}), 400

    # Get AI response using enhanced multi-provider system
    ai_response = ai_request_with_fallback(message)
    
    # Track which service was used
    service_used = 'knowledge_base'
    if OPENAI_API_KEY and 'OpenAI' not in ai_response:
        service_used = 'openai'
    elif HF_API_KEY and 'Hugging Face' not in ai_response:
        service_used = 'huggingface'
    
    return jsonify({
        'response': ai_response, 
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'user_id': current_user_id,
        'model_used': service_used
    }), 200


# Test AI Chat (no auth required for testing)
@app.route('/api/ai/test', methods=['POST'])
def test_ai_chat():
    data = request.get_json()
    message = data.get('message', '')

    if not message:
        return jsonify({'error': 'Message required'}), 400

    # Get AI response using enhanced multi-provider system
    ai_response = ai_request_with_fallback(message)
    
    # Track which service was used
    service_used = 'knowledge_base'
    if OPENAI_API_KEY and 'OpenAI' not in ai_response:
        service_used = 'openai'
    elif HF_API_KEY and 'Hugging Face' not in ai_response:
        service_used = 'huggingface'
    
    return jsonify({
        'response': ai_response, 
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'test': True,
        'model_used': service_used,
        'providers_available': {
            'openai': bool(OPENAI_API_KEY),
            'huggingface': bool(HF_API_KEY)
        }
    }), 200


# Symptom Checker
@app.route('/api/ai/symptom-check', methods=['POST'])
@token_required
def symptom_check(current_user_id):
    data = request.get_json()
    symptoms = data.get('symptoms', [])

    if not symptoms:
        return jsonify({'error': 'Symptoms required'}), 400

    # Create a symptom analysis prompt
    if isinstance(symptoms, list):
        symptoms_text = ', '.join(symptoms)
    else:
        symptoms_text = str(symptoms)
    
    prompt = f"""Analyze these health symptoms for triage assessment: {symptoms_text}

Please provide:
1. Urgency level (LOW/MODERATE/HIGH)
2. Possible conditions to consider
3. Immediate recommendations
4. When to seek medical care

Focus on community health worker guidance."""
    
    # Get AI analysis using enhanced multi-provider system
    ai_analysis = ai_request_with_fallback(prompt, max_length=250)
    
    # Enhanced fallback logic based on symptoms
    urgency_level = 'low'
    recommendations = ['Monitor symptoms closely', 'Ensure adequate rest', 'Stay well hydrated']
    
    # Convert symptoms to lowercase for checking
    symptoms_lower = [s.lower() if isinstance(s, str) else str(s).lower() for s in (symptoms if isinstance(symptoms, list) else [symptoms])]
    
    high_risk_symptoms = ['difficulty breathing', 'chest pain', 'severe headache', 'high fever', 'blood', 'seizure']
    moderate_risk_symptoms = ['fever', 'persistent cough', 'vomiting', 'diarrhea', 'severe pain']
    
    if any(symptom in ' '.join(symptoms_lower) for symptom in high_risk_symptoms):
        urgency_level = 'high'
        recommendations = ['Seek immediate medical attention', 'Do not delay', 'Go to nearest health facility']
    elif any(symptom in ' '.join(symptoms_lower) for symptom in moderate_risk_symptoms):
        urgency_level = 'moderate'
        recommendations.append('Consider consulting a healthcare provider within 24 hours')

    return jsonify({
        'urgency_level': urgency_level,
        'recommendations': recommendations,
        'symptoms': symptoms,
        'ai_analysis': ai_analysis,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }), 200


# Drug Interaction Checker
@app.route('/api/ai/drug-interaction', methods=['POST'])
@token_required
def drug_interaction_checker(current_user_id):
    data = request.get_json()
    drugs = data.get('drugs', [])

    if not drugs or not isinstance(drugs, list) or len(drugs) < 2:
        return jsonify({'error': 'At least two drugs are required for interaction check'}), 400

    # Convert to readable text
    drug_list = ', '.join(drugs)

    # Create prompt for AI
    prompt = f"""Analyze potential drug interactions between the following medications: {drug_list}.

Please provide:
1. Potential interaction risks
2. Severity (LOW/MODERATE/HIGH)
3. Key safety warnings
4. Recommendations for monitoring or safer alternatives

⚠️ Focus on community health worker guidance. Do NOT replace professional medical advice."""

    # Call enhanced AI system
    ai_analysis = ai_request_with_fallback(prompt, max_length=300)

    # Basic fallback logic (if AI not available)
    severity = "unknown"
    if any("antibiotic" in d.lower() for d in drugs) and any("antimalarial" in d.lower() for d in drugs):
        severity = "moderate"
    elif any("ibuprofen" in d.lower() for d in drugs) and any("paracetamol" in d.lower() for d in drugs):
        severity = "low"
    elif any("warfarin" in d.lower() for d in drugs):
        severity = "high"

    return jsonify({
        "drugs_checked": drugs,
        "severity": severity,
        "ai_analysis": ai_analysis,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": current_user_id
    }), 200

# ==================== COMMUNITY FEATURES ====================

# Get all forum posts
@app.route('/api/community/posts', methods=['GET'])
@token_required
def get_forum_posts(current_user_id):
    """Get paginated forum posts with author details"""
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 20)), 50)  # Max 50 posts per page
    offset = (page - 1) * limit

    # Get posts with author information
    posts = supabase_request('GET', 
        f'forum_posts?select=*,profiles(name,location)&order=created_at.desc&limit={limit}&offset={offset}') or []
    
    # Get total count for pagination (simplified - just return what we have)
    total_count = len(posts) + offset  # Rough estimate

    return jsonify({
        'posts': posts,
        'pagination': {
            'page': page,
            'limit': limit,
            'total': total_count,
            'has_more': len(posts) == limit  # If we got full page, assume there might be more
        }
    }), 200


# Create new forum post
@app.route("/api/community/posts", methods=["POST"])
@token_required
def create_forum_post(current_user_id):
    """Create a new forum post"""
    body = request.get_json() or {}

    title = body.get("title")
    content = body.get("content")
    category = body.get("category")

    if not title or not content or not category:
        return jsonify({"error": "Title, content, and category are required"}), 400

    allowed_categories = [
        "general", "best_practices", "case_studies",
        "resources", "success_stories", "questions"
    ]
    if category not in allowed_categories:
        return jsonify({"error": f"Invalid category. Must be one of {allowed_categories}"}), 400

    data = {
        "user_id": current_user_id,
        "title": title,
        "content": content,
        "category": category,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    # Use service key to bypass RLS policies
    result = supabase_request("POST", "forum_posts", data, use_service_key=True)

    if not result:
        return jsonify({"error": "Failed to create post"}), 500

    return jsonify({"post": result[0] if result else {}, "message": "Post created successfully"}), 201


# Get single forum post with comments
@app.route('/api/community/posts/<int:post_id>', methods=['GET'])
@token_required
def get_forum_post(current_user_id, post_id):
    """Get single post with comments"""
    # Get the post with author info
    post = supabase_request('GET', 
        f'forum_posts?select=*,profiles(name,location)&id=eq.{post_id}')
    
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    # Get comments for this post
    comments = supabase_request('GET', 
        f'forum_comments?select=*,profiles(name,location)&post_id=eq.{post_id}&order=created_at.asc') or []

    return jsonify({
        'post': post[0],
        'comments': comments
    }), 200


# Add comment to forum post
@app.route('/api/community/posts/<int:post_id>/comments', methods=['POST'])
@token_required
def add_comment(current_user_id, post_id):
    """Add comment to a forum post"""
    data = request.get_json()
    content = data.get('content', '').strip()

    if not content:
        return jsonify({'error': 'Comment content is required'}), 400

    if len(content) < 5:
        return jsonify({'error': 'Comment must be at least 5 characters'}), 400

    # Check if post exists
    post = supabase_request('GET', f'forum_posts?id=eq.{post_id}')
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    comment_data = {
        'post_id': post_id,
        'author_id': current_user_id,
        'content': content,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    # Use service key to bypass RLS policies
    result = supabase_request('POST', 'forum_comments', comment_data, use_service_key=True)
    if not result:
        return jsonify({'error': 'Failed to add comment'}), 500

    return jsonify({'comment': result[0] if result else {}, 'message': 'Comment added successfully'}), 201


# Get success stories
@app.route('/api/community/success-stories', methods=['GET'])
@token_required
def get_success_stories(current_user_id):
    """Get paginated success stories"""
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 10)), 20)  # Max 20 stories per page
    offset = (page - 1) * limit

    stories = supabase_request('GET', 
        f'success_stories?select=*,profiles(name,location)&is_approved=eq.true&order=created_at.desc&limit={limit}&offset={offset}') or []

    return jsonify({'stories': stories}), 200


# Submit success story
@app.route('/api/community/success-stories', methods=['POST'])
@token_required
def submit_success_story(current_user_id):
    """Submit a new success story"""
    data = request.get_json()
    title = data.get('title', '').strip()
    story = data.get('story', '').strip()

    if not title or not story:
        return jsonify({'error': 'Title and story content are required'}), 400

    if len(title) < 10:
        return jsonify({'error': 'Title must be at least 10 characters'}), 400

    if len(story) < 50:
        return jsonify({'error': 'Story must be at least 50 characters'}), 400

    story_data = {
        'author_id': current_user_id,
        'title': title,
        'story': story,
        'is_approved': True,  # Auto-approve for now, change to False if you want manual approval
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    # Use service key to bypass RLS policies
    result = supabase_request('POST', 'success_stories', story_data, use_service_key=True)
    if not result:
        return jsonify({'error': 'Failed to submit story'}), 500

    return jsonify({
        'story': result[0] if result else {}, 
        'message': 'Success story submitted successfully!'
    }), 201


# Get local events
@app.route('/api/community/events', methods=['GET'])
@token_required
def get_local_events(current_user_id):
    """Get upcoming local events"""
    today = datetime.now(timezone.utc).date().isoformat()
    
    events = supabase_request('GET', 
        f'local_events?event_date=gte.{today}&is_active=eq.true&order=event_date.asc&limit=20') or []

    return jsonify({'events': events}), 200


# Create local event
@app.route('/api/community/events', methods=['POST'])
@token_required
def create_local_event(current_user_id):
    """Create a new local event"""
    data = request.get_json()
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    event_date = data.get('event_date')
    event_time = data.get('event_time')
    location = data.get('location', '').strip()

    if not title or not description or not event_date or not location:
        return jsonify({'error': 'Title, description, date, and location are required'}), 400

    try:
        # Validate date format
        datetime.fromisoformat(event_date.replace('Z', '+00:00'))
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400

    event_data = {
        'organizer_id': current_user_id,
        'title': title,
        'description': description,
        'event_date': event_date,
        'event_time': event_time,
        'location': location,
        'is_active': True,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }

    # Use service key to bypass RLS policies
    result = supabase_request('POST', 'local_events', event_data, use_service_key=True)
    if not result:
        return jsonify({'error': 'Failed to create event'}), 500

    return jsonify({'event': result[0] if result else {}, 'message': 'Event created successfully'}), 201


# Get community stats
@app.route('/api/community/stats', methods=['GET'])
@token_required
def get_community_stats(current_user_id):
    """Get community statistics"""
    # Count active discussions (posts from last 7 days)
    seven_days_ago = (datetime.now(timezone.utc).date() - timedelta(days=7)).isoformat()
    
    stats = {
        'active_discussions': 0,
        'total_members': 0,
        'success_stories': 0,
        'upcoming_events': 0
    }

    try:
        # Get active discussions
        recent_posts = supabase_request('GET', f'forum_posts?created_at=gte.{seven_days_ago}T00:00:00') or []
        stats['active_discussions'] = len(recent_posts)

        # Get total members (simplified count)
        profiles = supabase_request('GET', 'profiles?select=id&limit=1000') or []
        stats['total_members'] = len(profiles)

        # Get success stories count
        stories = supabase_request('GET', 'success_stories?select=id&is_approved=eq.true&limit=1000') or []
        stats['success_stories'] = len(stories)

        # Get upcoming events
        today = datetime.now(timezone.utc).date().isoformat()
        events = supabase_request('GET', f'local_events?select=id&event_date=gte.{today}&is_active=eq.true&limit=1000') or []
        stats['upcoming_events'] = len(events)

    except Exception as e:
        print(f"Error fetching community stats: {e}")

    return jsonify({'stats': stats}), 200


# Search forum posts
@app.route('/api/community/search', methods=['GET'])
@token_required
def search_forum_posts(current_user_id):
    """Search forum posts by title or content"""
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'Search query is required'}), 400

    if len(query) < 3:
        return jsonify({'error': 'Search query must be at least 3 characters'}), 400

    # Use text search (this depends on your database setup)
    # For basic search, we'll use ilike (case-insensitive like)
    posts = supabase_request('GET', 
        f'forum_posts?select=*,profiles(name,location)&or=(title.ilike.%25{query}%25,content.ilike.%25{query}%25)&order=created_at.desc&limit=20') or []

    return jsonify({
        'posts': posts,
        'query': query,
        'count': len(posts)
    }), 200


# Health check
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'supabase': bool(SUPABASE_URL and SUPABASE_KEY),
        'ai_enabled': bool(HF_API_KEY),
        'version': '2.1'
    })


# API status endpoint
@app.route('/api/status', methods=['GET'])
def api_status():
    return jsonify({
        'api_status': 'active',
        'ai_enabled': bool(HF_API_KEY),
        'database_connected': bool(SUPABASE_URL and SUPABASE_KEY),
        'timestamp': datetime.now(timezone.utc).isoformat()
    })


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"Starting HealthGuide Community API on port {port}")
    print(f"AI Enabled: {bool(HF_API_KEY)}")
    print(f"Supabase Connected: {bool(SUPABASE_URL and SUPABASE_KEY)}")
    app.run(debug=FLASK_DEBUG, host='0.0.0.0', port=port)