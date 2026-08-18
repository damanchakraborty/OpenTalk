// ============================================================
// SUPABASE
// ============================================================

const SUPABASE_URL =
    "https://vkelkgabycpxojybguvj.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_LntMHz6esPpIJszjXzzAzw_W-FVSljU";

const client =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let currentProfile = null;

let currentConversationId = null;
let currentConversationUser = null;

let realtimeChannel = null;

let allUsers = [];

const displayedMessageIds = new Set();


// ============================================================
// DOM
// ============================================================

// Screens

const authScreen =
    document.getElementById("auth-screen");

const profileScreen =
    document.getElementById("profile-screen");

const chatScreen =
    document.getElementById("chat-screen");


// OTP authentication

const emailForm =
    document.getElementById("email-form");

const otpForm =
    document.getElementById("otp-form");

const authEmail =
    document.getElementById("auth-email");

const authOtp =
    document.getElementById("auth-otp");

const otpInfo =
    document.getElementById("otp-info");

const changeEmailButton =
    document.getElementById("change-email");


// Profile

const profileForm =
    document.getElementById("profile-form");

const profileUsername =
    document.getElementById("profile-username");

const profileDisplayName =
    document.getElementById("profile-display-name");


// Errors

const authError =
    document.getElementById("auth-error");

const profileError =
    document.getElementById("profile-error");


// Chat

const status =
    document.getElementById("status");

const currentUserElement =
    document.getElementById("current-user");

const userSearch =
    document.getElementById("user-search");

const userList =
    document.getElementById("user-list");

const conversationUser =
    document.getElementById("conversation-user");

const messages =
    document.getElementById("messages");

const messageForm =
    document.getElementById("message-form");

const messageInput =
    document.getElementById("message");

const logoutButton =
    document.getElementById("logout-button");


// ============================================================
// SCREEN MANAGEMENT
// ============================================================

function hideAllScreens() {

    if (authScreen)
        authScreen.classList.add("hidden");

    if (profileScreen)
        profileScreen.classList.add("hidden");

    if (chatScreen)
        chatScreen.classList.add("hidden");
}


function showLoginScreen() {

    hideAllScreens();

    authScreen.classList.remove("hidden");

    resetOTPForm();
}


function showProfileScreen() {

    hideAllScreens();

    profileScreen.classList.remove("hidden");
}


function showChatScreen() {

    hideAllScreens();

    chatScreen.classList.remove("hidden");
}


// ============================================================
// ERROR HANDLING
// ============================================================

function showError(element, message) {

    if (!element)
        return;

    element.textContent = message;

    element.style.display = "block";
}


function clearError(element) {

    if (!element)
        return;

    element.textContent = "";

    element.style.display = "none";
}


// ============================================================
// OTP FORM RESET
// ============================================================

function resetOTPForm() {

    clearError(authError);

    if (emailForm)
        emailForm.classList.remove("hidden");

    if (otpForm)
        otpForm.classList.add("hidden");

    if (otpInfo)
        otpInfo.classList.add("hidden");

    if (changeEmailButton)
        changeEmailButton.classList.add("hidden");

    if (authOtp)
        authOtp.value = "";
}


// ============================================================
// SEND OTP
// ============================================================

emailForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        clearError(authError);

        const email =
            authEmail.value
                .trim()
                .toLowerCase();


        if (!email) {

            showError(
                authError,
                "Please enter your email."
            );

            return;
        }


        const button =
            emailForm.querySelector("button");

        button.disabled = true;

        button.textContent =
            "Sending...";


        console.log(
            "Sending OTP to:",
            email
        );


        const {
            error
        } = await client.auth.signInWithOtp({

            email,

            options: {
                shouldCreateUser: true
            }

        });


        button.disabled = false;

        button.textContent =
            "Send verification code";


        if (error) {

            console.error(
                "OTP SEND ERROR:",
                error
            );

            showError(
                authError,
                error.message
            );

            return;
        }


        console.log(
            "OTP sent successfully."
        );


        emailForm.classList.add(
            "hidden"
        );

        otpForm.classList.remove(
            "hidden"
        );

        otpInfo.classList.remove(
            "hidden"
        );

        changeEmailButton.classList.remove(
            "hidden"
        );

        otpInfo.textContent =
            `We sent a verification code to ${email}.`;

        authOtp.focus();
    }
);


