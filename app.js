const SUPABASE_URL = "https://vkelkgabycpxojybguvj.supabase.co";
const SUPABASE_KEY = "sb_publishable_LntMHz6esPpIJszjXzzAzw_W-FVSljU";
const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const REDIRECT_URL = new URL("auth-callback.html", window.location.href).href;

let currentUser = null;
let currentProfile = null;
let currentConversationId = null;
let currentConversationUser = null;
let realtimeChannel = null;
let allUsers = [];
let initializingUser = false;
let editingProfile = false;
let selectedAvatarFile = null;
let googleAuthPopup = null;
let googleAuthTimeout = null;

const displayedMessageIds = new Set();
const avatarObjectUrls = new Map();

const $ = id => document.getElementById(id);

const authScreen = $("auth-screen");
const profileScreen = $("profile-screen");
const chatScreen = $("chat-screen");

const googleLogin = $("google-login");

const profileForm = $("profile-form");
const profileUsername = $("profile-username");
const profileDisplayName = $("profile-display-name");

const profileCustomizeButton =
    $("profile-customize-button") ||
    $("edit-profile-button") ||
    $("profile-button");

const authError = $("auth-error");
const profileError = $("profile-error");

const status = $("status");
const currentUserElement = $("current-user");
const userSearch = $("user-search");
const userList = $("user-list");
const conversationUser = $("conversation-user");
const messages = $("messages");
const messageForm = $("message-form");
const messageInput = $("message");
const logoutButton = $("logout-button");

const userSidebar = $("user-sidebar");
const mobileChatSelector = $("mobile-chat-selector");
const mobileSidebarBackdrop = $("mobile-sidebar-backdrop");

const globalChatButton = $("global-chat-button");
// stupid shit, leave global chat alone for now

let profileAvatarInput = null;
let profileAvatarPreview = null;
let profileAvatarRemoveButton = null;


// ------------------------------------------------------------
// Mobile
// ------------------------------------------------------------

function isMobile() {
    return window.matchMedia("(max-width: 700px)").matches;
}

function openMobileSidebar() {

    if (!isMobile() || !userSidebar) {
        return;
    }

    userSidebar.classList.add("mobile-open");

    mobileSidebarBackdrop?.classList.add(
        "mobile-visible"
    );

    mobileChatSelector?.setAttribute(
        "aria-expanded",
        "true"
    );
}

function closeMobileSidebar() {

    if (!userSidebar) {
        return;
    }

    userSidebar.classList.remove(
        "mobile-open"
    );

    mobileSidebarBackdrop?.classList.remove(
        "mobile-visible"
    );

    mobileChatSelector?.setAttribute(
        "aria-expanded",
        "false"
    );
}

function toggleMobileSidebar() {

    if (!isMobile()) {
        return;
    }

    if (
        userSidebar?.classList.contains(
            "mobile-open"
        )
    ) {
        closeMobileSidebar();
    } else {
        openMobileSidebar();
    }
}

mobileChatSelector?.addEventListener(
    "click",
    toggleMobileSidebar
);

mobileSidebarBackdrop?.addEventListener(
    "click",
    closeMobileSidebar
);


// Global chat intentionally untouched.

globalChatButton?.addEventListener(
    "click",
    () => {

        closeMobileSidebar();

        globalChatButton.classList.add(
            "active"
        );
    }
);


// ------------------------------------------------------------
// Screens
// ------------------------------------------------------------

function hideAllScreens() {

    authScreen?.classList.add("hidden");
    profileScreen?.classList.add("hidden");
    chatScreen?.classList.add("hidden");
}

function showLoginScreen() {

    hideAllScreens();

    authScreen?.classList.remove(
        "hidden"
    );

    resetGoogleButton();
}

function showProfileScreen() {

    hideAllScreens();

    profileScreen?.classList.remove(
        "hidden"
    );

    ensureProfileAvatarPicker();
}

function showChatScreen() {

    hideAllScreens();

    chatScreen?.classList.remove(
        "hidden"
    );
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

    element.textContent = message;
    element.style.display = "block";
}

function clearError(element) {

    if (!element) {
        return;
    }

    element.textContent = "";
    element.style.display = "none";
}


// ------------------------------------------------------------
// Google login
// ------------------------------------------------------------

