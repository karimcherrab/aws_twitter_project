let currentUser = null;
let sessionToken = null;
let currentView = 'public'; // 'public' | 'inbox'
let refreshInterval = null;
const expandedTweets = new Set(); // tracks which tweet IDs have replies open

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderApp();
});

function checkAuth() {
    const storedToken = localStorage.getItem('sessionToken');
    const storedUser = localStorage.getItem('username');
    if (storedToken && storedUser) {
        sessionToken = storedToken;
        currentUser = storedUser;
    }
}

function renderApp() {
    const app = document.getElementById('app');

    app.innerHTML = `
        ${renderNavBar()}
        ${currentUser ? renderTabs() : ''}
        ${currentUser && currentView === 'public' ? renderMessageForm() : ''}
        ${currentUser && currentView === 'inbox' ? renderPrivateMessageForm() : ''}
        <div id="messagesContainer" class="messages-container">
            <div class="loading">Chargement des messages...</div>
        </div>
        ${renderModals()}
    `;

    if (currentUser && currentView === 'inbox') {
        loadInbox();
    } else {
        loadMessages();
    }

    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    refreshInterval = setInterval(() => {
        if (currentUser && currentView === 'inbox') loadInbox();
        else loadMessages();
    }, 5000);

    attachEventListeners();
}

// ─── Render helpers ──────────────────────────────────────────────────────────

function renderNavBar() {
    return `
        <div class="nav-bar">
            <div class="nav-brand">
                <i class="fab fa-twitter"></i> Mini Twitter
            </div>
            <div class="nav-menu">
                ${currentUser ? `
                    <span class="user-info">
                        <i class="fas fa-user"></i> ${escapeHtml(currentUser)}
                    </span>
                    <button class="btn" onclick="logout()">
                        <i class="fas fa-sign-out-alt"></i> Déconnexion
                    </button>
                ` : `
                    <button class="btn" onclick="showLoginModal()">
                        <i class="fas fa-sign-in-alt"></i> Connexion
                    </button>
                    <button class="btn btn-primary" onclick="showSignupModal()">
                        <i class="fas fa-user-plus"></i> Créer un compte
                    </button>
                `}
            </div>
        </div>
    `;
}

function renderTabs() {
    return `
        <div class="tabs">
            <button class="tab-btn ${currentView === 'public' ? 'active' : ''}" onclick="switchView('public')">
                <i class="fas fa-globe"></i> Fil public
            </button>
            <button class="tab-btn ${currentView === 'inbox' ? 'active' : ''}" onclick="switchView('inbox')">
                <i class="fas fa-envelope"></i> Messages privés
            </button>
        </div>
    `;
}

function renderMessageForm() {
    return `
        <div class="message-form">
            <textarea id="messageInput" class="message-input" placeholder="Quoi de neuf ?" rows="3" maxlength="280"></textarea>
            <div class="char-counter"><span id="charCount">0</span>/280</div>
            <button class="btn btn-primary" onclick="tweetMessage()" style="width: 100%;">
                <i class="fas fa-paper-plane"></i> Tweeter
            </button>
        </div>
    `;
}

function renderPrivateMessageForm() {
    return `
        <div class="message-form">
            <div class="input-group" style="margin-bottom: 12px;">
                <div class="input-box">
                    <i class="fas fa-at"></i>
                    <input type="text" id="privateRecipient" placeholder="Destinataire (nom d'utilisateur)">
                </div>
            </div>
            <textarea id="privateMessageInput" class="message-input" placeholder="Votre message privé..." rows="3" maxlength="280"></textarea>
            <div class="char-counter"><span id="privateCharCount">0</span>/280</div>
            <button class="btn btn-primary" onclick="sendPrivateMessage()" style="width: 100%;">
                <i class="fas fa-lock"></i> Envoyer en privé
            </button>
        </div>
    `;
}

