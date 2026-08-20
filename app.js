const SUPABASE_URL =
    "https://vkelkgabycpxojybguvj.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_LntMHz6esPpIJszjXzzAzw_W-FVSljU";

const client =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

const REDIRECT_URL =
    new URL(
        "auth-callback.html",
        window.location.href
    ).href;

let currentUser = null;
let currentProfile = null;

let currentConversationId = null;
let currentConversationUser = null;

let realtimeChannel = null;

let allUsers = [];

const displayedMessageIds =
    new Set();

let googleAuthPopup = null;
let googleAuthTimeout = null;

let initializingUser = false;
let editingProfile = false;

// Garbage code snippet, but it keeps the old HTML compatible.
const globalChatButton =
    document.getElementById(
        "global-chat-button"
    );

// Screens

const authScreen =
    document.getElementById(
        "auth-screen"
    );

const profileScreen =
    document.getElementById(
        "profile-screen"
    );

const chatScreen =
    document.getElementById(
        "chat-screen"
    );

// Authentication

const googleLogin =
    document.getElementById(
        "google-login"
    );

// Profile

const profileForm =
    document.getElementById(
        "profile-form"
    );

const profileUsername =
    document.getElementById(
        "profile-username"
    );

const profileDisplayName =
    document.getElementById(
        "profile-display-name"
    );

// Profile customization buttons.
// Supports either name so we don't have to care which one index.html uses.

const profileCustomizeButton =
    document.getElementById(
        "profile-customize-button"
    ) ||
    document.getElementById(
        "edit-profile-button"
    ) ||
    document.getElementById(
        "profile-button"
    );

// Errors

const authError =
    document.getElementById(
        "auth-error"
    );

const profileError =
    document.getElementById(
        "profile-error"
    );

// Chat

const status =
    document.getElementById(
        "status"
    );

const currentUserElement =
    document.getElementById(
        "current-user"
    );

const userSearch =
    document.getElementById(
        "user-search"
    );

const userList =
    document.getElementById(
        "user-list"
    );

const conversationUser =
    document.getElementById(
        "conversation-user"
    );

const messages =
    document.getElementById(
        "messages"
    );

const messageForm =
    document.getElementById(
        "message-form"
    );

const messageInput =
    document.getElementById(
        "message"
    );

const logoutButton =
    document.getElementById(
        "logout-button"
    );

// Mobile

const userSidebar =
    document.getElementById(
        "user-sidebar"
    );

const mobileChatSelector =
    document.getElementById(
        "mobile-chat-selector"
    );

const mobileSidebarBackdrop =
    document.getElementById(
        "mobile-sidebar-backdrop"
    );


// ------------------------------------------------------------
// Mobile sidebar
// ------------------------------------------------------------

function isMobile() {

    return window.matchMedia(
        "(max-width: 700px)"
    ).matches;
}

function openMobileSidebar() {

    if (
        !isMobile() ||
        !userSidebar
    ) {
        return;
    }

    userSidebar.classList.add(
        "mobile-open"
    );

    if (mobileSidebarBackdrop) {

        mobileSidebarBackdrop.classList.add(
            "mobile-visible"
        );
    }

    if (mobileChatSelector) {

        mobileChatSelector.setAttribute(
            "aria-expanded",
            "true"
        );
    }
}

function closeMobileSidebar() {

    if (!userSidebar) {
        return;
    }

    userSidebar.classList.remove(
        "mobile-open"
    );

    if (mobileSidebarBackdrop) {

        mobileSidebarBackdrop.classList.remove(
            "mobile-visible"
        );
    }

    if (mobileChatSelector) {

        mobileChatSelector.setAttribute(
            "aria-expanded",
            "false"
        );
    }
}

function toggleMobileSidebar() {

    if (!isMobile()) {
        return;
    }

    if (
        userSidebar &&
        userSidebar.classList.contains(
            "mobile-open"
        )
    ) {

        closeMobileSidebar();

    } else {

        openMobileSidebar();
    }
}

if (mobileChatSelector) {

    mobileChatSelector.addEventListener(
        "click",
        toggleMobileSidebar
    );
}