function resetGoogleButton() {

    if (!googleLogin) {
        return;
    }

    googleLogin.disabled = false;

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

    googleLogin.disabled = true;

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

    clearError(authError);

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
            provider: "google",

            options: {
                redirectTo:
                    REDIRECT_URL,

                skipBrowserRedirect:
                    true
            }
        });

    if (
        error ||
        !data?.url
    ) {

        console.error(
            "GOOGLE OAUTH ERROR:",
            error
        );

        closeGooglePopup();

        showError(
            authError,
            error?.message ||
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
                    googleAuthPopup?.closed
                ) {

                    clearInterval(
                        googleAuthTimeout
                    );

                    googleAuthTimeout = null;
                    googleAuthPopup = null;

                    if (!currentUser) {

                        showError(
                            authError,
                            "Google sign-in was cancelled."
                        );
                    }

                    resetGoogleButton();

                    return;
                }

                const {
                    data,
                    error
                } =
                    await client.auth.getSession();

                if (error) {
                    return;
                }

                if (
                    data?.session &&
                    !currentUser
                ) {

                    currentUser =
                        data.session.user;

                    clearInterval(
                        googleAuthTimeout
                    );

                    googleAuthTimeout = null;

                    closeGooglePopup();

                    await initializeUser();
                }

            },
            500
        );
}

function closeGooglePopup() {

    clearInterval(
        googleAuthTimeout
    );

    googleAuthTimeout = null;

    if (
        googleAuthPopup &&
        !googleAuthPopup.closed
    ) {

        try {
            googleAuthPopup.close();
        } catch {}
    }

    googleAuthPopup = null;
}

googleLogin?.addEventListener(
    "click",
    startGoogleLogin
);


// ------------------------------------------------------------
// Auth callback
// ------------------------------------------------------------

window.addEventListener(
    "message",
    async event => {

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

                showError(
                    authError,
                    error.message
                );

                resetGoogleButton();

                return;
            }

            if (!data?.session) {

                showError(
                    authError,
                    "Authentication completed, but no session was found."
                );

                resetGoogleButton();

                return;
            }

            currentUser =
                data.session.user;

            clearError(authError);

            await initializeUser();
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
// Profile
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
    metadata = {}
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


// ------------------------------------------------------------
// Profile picture
// ------------------------------------------------------------

function ensureProfileAvatarPicker() {

    if (
        !profileForm ||
        profileAvatarInput
    ) {
        return;
    }

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.id =
        "profile-avatar-picker";

    wrapper.style.cssText =
        `
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:10px;
        margin-bottom:16px;
        `;

    profileAvatarPreview =
        document.createElement(
            "div"
        );

    profileAvatarPreview.className =
        "profile-avatar-preview";

    profileAvatarPreview.style.cssText =
        `
        width:76px;
        height:76px;
        border-radius:50%;
        overflow:hidden;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#171025;
        border:1px solid #30223d;
        color:#ff78c8;
        font-size:24px;
        font-weight:700;
        font-family:ui-monospace,monospace;
        `;

    const label =
        document.createElement(
            "label"
        );

    label.textContent =
        "Choose profile picture";

    label.style.cssText =
        `
        cursor:pointer;
        color:#ff78c8;
        font-size:12px;
        font-family:ui-monospace,monospace;
        `;

    profileAvatarInput =
        document.createElement(
            "input"
        );

    profileAvatarInput.type =
        "file";

    profileAvatarInput.accept =
        "image/png,image/jpeg,image/webp,image/gif";

    profileAvatarInput.id =
        "profile-avatar";

    profileAvatarInput.style.display =
        "none";

    profileAvatarInput.addEventListener(
        "change",
        handleAvatarSelection
    );

    label.appendChild(
        profileAvatarInput
    );

    profileAvatarRemoveButton =
        document.createElement(
            "button"
        );

    profileAvatarRemoveButton.type =
        "button";

    profileAvatarRemoveButton.textContent =
        "Remove picture";

    profileAvatarRemoveButton.style.cssText =
        `
        display:none;
        border:0;
        background:none;
        color:#aa9caf;
        cursor:pointer;
        font-size:11px;
        `;

    profileAvatarRemoveButton.addEventListener(
        "click",
        removeSelectedAvatar
    );

    wrapper.append(
        profileAvatarPreview,
        label,
        profileAvatarRemoveButton
    );

    profileForm.insertBefore(
        wrapper,
        profileUsername ||
        profileForm.firstChild
    );
}

function removeSelectedAvatar() {

    selectedAvatarFile = null;

    if (profileAvatarInput) {
        profileAvatarInput.value = "";
    }

    if (profileAvatarPreview) {

        profileAvatarPreview.innerHTML =
            "";

        profileAvatarPreview.textContent =
            getInitial(
                profileDisplayName?.value ||
                currentProfile?.display_name
            );
    }

    if (profileAvatarRemoveButton) {

        profileAvatarRemoveButton.style.display =
            currentProfile?.avatar_url
                ? "block"
                : "none";
    }
}

function handleAvatarSelection(
    event
) {

    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        showError(
            profileError,
            "Please choose an image file."
        );

        event.target.value = "";

        return;
    }

    if (
        file.size >
        MAX_AVATAR_SIZE
    ) {

        showError(
            profileError,
            "Profile pictures must be smaller than 5 MB."
        );

        event.target.value = "";

        return;
    }

    clearError(
        profileError
    );

    selectedAvatarFile =
        file;

    const reader =
        new FileReader();

    reader.onload =
        () => {

            if (!profileAvatarPreview) {
                return;
            }

            profileAvatarPreview.innerHTML =
                `
                <img
                    src="${reader.result}"
                    alt=""
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                    "
                >
                `;

            if (
                profileAvatarRemoveButton
            ) {

                profileAvatarRemoveButton.style.display =
                    "block";
            }
        };

    reader.readAsDataURL(
        file
    );
}