function renderModals() {
    return `
        <div id="loginModal" class="modal">
            <div class="modal-content">
                <h2><i class="fas fa-sign-in-alt"></i> Connexion</h2>
                <div id="loginError" class="error-message"></div>
                <div class="input-group">
                    <div class="input-box">
                        <i class="fas fa-user"></i>
                        <input type="text" id="loginUsername" placeholder="Nom d'utilisateur">
                    </div>
                </div>
                <div class="input-group">
                    <div class="input-box">
                        <i class="fas fa-lock"></i>
                        <input type="password" id="loginPassword" placeholder="Mot de passe">
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="btn" onclick="hideLoginModal()">Annuler</button>
                    <button class="btn btn-primary" onclick="login()">Se connecter</button>
                </div>
            </div>
        </div>

        <div id="signupModal" class="modal">
            <div class="modal-content">
                <h2><i class="fas fa-user-plus"></i> Créer un compte</h2>
                <div id="signupError" class="error-message"></div>
                <div id="signupSuccess" class="success-message"></div>
                <div class="input-group">
                    <div class="input-box">
                        <i class="fas fa-user"></i>
                        <input type="text" id="signupUsername" placeholder="Nom d'utilisateur">
                    </div>
                </div>
                <div class="input-group">
                    <div class="input-box">
                        <i class="fas fa-lock"></i>
                        <input type="password" id="signupPassword" placeholder="Mot de passe">
                    </div>
                </div>
                <div class="input-group">
                    <div class="input-box">
                        <i class="fas fa-lock"></i>
                        <input type="password" id="signupConfirmPassword" placeholder="Confirmer le mot de passe">
                    </div>
                </div>
                <div class="modal-buttons">
                    <button class="btn" onclick="hideSignupModal()">Annuler</button>
                    <button class="btn btn-primary" onclick="signup()">Créer</button>
                </div>
            </div>
        </div>
    `;
}

// ─── Tweet card rendering ─────────────────────────────────────────────────────

function renderTweetCard(message) {
    const id = message._id;
    const likes = message.likes || [];
    const isLiked = currentUser && likes.includes(currentUser);
    const likeCount = likes.length;

    return `
        <div class="message-card" id="tweet-${id}">
            <div class="tweet-body" onclick="toggleReplies('${id}')">
                <div class="message-header">
                    <span class="message-author">
                        <i class="fas fa-user-circle"></i> ${escapeHtml(message.author)}
                    </span>
                    <span class="message-date">${formatDate(message.date)}</span>
                </div>
                <div class="message-text">${escapeHtml(message.text)}</div>
            </div>
            <div class="message-actions">
                <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${id}')">
                    <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                    <span id="likes-${id}">${likeCount}</span>
                </button>
                <button class="action-btn reply-btn" onclick="toggleReplies('${id}')">
                    <i class="fas fa-comment"></i>
                    ${message.replyCount !== undefined ? `<span id="reply-count-${id}">${message.replyCount}</span>` : ''}
                </button>
            </div>
            <div id="replies-${id}" class="replies-section" style="display:none;"></div>
        </div>
    `;
}

// ─── Event listeners ──────────────────────────────────────────────────────────

function attachEventListeners() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            document.getElementById('charCount').textContent = this.value.length;
        });
        messageInput.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') tweetMessage();
        });
    }

    const privateInput = document.getElementById('privateMessageInput');
    if (privateInput) {
        privateInput.addEventListener('input', function() {
            document.getElementById('privateCharCount').textContent = this.value.length;
        });
    }
}

// ─── Navigation / auth ───────────────────────────────────────────────────────

window.switchView = (view) => {
    currentView = view;
    renderApp();
};

window.showLoginModal = () => {
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('loginError').textContent = '';
};

window.hideLoginModal = () => {
    document.getElementById('loginModal').classList.remove('active');
};

window.showSignupModal = () => {
    document.getElementById('signupModal').classList.add('active');
    document.getElementById('signupError').textContent = '';
    document.getElementById('signupSuccess').textContent = '';
};

window.hideSignupModal = () => {
    document.getElementById('signupModal').classList.remove('active');
};