if (mobileSidebarBackdrop) {

    mobileSidebarBackdrop.addEventListener(
        "click",
        closeMobileSidebar
    );
}


// ------------------------------------------------------------
// Screens
// ------------------------------------------------------------

function hideAllScreens() {

    if (authScreen) {
        authScreen.classList.add(
            "hidden"
        );
    }

    if (profileScreen) {
        profileScreen.classList.add(
            "hidden"
        );
    }

    if (chatScreen) {
        chatScreen.classList.add(
            "hidden"
        );
    }
}

function showLoginScreen() {

    hideAllScreens();

    if (authScreen) {
        authScreen.classList.remove(
            "hidden"
        );
    }

    resetGoogleButton();
}

function showProfileScreen() {

    hideAllScreens();

    if (profileScreen) {
        profileScreen.classList.remove(
            "hidden"
        );
    }
}

function showChatScreen() {

    hideAllScreens();

    if (chatScreen) {
        chatScreen.classList.remove(
            "hidden"
        );
    }
}


// ------------------------------------------------------------
// Errors
// ------------------------------------------------------------

function showError(
    element,
    message
) {

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.style.display =
        "block";
}

function clearError(
    element
) {

    if (!element) {
        return;
    }

    element.textContent =
        "";

    element.style.display =
        "none";
}


// ------------------------------------------------------------
// Google login
// ------------------------------------------------------------

function resetGoogleButton() {

    if (!googleLogin) {
        return;
    }

    googleLogin.disabled =
        false;

    googleLogin.innerHTML = `
        <span class="google-icon">
            G
        </span>

        <span class="google-login-text">
            Continue with Google
        </span>
    `;
}

function setGoogleButtonLoading() {

    if (!googleLogin) {
        return;
    }

    googleLogin.disabled =
        true;

    googleLogin.innerHTML = `
        <span class="google-icon">
            G
        </span>

        <span class="google-login-text">
            Opening Google...
        </span>
    `;
}

async function startGoogleLogin() {

    if (!googleLogin) {
        return;
    }

    clearError(
        authError
    );

    if (
        googleAuthPopup &&
        !googleAuthPopup.closed
    ) {

        googleAuthPopup.focus();

        return;
    }

    setGoogleButtonLoading();

    const width = 500;
    const height = 650;

    const left =
        window.screenX +
        (
            window.outerWidth -
            width
        ) / 2;

    const top =
        window.screenY +
        (
            window.outerHeight -
            height
        ) / 2;

    googleAuthPopup =
        window.open(
            "about:blank",
            "opentalk_google_login",
            `
                width=${width},
                height=${height},
                left=${left},
                top=${top},
                popup=yes,
                resizable=yes,
                scrollbars=yes
            `
        );

    if (!googleAuthPopup) {

        showError(
            authError,
            "Google login popup was blocked. Please allow popups for OpenTalk."
        );

        resetGoogleButton();

        return;
    }

    const {
        data,
        error
    } =
        await client.auth.signInWithOAuth({

            provider:
                "google",

            options: {

                redirectTo:
                    REDIRECT_URL,

                skipBrowserRedirect:
                    true
            }
        });

    if (error) {

        console.error(
            "GOOGLE OAUTH ERROR:",
            error
        );

        closeGooglePopup();

        showError(
            authError,
            error.message
        );

        resetGoogleButton();

        return;
    }

    if (
        !data ||
        !data.url
    ) {

        closeGooglePopup();

        showError(
            authError,
            "Failed to start Google authentication."
        );

        resetGoogleButton();

        return;
    }

    try {

        googleAuthPopup.location.href =
            data.url;

        googleAuthPopup.focus();

    } catch (error) {

        console.error(
            "POPUP NAVIGATION ERROR:",
            error
        );

        closeGooglePopup();

        showError(
            authError,
            "Failed to open Google authentication."
        );

        resetGoogleButton();

        return;
    }

    startGooglePopupWatcher();
}