async function updateProfileAvatarPreview(
    profile
) {

    ensureProfileAvatarPicker();

    if (
        !profileAvatarPreview ||
        selectedAvatarFile
    ) {
        return;
    }

    if (
        profile?.avatar_url
    ) {

        const url =
            await resolveAvatarUrl(
                profile.avatar_url
            );

        if (url) {

            profileAvatarPreview.innerHTML =
                `
                <img
                    src="${escapeHtml(url)}"
                    alt=""
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                    "
                >
                `;

            if (
                profileAvatarRemoveButton
            ) {

                profileAvatarRemoveButton.style.display =
                    "block";
            }

            return;
        }
    }

    const metadata =
        currentUser?.user_metadata ||
        {};

    const googleAvatar =
        metadata.avatar_url ||
        metadata.picture ||
        "";

    if (googleAvatar) {

        profileAvatarPreview.innerHTML =
            `
            <img
                src="${escapeHtml(googleAvatar)}"
                alt=""
                style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                "
            >
            `;

        if (
            profileAvatarRemoveButton
        ) {

            profileAvatarRemoveButton.style.display =
                "block";
        }

        return;
    }

    profileAvatarPreview.textContent =
        getInitial(
            profile?.display_name ||
            metadata.full_name ||
            metadata.name
        );

    if (
        profileAvatarRemoveButton
    ) {

        profileAvatarRemoveButton.style.display =
            "none";
    }
}