window.signup = async () => {
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const errorDiv = document.getElementById('signupError');
    const successDiv = document.getElementById('signupSuccess');

    errorDiv.textContent = '';
    successDiv.textContent = '';

    if (!username || !password) { errorDiv.textContent = 'Tous les champs sont requis'; return; }
    if (password !== confirmPassword) { errorDiv.textContent = 'Les mots de passe ne correspondent pas'; return; }
    if (password.length < 6) { errorDiv.textContent = 'Le mot de passe doit contenir au moins 6 caractères'; return; }

    try {
        const response = await fetch('/api/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (data.success) {
            successDiv.textContent = 'Compte créé avec succès ! Vous pouvez maintenant vous connecter.';
            setTimeout(() => { hideSignupModal(); showLoginModal(); }, 1500);
        } else {
            errorDiv.textContent = data.message || 'Erreur lors de la création du compte';
        }
    } catch {
        errorDiv.textContent = 'Erreur de connexion au serveur';
    }
};

window.login = async () => {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = '';

    if (!username || !password) { errorDiv.textContent = 'Tous les champs sont requis'; return; }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (data.success) {
            sessionToken = data.token;
            currentUser = username;
            localStorage.setItem('sessionToken', sessionToken);
            localStorage.setItem('username', currentUser);
            hideLoginModal();
            currentView = 'public';
            renderApp();
        } else {
            errorDiv.textContent = data.message || 'Nom d\'utilisateur ou mot de passe incorrect';
        }
    } catch {
        errorDiv.textContent = 'Erreur de connexion au serveur';
    }
};

window.logout = () => {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('username');
    sessionToken = null;
    currentUser = null;
    currentView = 'public';
    expandedTweets.clear();
    renderApp();
};

// ─── Posting ─────────────────────────────────────────────────────────────────

window.tweetMessage = async () => {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text) { alert('Le message ne peut pas être vide'); return; }
    if (text.length > 280) { alert('Le message ne peut pas dépasser 280 caractères'); return; }

    try {
        const response = await fetch('/api/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ text })
        });
        const data = await response.json();

        if (data.success) {
            input.value = '';
            document.getElementById('charCount').textContent = '0';
            loadMessages();
        } else {
            alert(data.message || 'Erreur lors de la publication');
        }
    } catch {
        alert('Erreur de connexion au serveur');
    }
};

window.sendPrivateMessage = async () => {
    const recipient = document.getElementById('privateRecipient').value.trim();
    const input = document.getElementById('privateMessageInput');
    const text = input.value.trim();

    if (!recipient) { alert('Veuillez entrer un destinataire'); return; }
    if (!text) { alert('Le message ne peut pas être vide'); return; }

    try {
        const response = await fetch('/api/private', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ text, recipient })
        });
        const data = await response.json();

        if (data.success) {
            input.value = '';
            document.getElementById('privateCharCount').textContent = '0';
            document.getElementById('privateRecipient').value = '';
            loadInbox();
        } else {
            alert(data.message || 'Erreur lors de l\'envoi');
        }
    } catch {
        alert('Erreur de connexion au serveur');
    }
};

// ─── Likes ────────────────────────────────────────────────────────────────────