function startGooglePopupWatcher() {

    clearInterval(
        googleAuthTimeout
    );

    googleAuthTimeout =
        setInterval(
            async () => {

                if (
                    googleAuthPopup &&
                    googleAuthPopup.closed
                ) {

                    clearInterval(
                        googleAuthTimeout
                    );

                    googleAuthTimeout =
                        null;

                    googleAuthPopup =
                        null;

                    if (currentUser) {
                        return;
                    }

                    showError(
                        authError,
                        "Google sign-in was cancelled."
                    );

                    resetGoogleButton();

                    return;
                }

                const {
                    data,
                    error
                } =
                    await client.auth.getSession();

                if (error) {

                    console.error(
                        "SESSION CHECK ERROR:",
                        error
                    );

                    return;
                }

                if (
                    data &&
                    data.session &&
                    !currentUser
                ) {

                    currentUser =
                        data.session.user;

                    clearInterval(
                        googleAuthTimeout
                    );

                    googleAuthTimeout =
                        null;

                    closeGooglePopup();

                    await initializeUser();
                }

            },
            500
        );
}

function closeGooglePopup() {

    if (googleAuthTimeout) {

        clearInterval(
            googleAuthTimeout
        );

        googleAuthTimeout =
            null;
    }

    if (
        googleAuthPopup &&
        !googleAuthPopup.closed
    ) {

        try {

            googleAuthPopup.close();

        } catch (error) {

            console.warn(
                "Could not close Google popup:",
                error
            );
        }
    }

    googleAuthPopup =
        null;
}

if (googleLogin) {

    googleLogin.addEventListener(
        "click",
        startGoogleLogin
    );
}


// ------------------------------------------------------------
// OAuth callback
// ------------------------------------------------------------

window.addEventListener(
    "message",
    async (event) => {

        if (
            event.origin !==
            window.location.origin
        ) {
            return;
        }

        if (
            !event.data ||
            typeof event.data.type !==
                "string"
        ) {
            return;
        }

        if (
            event.data.type ===
            "CHUDCHAT_AUTH_SUCCESS"
        ) {

            closeGooglePopup();

            const {
                data,
                error
            } =
                await client.auth.getSession();

            if (error) {

                console.error(
                    "SESSION LOAD ERROR:",
                    error
                );

                showError(
                    authError,
                    error.message
                );

                resetGoogleButton();

                return;
            }

            if (
                !data ||
                !data.session
            ) {

                showError(
                    authError,
                    "Authentication completed, but no session was found."
                );

                resetGoogleButton();

                return;
            }

            currentUser =
                data.session.user;

            clearError(
                authError
            );

            await initializeUser();

            return;
        }

        if (
            event.data.type ===
            "CHUDCHAT_AUTH_ERROR"
        ) {

            closeGooglePopup();

            showError(
                authError,
                event.data.message ||
                "Google sign-in failed."
            );

            resetGoogleButton();
        }
    }
);


// ------------------------------------------------------------
// Profiles
// ------------------------------------------------------------

async function loadProfile() {

    if (!currentUser) {
        return null;
    }

    const {
        data,
        error
    } =
        await client
            .from("profiles")
            .select(
                "id, username, display_name, avatar_url, created_at"
            )
            .eq(
                "id",
                currentUser.id
            )
            .maybeSingle();

    if (error) {

        console.error(
            "PROFILE LOAD ERROR:",
            error
        );

        return null;
    }

    return data;
}

function createUsernameSuggestion(
    metadata
) {

    let value =
        metadata.user_name ||
        metadata.preferred_username ||
        metadata.full_name ||
        metadata.name ||
        "";

    value =
        value
            .toLowerCase()
            .replace(
                /[^a-z0-9_]/g,
                ""
            );

    if (!value) {
        value = "user";
    }

    if (value.length < 3) {
        value += "user";
    }

    return value.substring(
        0,
        24
    );
}

function prepareProfileForm(
    profile
) {

    if (!profileUsername ||
        !profileDisplayName) {
        return;
    }

    if (profile) {

        profileUsername.value =
            profile.username || "";

        profileDisplayName.value =
            profile.display_name === "New User"
                ? ""
                : (
                    profile.display_name || ""
                );

    } else {

        const metadata =
            currentUser?.user_metadata || {};

        profileUsername.value =
            createUsernameSuggestion(
                metadata
            );

        profileDisplayName.value =
            metadata.full_name ||
            metadata.name ||
            "";
    }
}