async function uploadAvatar(
    file
) {

    if (
        !currentUser ||
        !file
    ) {
        return null;
    }

    const extension =
        (
            file.name
                .split(".")
                .pop() ||
            "jpg"
        )
            .toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                ""
            ) ||
        "jpg";

    const path =
        `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

    const {
        error
    } =
        await client.storage
            .from(
                AVATAR_BUCKET
            )
            .upload(
                path,
                file,
                {
                    cacheControl:
                        "3600",

                    contentType:
                        file.type,

                    upsert:
                        false
                }
            );

    if (error) {

        console.error(
            "AVATAR UPLOAD ERROR:",
            error
        );

        return null;
    }

    // Store the storage path instead of a temporary/browser URL.
    return path;
}

function avatarStoragePath(
    value
) {

    if (!value) {
        return null;
    }

    // New profiles store the path directly.
    if (
        !value.startsWith("http")
    ) {

        return value.replace(
            /^\/+/,
            ""
        );
    }

    try {

        const url =
            new URL(value);

        const markers = [
            `/storage/v1/object/public/${AVATAR_BUCKET}/`,
            `/storage/v1/object/authenticated/${AVATAR_BUCKET}/`,
            `/storage/v1/object/sign/${AVATAR_BUCKET}/`
        ];

        for (
            const marker of markers
        ) {

            const index =
                url.pathname.indexOf(
                    marker
                );

            if (index !== -1) {

                return decodeURIComponent(
                    url.pathname.substring(
                        index +
                        marker.length
                    )
                );
            }
        }

    } catch {}

    return null;
}

async function deleteAvatar(
    avatarUrl
) {

    if (
        !avatarUrl ||
        !currentUser
    ) {
        return;
    }

    const path =
        avatarStoragePath(
            avatarUrl
        );

    if (
        !path ||
        !path.startsWith(
            `${currentUser.id}/`
        )
    ) {
        return;
    }

    const {
        error
    } =
        await client.storage
            .from(
                AVATAR_BUCKET
            )
            .remove([
                path
            ]);

    if (error) {

        console.warn(
            "AVATAR DELETE FAILED:",
            error
        );
    }
}

async function resolveAvatarUrl(
    avatarValue
) {

    if (!avatarValue) {
        return null;
    }

    const path =
        avatarStoragePath(
            avatarValue
        );

    // Google/external avatar.
    if (!path) {
        return avatarValue;
    }

    const cacheKey =
        `${AVATAR_BUCKET}/${path}`;

    if (
        avatarObjectUrls.has(
            cacheKey
        )
    ) {

        return avatarObjectUrls.get(
            cacheKey
        );
    }

    // Signed URLs work with private buckets too.
    const {
        data: signed,
        error: signedError
    } =
        await client.storage
            .from(
                AVATAR_BUCKET
            )
            .createSignedUrl(
                path,
                3600
            );

    if (
        !signedError &&
        signed?.signedUrl
    ) {

        avatarObjectUrls.set(
            cacheKey,
            signed.signedUrl
        );

        return signed.signedUrl;
    }

    // Fallback for buckets where download is allowed.
    const {
        data: blob,
        error: downloadError
    } =
        await client.storage
            .from(
                AVATAR_BUCKET
            )
            .download(
                path
            );

    if (
        !downloadError &&
        blob
    ) {

        const objectUrl =
            URL.createObjectURL(
                blob
            );

        avatarObjectUrls.set(
            cacheKey,
            objectUrl
        );

        return objectUrl;
    }

    // Final fallback for public buckets.
    const {
        data: publicData
    } =
        client.storage
            .from(
                AVATAR_BUCKET
            )
            .getPublicUrl(
                path
            );

    return (
        publicData?.publicUrl ||
        (
            avatarValue.startsWith(
                "http"
            )
                ? avatarValue
                : null
        )
    );
}

function prepareProfileForm(
    profile
) {

    ensureProfileAvatarPicker();

    selectedAvatarFile = null;

    if (profileAvatarInput) {
        profileAvatarInput.value = "";
    }

    if (profile) {

        profileUsername.value =
            profile.username ||
            "";

        profileDisplayName.value =
            profile.display_name ===
                "New User"
                ? ""
                :
                (
                    profile.display_name ||
                    ""
                );

    } else {

        const metadata =
            currentUser?.user_metadata ||
            {};

        profileUsername.value =
            createUsernameSuggestion(
                metadata
            );

        profileDisplayName.value =
            metadata.full_name ||
            metadata.name ||
            "";
    }

    updateProfileAvatarPreview(
        profile
    );
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

    profileUsername?.focus();
}

profileCustomizeButton?.addEventListener(
    "click",
    openProfileEditor
);


// ------------------------------------------------------------
// User initialization
// ------------------------------------------------------------

async function initializeUser() {

    if (
        !currentUser ||
        initializingUser
    ) {
        return;
    }

    initializingUser = true;

    try {

        currentProfile =
            await loadProfile();

        if (
            !currentProfile ||
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

            profileUsername?.focus();

            return;
        }

        await startChat();

    } finally {

        initializingUser = false;
    }
}


// ------------------------------------------------------------
// Save profile
// ------------------------------------------------------------

if (profileForm) {

    profileForm.addEventListener(
        "submit",
        async event => {

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
                    "button[type='submit']"
                );

            if (button) {

                button.disabled = true;
                button.textContent = "Checking...";
            }

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

                if (button) {

                    button.disabled = false;
                    button.textContent = "Continue";
                }

                showError(
                    profileError,
                    "Could not check username. Please try again."
                );

                return;
            }

            if (
                existingUsername &&
                existingUsername.id !==
                    currentUser.id
            ) {

                if (button) {

                    button.disabled = false;
                    button.textContent = "Continue";
                }

                showError(
                    profileError,
                    "That username is already taken. Please choose another one."
                );

                profileUsername.focus();
                profileUsername.select();

                return;
            }

            let avatarUrl =
                currentProfile?.avatar_url ||
                null;

            if (selectedAvatarFile) {

                if (button) {
                    button.textContent =
                        "Uploading picture...";
                }

                const uploadedPath =
                    await uploadAvatar(
                        selectedAvatarFile
                    );

                if (!uploadedPath) {

                    if (button) {

                        button.disabled = false;
                        button.textContent = "Continue";
                    }

                    showError(
                        profileError,
                        "Failed to upload profile picture. Make sure the avatars bucket exists and allows uploads."
                    );

                    return;
                }

                const oldAvatar =
                    avatarUrl;

                avatarUrl =
                    uploadedPath;

                if (oldAvatar) {

                    await deleteAvatar(
                        oldAvatar
                    );
                }
            }

            if (button) {
                button.textContent = "Saving...";
            }

            const profileData = {

                username,

                display_name:
                    displayName,

                avatar_url:
                    avatarUrl
            };

            let data;
            let error;

            if (currentProfile) {

                const result =
                    await client
                        .from("profiles")
                        .update(
                            profileData
                        )
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

                            ...profileData
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

                    button.disabled = false;
                    button.textContent = "Continue";
                }

                if (
                    error.code ===
                    "23505"
                ) {

                    showError(
                        profileError,
                        error.message
                            ?.toLowerCase()
                            .includes("username")
                            ? "That username was just taken. Please choose another one."
                            : "Your profile already exists. Please try again."
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

            editingProfile = false;
            selectedAvatarFile = null;

            if (button) {

                button.disabled = false;
                button.textContent = "Continue";
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

    userList.innerHTML =
        `
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

        userList.innerHTML =
            `
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

function getInitial(name) {

    if (!name) {
        return "?";
    }

    return name
        .trim()
        .charAt(0)
        .toUpperCase();
}

function escapeHtml(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value ?? "";

    return div.innerHTML;
}

function getAvatarMarkup(
    user,
    className = "user-avatar"
) {

    const initial =
        escapeHtml(
            getInitial(
                user?.display_name
            )
        );

    if (!user?.avatar_url) {

        return `
            <div class="${className}">
                ${initial}
            </div>
        `;
    }

    return `
        <div class="${className} avatar-wrap">

            <img
                data-avatar-url="${escapeHtml(
                    user.avatar_url
                )}"
                alt=""
                loading="lazy"
            >

            <span>
                ${initial}
            </span>

        </div>
    `;
}

function hydrateAvatarImages(root) {

    if (!root) {
        return;
    }

    root
        .querySelectorAll(
            "img[data-avatar-url]"
        )
        .forEach(
            img => {

                resolveAvatarUrl(
                    img.dataset.avatarUrl
                )
                    .then(
                        url => {

                            if (!url) {
                                return;
                            }

                            img.src = url;

                            img.onload =
                                () => {

                                    img.style.display =
                                        "block";

                                    if (
                                        img.nextElementSibling
                                    ) {

                                        img.nextElementSibling.style.display =
                                            "none";
                                    }
                                };

                            img.onerror =
                                () => {

                                    img.style.display =
                                        "none";

                                    if (
                                        img.nextElementSibling
                                    ) {

                                        img.nextElementSibling.style.display =
                                            "flex";
                                    }
                                };
                        }
                    )
                    .catch(
                        () => {

                            img.style.display =
                                "none";

                            if (
                                img.nextElementSibling
                            ) {

                                img.nextElementSibling.style.display =
                                    "flex";
                            }
                        }
                    );
            }
        );
}

function renderUsers(users) {

    if (!userList) {
        return;
    }

    userList.innerHTML = "";

    if (!users?.length) {

        userList.innerHTML =
            `
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

        element.innerHTML =
            `
            ${getAvatarMarkup(user)}

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

        hydrateAvatarImages(
            element
        );
    }
}

userSearch?.addEventListener(
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

        renderUsers(
            allUsers.filter(
                user =>
                    (
                        user.username ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            query
                        ) ||

                    (
                        user.display_name ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            query
                        )
            )
        );
    }
);


// ------------------------------------------------------------
// Conversations
// ------------------------------------------------------------

async function openConversation(user) {

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

        conversationUser.innerHTML =
            `
            ${getAvatarMarkup(
                user,
                "conversation-avatar"
            )}

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

        hydrateAvatarImages(
            conversationUser
        );
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

        if (messages) {

            messages.innerHTML =
                `
                <div class="empty">
                    Failed to open conversation.
                </div>
                `;
        }

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

    const button =
        messageForm?.querySelector(
            "button"
        );

    if (button) {
        button.disabled = false;
    }

    if (status) {
        status.textContent =
            "Connected";
    }
}