window.toggleLike = async (id) => {
    if (!currentUser) {
        showLoginModal();
        return;
    }

    // Optimistic update
    const likeSpan = document.getElementById(`likes-${id}`);
    const likeBtn = likeSpan ? likeSpan.closest('.like-btn') : null;
    if (!likeBtn) return;

    const wasLiked = likeBtn.classList.contains('liked');
    const prevCount = parseInt(likeSpan.textContent, 10);

    likeBtn.classList.toggle('liked');
    likeBtn.querySelector('i').className = wasLiked ? 'far fa-heart' : 'fas fa-heart';
    likeSpan.textContent = wasLiked ? prevCount - 1 : prevCount + 1;

    try {
        const response = await fetch(`/api/like/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        const data = await response.json();

        if (data.success) {
            // Sync with server truth
            likeSpan.textContent = data.likes;
            likeBtn.classList.toggle('liked', data.liked);
            likeBtn.querySelector('i').className = data.liked ? 'fas fa-heart' : 'far fa-heart';
        } else {
            // Revert on error
            likeBtn.classList.toggle('liked', wasLiked);
            likeBtn.querySelector('i').className = wasLiked ? 'fas fa-heart' : 'far fa-heart';
            likeSpan.textContent = prevCount;
        }
    } catch {
        // Revert on network error
        likeBtn.classList.toggle('liked', wasLiked);
        likeBtn.querySelector('i').className = wasLiked ? 'fas fa-heart' : 'far fa-heart';
        likeSpan.textContent = prevCount;
    }
};

// ─── Replies ──────────────────────────────────────────────────────────────────

window.toggleReplies = async (id) => {
    const section = document.getElementById(`replies-${id}`);
    if (!section) return;

    if (section.style.display !== 'none') {
        section.style.display = 'none';
        expandedTweets.delete(id);
    } else {
        section.style.display = 'block';
        expandedTweets.add(id);
        await loadReplies(id);
    }
};

async function loadReplies(id) {
    const section = document.getElementById(`replies-${id}`);
    if (!section) return;

    section.innerHTML = '<div class="loading-replies"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

    try {
        const response = await fetch(`/api/replies/${id}`);
        const data = await response.json();

        if (!data.success) {
            section.innerHTML = '<p class="empty-state">Erreur de chargement</p>';
            return;
        }

        const repliesHtml = data.replies.length > 0
            ? data.replies.map(r => renderTweetCard(r)).join('')
            : '<p class="empty-replies">Aucune réponse pour le moment</p>';

        const replyFormHtml = currentUser ? `
            <div class="reply-form">
                <textarea id="reply-input-${id}" class="reply-input" placeholder="Votre réponse..." rows="2" maxlength="280"></textarea>
                <button class="btn btn-primary btn-sm" onclick="postReply('${id}')">
                    <i class="fas fa-reply"></i> Répondre
                </button>
            </div>
        ` : '';

        section.innerHTML = repliesHtml + replyFormHtml;

    } catch {
        section.innerHTML = '<p class="empty-state">Erreur de connexion</p>';
    }
}

window.postReply = async (id) => {
    const input = document.getElementById(`reply-input-${id}`);
    if (!input) return;
    const text = input.value.trim();

    if (!text) { alert('La réponse ne peut pas être vide'); return; }

    try {
        const response = await fetch(`/api/reply/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ text })
        });
        const data = await response.json();

        if (data.success) {
            input.value = '';
            // Refresh replies and update reply counter
            await loadReplies(id);
            const countSpan = document.getElementById(`reply-count-${id}`);
            if (countSpan) countSpan.textContent = parseInt(countSpan.textContent, 10) + 1;
        } else {
            alert(data.message || 'Erreur lors de la réponse');
        }
    } catch {
        alert('Erreur de connexion au serveur');
    }
};

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    try {
        const response = await fetch('/api/messages');
        const data = await response.json();

        if (data.success) {
            await displayMessages(data.messages);
        } else {
            container.innerHTML = '<p class="empty-state">Erreur lors du chargement</p>';
        }
    } catch {
        container.innerHTML = '<p class="empty-state">Erreur de connexion</p>';
    }
}

async function loadInbox() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    try {
        const response = await fetch('/api/inbox', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        const data = await response.json();

        if (data.success) {
            displayInboxMessages(data.messages);
        } else {
            container.innerHTML = '<p class="empty-state">Erreur lors du chargement</p>';
        }
    } catch {
        container.innerHTML = '<p class="empty-state">Erreur de connexion</p>';
    }
}

// ─── Display functions ────────────────────────────────────────────────────────

async function displayMessages(messages) {
    const container = document.getElementById('messagesContainer');

    if (!messages || messages.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucun message pour le moment</p>';
        return;
    }

    container.innerHTML = messages.map(m => renderTweetCard(m)).join('');

    // Restore expanded replies after a refresh
    for (const id of expandedTweets) {
        const section = document.getElementById(`replies-${id}`);
        if (section) {
            section.style.display = 'block';
            await loadReplies(id);
        }
    }
}

function displayInboxMessages(messages) {
    const container = document.getElementById('messagesContainer');

    if (!messages || messages.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucun message privé reçu</p>';
        return;
    }

    container.innerHTML = messages.map(message => `
        <div class="message-card private-message">
            <div class="message-header">
                <span class="message-author">
                    <i class="fas fa-lock"></i> De : ${escapeHtml(message.author)}
                </span>
                <span class="message-date">${formatDate(message.date)}</span>
            </div>
            <div class="message-text">${escapeHtml(message.text)}</div>
        </div>
    `).join('');
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