function openProfileEditor() {

    if (!currentUser) {
        return;
    }

    editingProfile = true;

    clearError(
        profileError
    );

    prepareProfileForm(
        currentProfile
    );

    showProfileScreen();

    if (profileUsername) {
        profileUsername.focus();
    }
}

// Profile button actually does something now.
if (profileCustomizeButton) {

    profileCustomizeButton.addEventListener(
        "click",
        openProfileEditor
    );
}

async function initializeUser() {

    if (
        !currentUser ||
        initializingUser
    ) {
        return;
    }

    initializingUser =
        true;

    try {

        currentProfile =
            await loadProfile();

        if (!currentProfile) {

            editingProfile = false;

            prepareProfileForm(
                null
            );

            showProfileScreen();

            clearError(
                profileError
            );

            if (profileUsername) {
                profileUsername.focus();
            }

            return;
        }

        if (
            !currentProfile.username ||
            !currentProfile.display_name ||
            currentProfile.display_name ===
                "New User"
        ) {

            editingProfile = false;

            prepareProfileForm(
                currentProfile
            );

            showProfileScreen();

            clearError(
                profileError
            );

            if (profileUsername) {
                profileUsername.focus();
            }

            return;
        }

        await startChat();

    } finally {

        initializingUser =
            false;
    }
}


// ------------------------------------------------------------
// Save profile
// ------------------------------------------------------------

if (profileForm) {

    profileForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            clearError(
                profileError
            );

            if (!currentUser) {

                showError(
                    profileError,
                    "You are not logged in."
                );

                return;
            }

            const username =
                profileUsername.value
                    .trim()
                    .toLowerCase();

            const displayName =
                profileDisplayName.value
                    .trim();

            if (
                !/^[a-z0-9_]{3,24}$/.test(
                    username
                )
            ) {

                showError(
                    profileError,
                    "Username must be 3-24 characters and contain only letters, numbers, and underscores."
                );

                return;
            }

            if (!displayName) {

                showError(
                    profileError,
                    "Please enter a display name."
                );

                return;
            }

            const button =
                profileForm.querySelector(
                    "button"
                );

            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    "Checking...";
            }

            // Stupid shit: check first, then let the DB be the final authority.
            const {
                data: existingUsername,
                error: usernameCheckError
            } =
                await client
                    .from("profiles")
                    .select("id")
                    .eq(
                        "username",
                        username
                    )
                    .maybeSingle();

            if (usernameCheckError) {

                console.error(
                    "USERNAME CHECK ERROR:",
                    usernameCheckError
                );

                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        "Continue";
                }

                showError(
                    profileError,
                    "Could not check username. Please try again."
                );

                return;
            }

            if (
                existingUsername &&
                existingUsername.id !== currentUser.id
            ) {

                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        "Continue";
                }

                showError(
                    profileError,
                    "That username is already taken. Please choose another one."
                );

                profileUsername.focus();
                profileUsername.select();

                return;
            }

            if (button) {
                button.textContent =
                    "Saving...";
            }

            let data;
            let error;

            if (currentProfile) {

                const result =
                    await client
                        .from("profiles")
                        .update({
                            username,
                            display_name:
                                displayName
                        })
                        .eq(
                            "id",
                            currentUser.id
                        )
                        .select()
                        .single();

                data =
                    result.data;

                error =
                    result.error;

            } else {

                const result =
                    await client
                        .from("profiles")
                        .insert({
                            id:
                                currentUser.id,

                            username,

                            display_name:
                                displayName
                        })
                        .select()
                        .single();

                data =
                    result.data;

                error =
                    result.error;
            }

            if (error) {

                console.error(
                    "PROFILE SAVE ERROR:",
                    error
                );

                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        "Continue";
                }

                if (
                    error.code ===
                    "23505"
                ) {

                    const constraint =
                        (
                            error.constraint ||
                            ""
                        ).toLowerCase();

                    if (
                        constraint.includes(
                            "username"
                        ) ||
                        (
                            error.message ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                "username"
                            )
                    ) {

                        showError(
                            profileError,
                            "That username was just taken. Please choose another one."
                        );

                        profileUsername.focus();
                        profileUsername.select();

                        return;
                    }

                    // Don't claim the account is broken when we're just editing.
                    if (currentProfile) {

                        showError(
                            profileError,
                            "Could not save those profile changes."
                        );

                        return;
                    }

                    showError(
                        profileError,
                        "Your profile already exists. Please try again."
                    );

                    return;
                }

                showError(
                    profileError,
                    error.message ||
                    "Failed to save your profile."
                );

                return;
            }

            currentProfile =
                data;

            editingProfile =
                false;

            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Continue";
            }

            await startChat();
        }
    );
}