async function loadConversationMessages() {

    if (
        !currentConversationId ||
        !messages
    ) {
        return;
    }

    displayedMessageIds.clear();

    messages.innerHTML =
        `
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
            .select(
                `
                id,
                user_id,
                conversation_id,
                content,
                created_at,
                profile:profiles(
                    username,
                    display_name,
                    avatar_url
                )
                `
            )
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

        messages.innerHTML =
            `
            <div class="empty">
                Failed to load messages.
            </div>
            `;

        return;
    }

    messages.innerHTML = "";

    if (!data?.length) {

        messages.innerHTML =
            `
            <div class="empty">
                No messages yet. Say hello!
            </div>
            `;

        return;
    }

    data.forEach(
        addMessage
    );
}

function addMessage(message) {

    if (!messages) {
        return;
    }

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

    messages
        .querySelector(
            ".empty"
        )
        ?.remove();

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

    const profile =
        message.profile ||
        {};

    element.innerHTML =
        `
        <div class="message-author">

            ${getAvatarMarkup(
                profile,
                "message-avatar"
            )}

            <div class="username">
                ${escapeHtml(
                    profile.display_name ||
                    "User"
                )}
            </div>

        </div>

        <div class="content">
            ${escapeHtml(
                message.content
            )}
        </div>
        `;

    messages.appendChild(
        element
    );

    hydrateAvatarImages(
        element
    );

    messages.scrollTop =
        messages.scrollHeight;
}


// ------------------------------------------------------------
// Messages
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

messageForm?.addEventListener(
    "submit",
    async event => {

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
            button.disabled = true;
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
            button.disabled = false;
        }
    }
);


// ------------------------------------------------------------
// Realtime
// ------------------------------------------------------------

async function startConversationRealtime() {

    await stopRealtime();

    if (!currentConversationId) {
        return;
    }

    realtimeChannel =
        client
            .channel(
                `conversation:${currentConversationId}`
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
                async payload => {

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
                            .from("profiles")
                            .select(
                                "username,display_name,avatar_url"
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
                subscriptionStatus => {

                    if (!status) {
                        return;
                    }

                    status.textContent =
                        subscriptionStatus ===
                            "SUBSCRIBED"
                            ? "Connected"
                            : subscriptionStatus;
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

    realtimeChannel = null;
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

        messages.innerHTML =
            `
            <div class="empty">
                Select a user to start a conversation.
            </div>
            `;
    }

    if (messageInput) {

        messageInput.disabled = true;

        messageInput.placeholder =
            "Select a conversation...";
    }

    const button =
        messageForm?.querySelector(
            "button"
        );

    if (button) {
        button.disabled = true;
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

logoutButton?.addEventListener(
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

        currentUser = null;
        currentProfile = null;
        currentConversationId = null;
        currentConversationUser = null;
        allUsers = [];

        displayedMessageIds.clear();

        selectedAvatarFile = null;

        for (
            const url of
            avatarObjectUrls.values()
        ) {

            if (
                url.startsWith(
                    "blob:"
                )
            ) {

                URL.revokeObjectURL(
                    url
                );
            }
        }

        avatarObjectUrls.clear();

        showLoginScreen();
    }
);


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

    if (data?.session) {

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

            currentUser = null;
            currentProfile = null;
            currentConversationId = null;
            currentConversationUser = null;

            closeGooglePopup();

            stopRealtime();

            showLoginScreen();
        }
    }
);


// ------------------------------------------------------------
// Startup
// ------------------------------------------------------------

console.log(
    "Starting OpenTalk..."
);

ensureProfileAvatarPicker();

checkSession();