// ============================================================
// VERIFY OTP
// ============================================================

otpForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        clearError(authError);

        const email =
            authEmail.value
                .trim()
                .toLowerCase();

        const token =
            authOtp.value
                .trim();


        if (!email) {

            showError(
                authError,
                "Email is missing."
            );

            return;
        }


        if (!/^\d{6,8}$/.test(token)) {

            showError(
                authError,
                "Enter the 6-digit verification code."
            );

            return;
        }


        const button =
            otpForm.querySelector("button");

        button.disabled = true;

        button.textContent =
            "Verifying...";


        console.log(
            "Verifying OTP..."
        );


        const {
            data,
            error
        } = await client.auth.verifyOtp({

            email,

            token,

            type: "email"

        });


        button.disabled = false;

        button.textContent =
            "Verify code";


        if (error) {

            console.error(
                "OTP VERIFY ERROR:",
                error
            );

            showError(
                authError,
                error.message
            );

            return;
        }


        if (!data.session) {

            showError(
                authError,
                "Verification succeeded, but no session was created."
            );

            return;
        }


        console.log(
            "OTP verification successful."
        );


        currentUser =
            data.user;


        await initializeUser();
    }
);


// ============================================================
// CHANGE EMAIL
// ============================================================

changeEmailButton.addEventListener(
    "click",
    () => {

        clearError(authError);

        resetOTPForm();

        authEmail.focus();
    }
);


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile() {

    if (!currentUser) {
        return null;
    }


    const {
        data,
        error
    } = await client

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


// ============================================================
// INITIALIZE USER
// ============================================================

async function initializeUser() {

    if (!currentUser) {
        return;
    }


    console.log(
        "Initializing user:",
        currentUser.id
    );


    currentProfile =
        await loadProfile();


    // No profile yet

    if (!currentProfile) {

        showProfileScreen();

        profileUsername.value = "";

        profileDisplayName.value = "";

        profileUsername.focus();

        return;
    }


    // Existing incomplete profile

    if (
        !currentProfile.display_name ||
        currentProfile.display_name === "New User"
    ) {

        showProfileScreen();

        profileUsername.value =
            currentProfile.username || "";

        profileDisplayName.value = "";

        profileUsername.focus();

        return;
    }


    await startChat();
}


// ============================================================
// PROFILE UPDATE
// ============================================================

profileForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        clearError(profileError);


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
            profileForm.querySelector("button");

        button.disabled = true;

        button.textContent =
            "Saving...";


        const {
            data,
            error
        } = await client

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


        button.disabled = false;

        button.textContent =
            "Continue";


        if (error) {

            console.error(
                "PROFILE UPDATE ERROR:",
                error
            );


            if (
                error.code === "23505"
            ) {

                showError(
                    profileError,
                    "That username is already taken."
                );

            } else {

                showError(
                    profileError,
                    error.message
                );
            }


            return;
        }


        currentProfile =
            data;


        await startChat();
    }
);


// ============================================================
// LOAD USERS
// ============================================================

async function loadUsers() {

    userList.innerHTML = `
        <div class="sidebar-empty">
            Loading users...
        </div>
    `;


    const {
        data,
        error
    } = await client

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


// ============================================================
// RENDER USERS
// ============================================================

function renderUsers(users) {

    userList.innerHTML = "";


    if (users.length === 0) {

        userList.innerHTML = `
            <div class="sidebar-empty">
                No users found.
            </div>
        `;

        return;
    }


    for (const user of users) {

        const element =
            document.createElement("button");


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


// ============================================================
// USER SEARCH
// ============================================================

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
                            ?.toLowerCase() || "";

                    const displayName =
                        user.display_name
                            ?.toLowerCase() || "";


                    return (
                        username.includes(query) ||
                        displayName.includes(query)
                    );
                }
            );


        renderUsers(
            filtered
        );
    }
);


// ============================================================
// GET INITIAL
// ============================================================

function getInitial(name) {

    if (!name) {
        return "?";
    }


    return name
        .trim()
        .charAt(0)
        .toUpperCase();
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

    const div =
        document.createElement("div");


    div.textContent =
        value ?? "";


    return div.innerHTML;
}


// ============================================================
// OPEN CONVERSATION
// ============================================================