// ------------------------------------------------------------
// Users
// ------------------------------------------------------------

async function loadUsers() {

    if (
        !userList ||
        !currentUser
    ) {
        return;
    }

    userList.innerHTML = `
        <div class="sidebar-empty">
            Loading users...
        </div>
    `;

    const {
        data,
        error
    } =
        await client
            .from("profiles")
            .select(
                "id, username, display_name, avatar_url"
            )
            .neq(
                "id",
                currentUser.id
            )
            .order(
                "display_name",
                {
                    ascending: true
                }
            );

    if (error) {

        console.error(
            "USER LOAD ERROR:",
            error
        );

        userList.innerHTML = `
            <div class="sidebar-empty">
                Failed to load users.
            </div>
        `;

        return;
    }

    allUsers =
        data || [];

    renderUsers(
        allUsers
    );
}

function renderUsers(
    users
) {

    if (!userList) {
        return;
    }

    userList.innerHTML =
        "";

    if (
        !users ||
        users.length === 0
    ) {

        userList.innerHTML = `
            <div class="sidebar-empty">
                No users found.
            </div>
        `;

        return;
    }

    for (
        const user of users
    ) {

        const element =
            document.createElement(
                "button"
            );

        element.className =
            "user-item";

        element.type =
            "button";

        element.dataset.userId =
            user.id;

        element.innerHTML = `
            <div class="user-avatar">
                ${escapeHtml(
                    getInitial(
                        user.display_name
                    )
                )}
            </div>

            <div class="user-info">

                <div class="user-display-name">
                    ${escapeHtml(
                        user.display_name
                    )}
                </div>

                <div class="user-username">
                    @${escapeHtml(
                        user.username
                    )}
                </div>

            </div>
        `;

        element.addEventListener(
            "click",
            () => {

                closeMobileSidebar();

                openConversation(
                    user
                );
            }
        );

        userList.appendChild(
            element
        );
    }
}

if (userSearch) {

    userSearch.addEventListener(
        "input",
        () => {

            const query =
                userSearch.value
                    .trim()
                    .toLowerCase();

            if (!query) {

                renderUsers(
                    allUsers
                );

                return;
            }

            const filtered =
                allUsers.filter(
                    user => {

                        const username =
                            user.username
                                ?.toLowerCase() ||
                            "";

                        const displayName =
                            user.display_name
                                ?.toLowerCase() ||
                            "";

                        return (
                            username.includes(
                                query
                            ) ||
                            displayName.includes(
                                query
                            )
                        );
                    }
                );

            renderUsers(
                filtered
            );
        }
    );
}

function getInitial(
    name
) {

    if (!name) {
        return "?";
    }

    return name
        .trim()
        .charAt(0)
        .toUpperCase();
}

function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value ?? "";

    return div.innerHTML;
}


// ------------------------------------------------------------
// Conversations
// ------------------------------------------------------------

