const SUPABASE_URL = "https://vkelkgabycpxojybguvj.supabase.co";
const SUPABASE_KEY = "sb_publishable_LntMHz6esPpIJszjXzzAzw_W-FVSljU";
const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const REDIRECT_URL =
    new URL("auth-callback.html", window.location.href).href;

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

// Global chat intentionally untouched.

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

    // The profile screen may be shown before the image
    // has finished resolving. Refresh it after the DOM is visible.
    if (currentProfile || currentUser) {
        updateProfileAvatarPreview(
            currentProfile
        );
    }
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

function showError(element, message) {

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

function createUsernameSuggestion(metadata = {}) {

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

    if (!profileForm) {
        return;
    }

    /*
     * Always get the existing elements from the HTML.
     * Do not create another preview, input, or wrapper.
     */
    profileAvatarInput =
        $("profile-avatar-input");

    profileAvatarPreview =
        $("profile-avatar-preview");

    if (
        profileAvatarInput &&
        !profileAvatarInput.dataset.avatarHandlerAttached
    ) {

        profileAvatarInput.addEventListener(
            "change",
            handleAvatarSelection
        );

        profileAvatarInput.dataset.avatarHandlerAttached =
            "true";
    }

    /*
     * Only create the remove button if it does not
     * already exist.
     */
    profileAvatarRemoveButton =
        $("profile-avatar-remove");

    if (!profileAvatarRemoveButton) {

        profileAvatarRemoveButton =
            document.createElement(
                "button"
            );

        profileAvatarRemoveButton.id =
            "profile-avatar-remove";

        profileAvatarRemoveButton.type =
            "button";

        profileAvatarRemoveButton.textContent =
            "Remove picture";

        /*
         * Keep this button visually simple and don't
         * interfere with the existing avatar-picker CSS.
         */
        profileAvatarRemoveButton.style.display =
            "none";

        profileAvatarRemoveButton.style.border =
            "0";

        profileAvatarRemoveButton.style.background =
            "none";

        profileAvatarRemoveButton.style.color =
            "#aa9caf";

        profileAvatarRemoveButton.style.cursor =
            "pointer";

        profileAvatarRemoveButton.style.fontSize =
            "11px";

        profileAvatarRemoveButton.style.padding =
            "0";

        profileAvatarRemoveButton.style.margin =
            "6px 0 0";

        profileAvatarRemoveButton.addEventListener(
            "click",
            removeSelectedAvatar
        );

        const picker =
            profileForm.querySelector(
                ".avatar-picker"
            );

        if (picker) {
            picker.appendChild(
                profileAvatarRemoveButton
            );
        }
    }
}

function getGoogleAvatarUrl() {

    const metadata =
        currentUser?.user_metadata ||
        {};

    return (
        metadata.avatar_url ||
        metadata.picture ||
        ""
    );
}

function setProfileAvatarImage(
    container,
    url,
    fallbackName
) {

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const fallback =
        document.createElement(
            "span"
        );

    fallback.textContent =
        getInitial(
            fallbackName
        );

    /*
     * Keep the fallback hidden until the image actually
     * fails. This prevents the broken-image icon from
     * appearing in the profile picker.
     */
    fallback.style.display =
        "none";

    container.appendChild(
        fallback
    );

    if (!url) {

        fallback.style.display =
            "flex";

        return;
    }

    const img =
        document.createElement(
            "img"
        );

    img.alt = "";
    img.draggable = false;

    /*
     * Set the important sizing directly on this image so
     * existing global img rules cannot break the picker.
     */
    img.style.width =
        "100%";

    img.style.height =
        "100%";

    img.style.display =
        "block";

    img.style.objectFit =
        "cover";

    img.style.objectPosition =
        "center";

    img.style.borderRadius =
        "50%";

    img.onload =
        () => {

            img.style.display =
                "block";

            fallback.style.display =
                "none";
        };

    img.onerror =
        () => {

            img.remove();

            fallback.style.display =
                "flex";
        };

    img.src = url;

    container.appendChild(
        img
    );
}

function removeSelectedAvatar() {

    selectedAvatarFile = null;

    if (profileAvatarInput) {
        profileAvatarInput.value = "";
    }

    /*
     * If an existing profile has an avatar, removing the
     * newly selected file should restore that avatar.
     * Otherwise restore the Google/Gmail avatar.
     */
    const existingAvatar =
        currentProfile?.avatar_url ||
        getGoogleAvatarUrl();

    if (existingAvatar) {

        if (
            currentProfile?.avatar_url
        ) {

            resolveAvatarUrl(
                currentProfile.avatar_url
            )
                .then(
                    url => {

                        setProfileAvatarImage(
                            profileAvatarPreview,
                            url,
                            currentProfile?.display_name ||
                            currentUser?.user_metadata?.name
                        );
                    }
                );
        } else {

            setProfileAvatarImage(
                profileAvatarPreview,
                existingAvatar,
                currentProfile?.display_name ||
                currentUser?.user_metadata?.name
            );
        }

    } else {

        setProfileAvatarImage(
            profileAvatarPreview,
            null,
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

function handleAvatarSelection(event) {

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

    clearError(profileError);

    selectedAvatarFile =
        file;

    /*
     * Use a blob URL instead of putting a data URL into
     * innerHTML. This avoids malformed/broken image markup.
     */
    const objectUrl =
        URL.createObjectURL(
            file
        );

    setProfileAvatarImage(
        profileAvatarPreview,
        objectUrl,
        profileDisplayName?.value ||
        currentProfile?.display_name
    );

    if (
        profileAvatarRemoveButton
    ) {

        profileAvatarRemoveButton.style.display =
            "block";
    }
}

async function updateProfileAvatarPreview(profile) {

    ensureProfileAvatarPicker();

    if (
        !profileAvatarPreview ||
        selectedAvatarFile
    ) {
        return;
    }

    /*
     * Priority:
     * 1. Saved custom avatar
     * 2. Google/Gmail avatar
     * 3. Initial
     */
    if (profile?.avatar_url) {

        const url =
            await resolveAvatarUrl(
                profile.avatar_url
            );

        /*
         * Only update the picker if the profile hasn't
         * changed while the async request was running.
         */
        if (
            !selectedAvatarFile &&
            profileAvatarPreview
        ) {

            setProfileAvatarImage(
                profileAvatarPreview,
                url,
                profile?.display_name ||
                currentUser?.user_metadata?.name
            );
        }

        if (profileAvatarRemoveButton) {

            profileAvatarRemoveButton.style.display =
                url
                    ? "block"
                    : "none";
        }

        if (url) {
            return;
        }
    }

    const googleAvatar =
        getGoogleAvatarUrl();

    if (googleAvatar) {

        setProfileAvatarImage(
            profileAvatarPreview,
            googleAvatar,
            profile?.display_name ||
            currentUser?.user_metadata?.name
        );

        if (profileAvatarRemoveButton) {

            /*
             * Google avatar is not a custom uploaded
             * avatar, so don't offer "Remove picture".
             */
            profileAvatarRemoveButton.style.display =
                "none";
        }

        return;
    }

    setProfileAvatarImage(
        profileAvatarPreview,
        null,
        profile?.display_name ||
        currentUser?.user_metadata?.name ||
        profileDisplayName?.value
    );

    if (profileAvatarRemoveButton) {

        profileAvatarRemoveButton.style.display =
            "none";
    }
}

async function uploadAvatar(file) {

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
            .from(AVATAR_BUCKET)
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

    return path;
}

function avatarStoragePath(value) {

    if (!value) {
        return null;
    }

    /*
     * Uploaded avatars are stored as:
     *
     * user-id/random-file.ext
     */
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

async function deleteAvatar(avatarUrl) {

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
            .from(AVATAR_BUCKET)
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

async function resolveAvatarUrl(avatarValue) {

    if (!avatarValue) {
        return null;
    }

    const path =
        avatarStoragePath(
            avatarValue
        );

    /*
     * Google/Gmail avatar or another external URL.
     */
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

    /*
     * First try a signed URL.
     */
    const {
        data: signed,
        error: signedError
    } =
        await client.storage
            .from(AVATAR_BUCKET)
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

    /*
     * Then try downloading the object.
     */
    const {
        data: blob,
        error: downloadError
    } =
        await client.storage
            .from(AVATAR_BUCKET)
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

    /*
     * Finally try the public URL.
     */
    const {
        data: publicData
    } =
        client.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(
                path
            );

    if (publicData?.publicUrl) {

        avatarObjectUrls.set(
            cacheKey,
            publicData.publicUrl
        );

        return publicData.publicUrl;
    }

    return null;
}

function prepareProfileForm(profile) {

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

    /*
     * Clear the old preview immediately so an async
     * avatar lookup cannot leave stale/broken markup.
     */
    if (profileAvatarPreview) {

        profileAvatarPreview.innerHTML = "";

        profileAvatarPreview.textContent =
            getInitial(
                profile?.display_name ||
                currentUser?.user_metadata?.name ||
                profileDisplayName?.value
            );
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

    clearError(profileError);

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

            clearError(profileError);

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

            clearError(profileError);

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

            /*
             * If the user has no custom uploaded avatar,
             * save their Google/Gmail avatar URL to their
             * profile so other users can see it.
             */
            if (!avatarUrl) {

                avatarUrl =
                    getGoogleAvatarUrl() ||
                    null;
            }

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
                    currentProfile?.avatar_url ||
                    null;

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


function getAvatarHtml(
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
                style="
                    display:none;
                    width:100%;
                    height:100%;
                    object-fit:cover;
                "
            >

            <span>
                ${initial}
            </span>

        </div>
    `;
}


function getAvatarMarkup(
    user,
    className = "user-avatar"
) {

    return getAvatarHtml(
        user,
        className
    );
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

                const avatarValue =
                    img.dataset.avatarUrl;

                if (!avatarValue) {
                    return;
                }

                /*
                 * Set the handlers BEFORE assigning src.
                 * This prevents fast/cached images from
                 * missing the load event.
                 */
                img.onload = () => {

                    img.style.display =
                        "block";

                    img.style.visibility =
                        "visible";

                    if (
                        img.nextElementSibling
                    ) {

                        img.nextElementSibling.style.display =
                            "none";
                    }
                };

                img.onerror = () => {

                    console.warn(
                        "AVATAR IMAGE FAILED:",
                        avatarValue
                    );

                    img.style.display =
                        "none";

                    if (
                        img.nextElementSibling
                    ) {

                        img.nextElementSibling.style.display =
                            "flex";
                    }
                };

                resolveAvatarUrl(
                    avatarValue
                )
                    .then(
                        url => {

                            if (!url) {

                                img.style.display =
                                    "none";

                                if (
                                    img.nextElementSibling
                                ) {

                                    img.nextElementSibling.style.display =
                                        "flex";
                                }

                                return;
                            }

                            /*
                             * Handler is already installed,
                             * so now assign the image URL.
                             */
                            img.src = url;

                            /*
                             * Handle images that were already
                             * completely loaded by the browser.
                             */
                            if (
                                img.complete &&
                                img.naturalWidth > 0
                            ) {

                                img.style.display =
                                    "block";

                                img.style.visibility =
                                    "visible";

                                if (
                                    img.nextElementSibling
                                ) {

                                    img.nextElementSibling.style.display =
                                        "none";
                                }
                            }
                        }
                    )
                    .catch(
                        error => {

                            console.warn(
                                "AVATAR RESOLUTION FAILED:",
                                error
                            );

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
        const user of
        users
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
            ${getAvatarHtml(user)}

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

        conversationUser.innerHTML = `
            ${getAvatarHtml(
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


/*
 * MESSAGE AVATARS ARE INTENTIONALLY NOT RENDERED.
 */
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

    messages.scrollTop =
        messages.scrollHeight;
}


// ------------------------------------------------------------
// Messages
// ------------------------------------------------------------

async function sendMessage(content) {

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