async function openConversation(user) {

    if (!user) {
        return;
    }


    console.log(
        "Opening conversation with:",
        user
    );


    status.textContent =
        "Opening conversation...";


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


    const {
        data,
        error
    } = await client.rpc(
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


        status.textContent =
            "Conversation error";


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


    messageInput.disabled =
        false;


    messageForm
        .querySelector("button")
        .disabled = false;


    messageInput.placeholder =
        `Message ${user.display_name}...`;


    messageInput.focus();


    status.textContent =
        "Connected";
}


// ============================================================
// LOAD CONVERSATION MESSAGES
// ============================================================

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
    } = await client

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


    messages.innerHTML = "";


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


    for (const message of data) {

        addMessage(
            message
        );
    }
}


// ============================================================
// ADD MESSAGE
// ============================================================

function addMessage(message) {

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
        messages.querySelector(".empty");


    if (empty) {
        empty.remove();
    }


    const element =
        document.createElement("div");


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
        document.createElement("div");


    username.className =
        "username";


    username.textContent =
        message.profile?.display_name ||
        "User";


    const content =
        document.createElement("div");


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


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage(content) {

    if (
        !currentUser ||
        !currentConversationId
    ) {

        return false;
    }


    const {
        error
    } = await client

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


        status.textContent =
            "Send failed";


        return false;
    }


    return true;
}


// ============================================================
// MESSAGE FORM
// ============================================================

messageForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const content =
            messageInput.value.trim();


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


        button.disabled = true;


        const success =
            await sendMessage(
                content
            );


        if (success) {

            messageInput.value = "";

            messageInput.focus();
        }


        button.disabled = false;
    }
);


// ============================================================
// CONVERSATION REALTIME
// ============================================================

async function startConversationRealtime() {

    await stopRealtime();


    if (!currentConversationId) {
        return;
    }


    const channelName =
        `conversation:${currentConversationId}`;


    realtimeChannel =
        client
            .channel(channelName)

            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter:
                        `conversation_id=eq.${currentConversationId}`
                },

                async (payload) => {

                    console.log(
                        "CONVERSATION REALTIME:",
                        payload
                    );


                    if (
                        payload.new.conversation_id !==
                        currentConversationId
                    ) {

                        return;
                    }


                    const {
                        data: profile
                    } = await client

                        .from("profiles")

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
                (subscriptionStatus) => {

                    console.log(
                        "REALTIME STATUS:",
                        subscriptionStatus
                    );


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
            );
}


// ============================================================
// STOP REALTIME
// ============================================================

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


// ============================================================
// START CHAT
// ============================================================

async function startChat() {

    if (
        !currentUser ||
        !currentProfile
    ) {

        return;
    }


    currentUserElement.textContent =
        currentProfile.display_name;


    showChatScreen();


    await loadUsers();


    messages.innerHTML = `
        <div class="empty">
            Select a user to start a conversation.
        </div>
    `;


    messageInput.disabled =
        true;


    messageForm
        .querySelector("button")
        .disabled = true;


    await stopRealtime();


    status.textContent =
        "Ready";
}


// ============================================================
// LOGOUT
// ============================================================

logoutButton.addEventListener(
    "click",
    async () => {

        await stopRealtime();


        await client.auth.signOut();


        currentUser = null;

        currentProfile = null;

        currentConversationId = null;

        currentConversationUser = null;

        allUsers = [];

        displayedMessageIds.clear();


        messages.innerHTML = `
            <div class="empty">
                Select a user to start a conversation.
            </div>
        `;


        showLoginScreen();
    }
);


// ============================================================
// SESSION
// ============================================================

async function checkSession() {

    const {
        data,
        error
    } = await client.auth.getSession();


    if (error) {

        console.error(
            "SESSION ERROR:",
            error
        );


        showLoginScreen();

        return;
    }


    if (data.session) {

        currentUser =
            data.session.user;


        await initializeUser();

    } else {

        showLoginScreen();
    }
}


// ============================================================
// AUTH STATE
// ============================================================

client.auth.onAuthStateChange(
    async (
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


            await initializeUser();
        }


        if (!session) {

            currentUser = null;

            currentProfile = null;

            currentConversationId =
                null;

            currentConversationUser =
                null;


            await stopRealtime();


            showLoginScreen();
        }
    }
);


// ============================================================
// START
// ============================================================

checkSession();