async function openConversation(
    user
) {

    if (
        !user ||
        !currentUser
    ) {
        return;
    }

    if (status) {
        status.textContent =
            "Opening conversation...";
    }

    if (conversationUser) {

        conversationUser.innerHTML = `
            <div class="conversation-avatar">
                ${escapeHtml(
                    getInitial(
                        user.display_name
                    )
                )}
            </div>

            <div>

                <div class="conversation-name">
                    ${escapeHtml(
                        user.display_name
                    )}
                </div>

                <div class="conversation-username">
                    @${escapeHtml(
                        user.username
                    )}
                </div>

            </div>
        `;
    }

    const {
        data,
        error
    } =
        await client.rpc(
            "get_or_create_conversation",
            {
                target_user_id:
                    user.id
            }
        );

    if (error) {

        console.error(
            "CONVERSATION ERROR:",
            error
        );

        if (status) {
            status.textContent =
                "Conversation error";
        }

        messages.innerHTML = `
            <div class="empty">
                Failed to open conversation.
            </div>
        `;

        return;
    }

    currentConversationId =
        data;

    currentConversationUser =
        user;

    await stopRealtime();

    await loadConversationMessages();

    await startConversationRealtime();

    if (messageInput) {

        messageInput.disabled =
            false;

        messageInput.placeholder =
            `Message ${user.display_name}...`;

        messageInput.focus();
    }

    if (messageForm) {

        const button =
            messageForm.querySelector(
                "button"
            );

        if (button) {
            button.disabled =
                false;
        }
    }

    if (status) {
        status.textContent =
            "Connected";
    }
}

