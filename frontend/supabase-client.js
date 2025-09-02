// Supabase Client for HealthGuide Community
// This file handles direct Supabase integration for real-time features

class SupabaseClient {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.isInitialized = false;
    }

    // Initialize Supabase client
    async initialize() {
        if (this.isInitialized) return true;

        try {
            // Wait for CONFIG to be loaded
            if (!window.CONFIG || !CONFIG.SUPABASE_URL) {
                console.log('⏳ Waiting for configuration...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Import Supabase client from CDN
            if (!window.supabase) {
                await this.loadSupabaseSDK();
            }

            // Create Supabase client
            this.supabase = window.supabase.createClient(
                CONFIG.SUPABASE_URL,
                CONFIG.SUPABASE_ANON_KEY
            );

            // Set up auth state listener
            this.setupAuthListener();

            this.isInitialized = true;
            console.log('✅ Supabase client initialized');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize Supabase client:', error);
            return false;
        }
    }

    // Load Supabase SDK from CDN
    async loadSupabaseSDK() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/supabase/2.38.0/supabase.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Set up authentication state listener
    setupAuthListener() {
        this.supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔐 Auth state changed:', event);

            if (event === 'SIGNED_IN') {
                this.currentUser = session.user;
                await this.syncUserProfile(session.user);
                UTILS.showNotification('Successfully logged in!', 'success');
                ANALYTICS.track('user_signed_in');
            } 
            else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                localStorage.removeItem('currentUser');
                UTILS.showNotification('Logged out successfully', 'info');
                ANALYTICS.track('user_signed_out');
            }
            else if (event === 'TOKEN_REFRESHED') {
                console.log('🔄 Token refreshed');
            }
        });
    }

    // Sync user profile data
    async syncUserProfile(authUser) {
        try {
            const { data: profile, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                console.error('Profile sync error:', error);
                return;
            }

            if (!profile) {
                // Create profile if doesn't exist
                const { data: newProfile, error: createError } = await this.supabase
                    .from('users')
                    .insert([{
                        id: authUser.id,
                        email: authUser.email,
                        name: authUser.user_metadata?.name || 'New User',
                        location: 'Kenya'
                    }])
                    .select()
                    .single();

                if (createError) {
                    console.error('Profile creation error:', createError);
                    return;
                }

                localStorage.setItem('currentUser', JSON.stringify(newProfile));
            } else {
                localStorage.setItem('currentUser', JSON.stringify(profile));
            }

        } catch (error) {
            console.error('Profile sync failed:', error);
        }
    }

    // Authentication methods
    async signUp(email, password, userData = {}) {
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: userData.name || 'New User',
                        location: userData.location || 'Kenya'
                    }
                }
            });

            if (error) throw error;

            UTILS.showNotification('Registration successful! Please check your email for confirmation.', 'success');
            ANALYTICS.track('user_signup_attempted');

            return { success: true, data };

        } catch (error) {
            console.error('Signup error:', error);
            UTILS.showNotification(error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    async signIn(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            return { success: true, data };

        } catch (error) {
            console.error('Signin error:', error);
            UTILS.showNotification(error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;

            return { success: true };

        } catch (error) {
            console.error('Signout error:', error);
            UTILS.showNotification(error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    async resetPassword(email) {
        try {
            const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${CONFIG.APP_URL}/reset-password`
            });

            if (error) throw error;

            UTILS.showNotification('Password reset email sent!', 'success');
            return { success: true, data };

        } catch (error) {
            console.error('Reset password error:', error);
            UTILS.showNotification(error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    // Real-time subscriptions
    subscribeToForumPosts(callback) {
        return this.supabase
            .channel('forum_posts_channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'forum_posts' }, 
                callback
            )
            .subscribe();
    }

    subscribeToNotifications(userId, callback) {
        return this.supabase
            .channel('notifications_channel')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                }, 
                callback
            )
            .subscribe();
    }

    subscribeToUserProgress(userId, callback) {
        return this.supabase
            .channel('progress_channel')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'user_progress',
                    filter: `user_id=eq.${userId}`
                }, 
                callback
            )
            .subscribe();
    }

    // Data access methods
    async getUserProfile(userId) {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Get profile error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    async updateUserProfile(userId, updates) {
        const { data, error } = await this.supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('Update profile error:', error);
            return { success: false, error: error.message };
        }

        // Update local storage
        localStorage.setItem('currentUser', JSON.stringify(data));
        UTILS.showNotification('Profile updated successfully!', 'success');

        return { success: true, data };
    }

    async getTrainingModules() {
        const { data, error } = await this.supabase
            .from('modules')
            .select('*')
            .eq('is_published', true)
            .order('order_index');

        if (error) {
            console.error('Get modules error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    async getUserProgress(userId) {
        const { data, error } = await this.supabase
            .from('user_progress')
            .select(`
                *,
                modules (
                    id,
                    title,
                    category,
                    difficulty_level
                )
            `)
            .eq('user_id', userId);

        if (error) {
            console.error('Get progress error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    async updateProgress(userId, moduleId, progressData) {
        const { data, error } = await this.supabase
            .from('user_progress')
            .upsert({
                user_id: userId,
                module_id: moduleId,
                ...progressData,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Update progress error:', error);
            return { success: false, error: error.message };
        }

        ANALYTICS.track('module_progress_updated', { moduleId, ...progressData });
        return { success: true, data };
    }

    async getForumPosts(category = null, limit = 20) {
        let query = this.supabase
            .from('forum_posts')
            .select(`
                *,
                users (
                    id,
                    name,
                    location,
                    role
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Get forum posts error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    async createForumPost(userId, postData) {
        const { data, error } = await this.supabase
            .from('forum_posts')
            .insert([{
                user_id: userId,
                title: postData.title,
                content: postData.content,
                category: postData.category
            }])
            .select()
            .single();

        if (error) {
            console.error('Create forum post error:', error);
            UTILS.showNotification('Failed to create post', 'error');
            return { success: false, error: error.message };
        }

        UTILS.showNotification('Post created successfully!', 'success');
        ANALYTICS.track('forum_post_created', { category: postData.category });

        return { success: true, data };
    }

    async saveConversation(userId, userMessage, aiResponse, type = 'general') {
        const { data, error } = await this.supabase
            .from('conversations')
            .insert([{
                user_id: userId,
                user_message: userMessage,
                ai_response: aiResponse,
                conversation_type: type
            }])
            .select()
            .single();

        if (error) {
            console.error('Save conversation error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    async getUserNotifications(userId) {
        const { data, error } = await this.supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Get notifications error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    async markNotificationAsRead(notificationId) {
        const { data, error } = await this.supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId)
            .select()
            .single();

        if (error) {
            console.error('Mark notification read error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    // File upload methods
    async uploadProfileImage(userId, file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/profile/avatar.${fileExt}`;

        try {
            const { data, error } = await this.supabase.storage
                .from('user-uploads')
                .upload(fileName, file, {
                    upsert: true
                });

            if (error) throw error;

            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from('user-uploads')
                .getPublicUrl(fileName);

            // Update user profile with image URL
            await this.updateUserProfile(userId, {
                profile_image_url: urlData.publicUrl
            });

            UTILS.showNotification('Profile image updated!', 'success');
            return { success: true, data: urlData.publicUrl };

        } catch (error) {
            console.error('Upload error:', error);
            UTILS.showNotification('Failed to upload image', 'error');
            return { success: false, error: error.message };
        }
    }

    // Dashboard data aggregation
    async getDashboardData(userId) {
        try {
            // Get user stats from view
            const { data: stats, error: statsError } = await this.supabase
                .from('user_dashboard_stats')
                .select('*')
                .eq('id', userId)
                .single();

            if (statsError && statsError.code !== 'PGRST116') {
                throw statsError;
            }

            // Get recent notifications
            const { data: notifications, error: notifError } = await this.supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(5);

            if (notifError) {
                console.warn('Notifications error:', notifError);
            }

            // Get current module progress
            const { data: currentProgress, error: progressError } = await this.supabase
                .from('user_progress')
                .select(`
                    *,
                    modules (
                        id,
                        title,
                        category
                    )
                `)
                .eq('user_id', userId)
                .eq('completed', false)
                .order('started_at', { ascending: false })
                .limit(3);

            if (progressError) {
                console.warn('Progress error:', progressError);
            }

            return {
                success: true,
                data: {
                    stats: stats || {
                        completed_modules: 0,
                        total_modules: 8,
                        progress_percentage: 0,
                        forum_posts_count: 0
                    },
                    notifications: notifications || [],
                    currentProgress: currentProgress || []
                }
            };

        } catch (error) {
            console.error('Dashboard data error:', error);
            return { success: false, error: error.message };
        }
    }

    // Analytics tracking
    async trackEvent(eventName, properties = {}) {
        if (!this.currentUser) return;

        try {
            const { error } = await this.supabase
                .from('analytics_events')
                .insert([{
                    user_id: this.currentUser.id,
                    event_name: eventName,
                    properties,
                    session_id: this.getSessionId(),
                    user_agent: navigator.userAgent
                }]);

            if (error) {
                console.warn('Analytics tracking error:', error);
            }

        } catch (error) {
            console.warn('Analytics failed:', error);
        }
    }

    // Get or create session ID
    getSessionId() {
        let sessionId = sessionStorage.getItem('session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('session_id', sessionId);
        }
        return sessionId;
    }

    // Get current auth user
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.currentUser;
    }

    // Get session
    async getSession() {
        const { data: { session }, error } = await this.supabase.auth.getSession();
        if (error) {
            console.error('Get session error:', error);
            return null;
        }
        return session;
    }

    // Refresh session
    async refreshSession() {
        const { data: { session }, error } = await this.supabase.auth.refreshSession();
        if (error) {
            console.error('Refresh session error:', error);
            return null;
        }
        return session;
    }
}

// Initialize Supabase client
const supabaseClient = new SupabaseClient();

// Enhanced API object with Supabase integration
const SUPABASE_API = {
    // Initialize
    async initialize() {
        const initialized = await supabaseClient.initialize();
        if (initialized) {
            console.log('🔗 Supabase integration ready');
        }
        return initialized;
    },

    // Authentication wrapper methods
    async signUp(email, password, userData) {
        return supabaseClient.signUp(email, password, userData);
    },

    async signIn(email, password) {
        return supabaseClient.signIn(email, password);
    },

    async signOut() {
        return supabaseClient.signOut();
    },

    async resetPassword(email) {
        return supabaseClient.resetPassword(email);
    },

    // Data methods
    async getDashboardData() {
        const user = supabaseClient.getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        
        return supabaseClient.getDashboardData(user.id);
    },

    async getTrainingModules() {
        return supabaseClient.getTrainingModules();
    },

    async getUserProgress() {
        const user = supabaseClient.getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        
        return supabaseClient.getUserProgress(user.id);
    },

    async updateProgress(moduleId, progressData) {
        const user = supabaseClient.getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        
        return supabaseClient.updateProgress(user.id, moduleId, progressData);
    },

    async getForumPosts(category = null) {
        return supabaseClient.getForumPosts(category);
    },

    async createForumPost(postData) {
        const user = supabaseClient.getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        
        return supabaseClient.createForumPost(user.id, postData);
    },

    async saveConversation(userMessage, aiResponse, type = 'general') {
        const user = supabaseClient.getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        
        return supabaseClient.saveConversation(user.id, userMessage, aiResponse, type);
    },

    async getUserNotifications() {
        const user = supabaseClient.getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        
        return supabaseClient.getUserNotifications(user.id);
    },

    async markNotificationAsRead(notificationId) {
        return supabaseClient.markNotificationAsRead(notificationId);
    },

    async uploadProfileImage(file) {
        const user = supabaseClient.getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        
        return supabaseClient.uploadProfileImage(user.id, file);
    },

    // Real-time subscription methods
    subscribeToForumPosts(callback) {
        return supabaseClient.subscribeToForumPosts(callback);
    },

    subscribeToNotifications(callback) {
        const user = supabaseClient.getCurrentUser();
        if (!user) return null;
        
        return supabaseClient.subscribeToNotifications(user.id, callback);
    },

    subscribeToUserProgress(callback) {
        const user = supabaseClient.getCurrentUser();
        if (!user) return null;
        
        return supabaseClient.subscribeToUserProgress(user.id, callback);
    },

    // Utility methods
    getCurrentUser() {
        return supabaseClient.getCurrentUser();
    },

    isAuthenticated() {
        return supabaseClient.isAuthenticated();
    },

    async getSession() {
        return supabaseClient.getSession();
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize Supabase integration
    await SUPABASE_API.initialize();

    // Set up real-time subscriptions if user is authenticated
    if (SUPABASE_API.isAuthenticated()) {
        setupRealTimeSubscriptions();
    }
});

// Set up real-time subscriptions
function setupRealTimeSubscriptions() {
    console.log('🔔 Setting up real-time subscriptions...');

    // Subscribe to notifications
    SUPABASE_API.subscribeToNotifications((payload) => {
        console.log('New notification:', payload);
        const notification = payload.new;
        
        // Show notification to user
        UTILS.showNotification(notification.title, notification.type);
        
        // Update notification badge/count
        updateNotificationBadge();
    });

    // Subscribe to forum posts (for live updates)
    SUPABASE_API.subscribeToForumPosts((payload) => {
        console.log('Forum update:', payload);
        
        if (payload.eventType === 'INSERT') {
            // Refresh forum if user is currently viewing it
            const currentSection = document.querySelector('.section.active');
            if (currentSection && currentSection.id === 'community') {
                refreshForumPosts();
            }
        }
    });

    // Subscribe to progress updates
    SUPABASE_API.subscribeToUserProgress((payload) => {
        console.log('Progress update:', payload);
        
        // Update progress displays
        updateProgressDisplays();
    });
}

// Helper functions for real-time updates
function updateNotificationBadge() {
    // Update notification count badge
    SUPABASE_API.getUserNotifications().then(result => {
        if (result.success) {
            const unreadCount = result.data.filter(n => !n.is_read).length;
            
            // Update badge display
            let badge = document.getElementById('notification-badge');
            if (!badge && unreadCount > 0) {
                badge = document.createElement('span');
                badge.id = 'notification-badge';
                badge.style.cssText = `
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #f44336;
                    color: white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                `;
                
                // Add to header or notification button
                const header = document.querySelector('.header');
                if (header) {
                    header.style.position = 'relative';
                    header.appendChild(badge);
                }
            }
            
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    });
}

async function refreshForumPosts() {
    // Refresh forum posts in community section
    const result = await SUPABASE_API.getForumPosts();
    if (result.success) {
        // Update forum posts display
        renderForumPosts(result.data);
    }
}

function updateProgressDisplays() {
    // Refresh progress bars and stats
    SUPABASE_API.getUserProgress().then(result => {
        if (result.success) {
            // Update dashboard stats
            const stats = calculateProgressStats(result.data);
            updateDashboardWithStats(stats);
        }
    });
}

function calculateProgressStats(progressData) {
    const completed = progressData.filter(p => p.completed).length;
    const total = 8; // Total modules
    const percentage = Math.round((completed / total) * 100);
    
    return {
        completed_modules: completed,
        total_modules: total,
        progress_percentage: percentage,
        average_score: progressData.length > 0 ? 
            Math.round(progressData.reduce((sum, p) => sum + (p.score || 0), 0) / progressData.length) : 0
    };
}

function updateDashboardWithStats(stats) {
    // Update stat cards
    const statNumbers = document.querySelectorAll('.stat-number');
    if (statNumbers.length >= 2) {
        statNumbers[0].textContent = stats.completed_modules;
        statNumbers[1].textContent = stats.progress_percentage + '%';
    }

    // Update progress bars
    const progressBars = document.querySelectorAll('.progress-fill');
    progressBars.forEach(bar => {
        if (bar.closest('.card')?.querySelector('h3')?.textContent?.includes('Welcome')) {
            bar.style.width = stats.progress_percentage + '%';
        }
    });
}

function renderForumPosts(posts) {
    // This function would update the forum section with new posts
    // Implementation depends on your forum UI structure
    console.log('Rendering forum posts:', posts.length);
}

// Export for global use
if (typeof window !== 'undefined') {
    window.SUPABASE_API = SUPABASE_API;
    window.supabaseClient = supabaseClient;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SUPABASE_API, supabaseClient };
}