async function loadConversationMessages() {

    if (!currentConversationId) {
        return;
    }

    displayedMessageIds.clear();

    messages.innerHTML = `
        <div class="empty">
            Loading messages...
        </div>
    `;

    const {
        data,
        error
    } =
        await client
            .from("messages")
            .select(`
                id,
                user_id,
                conversation_id,
                content,
                created_at,
                profile:profiles (
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .eq(
                "conversation_id",
                currentConversationId
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

    if (error) {

        console.error(
            "MESSAGE LOAD ERROR:",
            error
        );

        messages.innerHTML = `
            <div class="empty">
                Failed to load messages.
            </div>
        `;

        return;
    }

    messages.innerHTML =
        "";

    if (
        !data ||
        data.length === 0
    ) {

        messages.innerHTML = `
            <div class="empty">
                No messages yet. Say hello!
            </div>
        `;

        return;
    }

    for (
        const message of data
    ) {

        addMessage(
            message
        );
    }
}

function addMessage(
    message
) {

    if (
        message.id &&
        displayedMessageIds.has(
            message.id
        )
    ) {
        return;
    }

    if (message.id) {

        displayedMessageIds.add(
            message.id
        );
    }

    const empty =
        messages.querySelector(
            ".empty"
        );

    if (empty) {
        empty.remove();
    }

    const element =
        document.createElement(
            "div"
        );

    element.className =
        "message";

    if (
        currentUser &&
        message.user_id ===
            currentUser.id
    ) {

        element.classList.add(
            "own"
        );
    }

    const username =
        document.createElement(
            "div"
        );

    username.className =
        "username";

    username.textContent =
        message.profile?.display_name ||
        "User";

    const content =
        document.createElement(
            "div"
        );

    content.className =
        "content";

    content.textContent =
        message.content;

    element.appendChild(
        username
    );

    element.appendChild(
        content
    );

    messages.appendChild(
        element
    );

    messages.scrollTop =
        messages.scrollHeight;
}


// ------------------------------------------------------------
// Sending messages
// ------------------------------------------------------------

async function sendMessage(
    content
) {

    if (
        !currentUser ||
        !currentConversationId
    ) {
        return false;
    }

    const {
        error
    } =
        await client
            .from("messages")
            .insert({
                user_id:
                    currentUser.id,

                conversation_id:
                    currentConversationId,

                content
            });

    if (error) {

        console.error(
            "MESSAGE SEND ERROR:",
            error
        );

        if (status) {
            status.textContent =
                "Send failed";
        }

        return false;
    }

    return true;
}

if (messageForm) {

    messageForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const content =
                messageInput.value
                    .trim();

            if (
                !content ||
                !currentConversationId
            ) {
                return;
            }

            const button =
                messageForm.querySelector(
                    "button"
                );

            if (button) {
                button.disabled =
                    true;
            }

            const success =
                await sendMessage(
                    content
                );

            if (success) {

                messageInput.value =
                    "";

                messageInput.focus();
            }

            if (button) {
                button.disabled =
                    false;
            }
        }
    );
}


// ------------------------------------------------------------
// Realtime
// ------------------------------------------------------------

async function startConversationRealtime() {

    await stopRealtime();

    if (!currentConversationId) {
        return;
    }

    const channelName =
        `conversation:${currentConversationId}`;

    realtimeChannel =
        client
            .channel(
                channelName
            )
            .on(
                "postgres_changes",
                {
                    event:
                        "INSERT",

                    schema:
                        "public",

                    table:
                        "messages",

                    filter:
                        `conversation_id=eq.${currentConversationId}`
                },
                async (
                    payload
                ) => {

                    if (
                        payload.new
                            .conversation_id !==
                        currentConversationId
                    ) {
                        return;
                    }

                    const {
                        data: profile
                    } =
                        await client
                            .from(
                                "profiles"
                            )
                            .select(
                                "username, display_name, avatar_url"
                            )
                            .eq(
                                "id",
                                payload.new.user_id
                            )
                            .single();

                    addMessage({

                        ...payload.new,

                        profile
                    });
                }
            )
            .subscribe(
                (
                    subscriptionStatus
                ) => {

                    console.log(
                        "REALTIME:",
                        subscriptionStatus
                    );

                    if (status) {

                        if (
                            subscriptionStatus ===
                            "SUBSCRIBED"
                        ) {

                            status.textContent =
                                "Connected";

                        } else {

                            status.textContent =
                                subscriptionStatus;
                        }
                    }
                }
            );
}

async function stopRealtime() {

    if (!realtimeChannel) {
        return;
    }

    await client.removeChannel(
        realtimeChannel
    );

    realtimeChannel =
        null;
}


// ------------------------------------------------------------
// Start chat
// ------------------------------------------------------------

async function startChat() {

    if (
        !currentUser ||
        !currentProfile
    ) {
        return;
    }

    if (currentUserElement) {

        currentUserElement.textContent =
            currentProfile.display_name;
    }

    showChatScreen();

    await loadUsers();

    if (messages) {

        messages.innerHTML = `
            <div class="empty">
                Select a user to start a conversation.
            </div>
        `;
    }

    if (messageInput) {

        messageInput.disabled =
            true;

        messageInput.placeholder =
            "Select a conversation...";
    }

    if (messageForm) {

        const button =
            messageForm.querySelector(
                "button"
            );

        if (button) {
            button.disabled =
                true;
        }
    }

    await stopRealtime();

    if (status) {
        status.textContent =
            "Ready";
    }
}


// ------------------------------------------------------------
// Logout
// ------------------------------------------------------------

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            await stopRealtime();

            closeGooglePopup();

            const {
                error
            } =
                await client.auth.signOut();

            if (error) {

                console.error(
                    "LOGOUT ERROR:",
                    error
                );

                return;
            }

            currentUser =
                null;

            currentProfile =
                null;

            currentConversationId =
                null;

            currentConversationUser =
                null;

            allUsers =
                [];

            displayedMessageIds.clear();

            editingProfile =
                false;

            if (messages) {

                messages.innerHTML = `
                    <div class="empty">
                        Select a user to start a conversation.
                    </div>
                `;
            }

            showLoginScreen();
        }
    );
}


// ------------------------------------------------------------
// Session
// ------------------------------------------------------------

async function checkSession() {

    const {
        data,
        error
    } =
        await client.auth.getSession();

    if (error) {

        console.error(
            "SESSION ERROR:",
            error
        );

        showLoginScreen();

        return;
    }

    if (
        data &&
        data.session
    ) {

        currentUser =
            data.session.user;

        await initializeUser();

    } else {

        showLoginScreen();
    }
}

client.auth.onAuthStateChange(
    (
        event,
        session
    ) => {

        console.log(
            "AUTH EVENT:",
            event
        );

        if (
            session &&
            !currentUser
        ) {

            currentUser =
                session.user;

            closeGooglePopup();

            setTimeout(
                () => {
                    initializeUser();
                },
                0
            );
        }

        if (!session) {

            currentUser =
                null;

            currentProfile =
                null;

            currentConversationId =
                null;

            currentConversationUser =
                null;

            closeGooglePopup();

            stopRealtime();

            showLoginScreen();
        }
    }
);


console.log(
    "Starting OpenTalk..."
);

checkSession();
