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

let realtimeChannel = null;


// Keep track of messages we've already displayed.
// This prevents duplicates from realtime events.
const displayedMessageIds = new Set();


// ============================================================
// DOM
// ============================================================

const authScreen =
    document.getElementById("auth-screen");

const registerScreen =
    document.getElementById("register-screen");

const profileScreen =
    document.getElementById("profile-screen");

const chatScreen =
    document.getElementById("chat-screen");


const loginForm =
    document.getElementById("login-form");

const registerForm =
    document.getElementById("register-form");

const profileForm =
    document.getElementById("profile-form");


const showRegister =
    document.getElementById("show-register");

const showLogin =
    document.getElementById("show-login");


const loginEmail =
    document.getElementById("login-email");

const loginPassword =
    document.getElementById("login-password");


const registerEmail =
    document.getElementById("register-email");

const registerPassword =
    document.getElementById("register-password");

const registerPasswordConfirm =
    document.getElementById(
        "register-password-confirm"
    );


const profileUsername =
    document.getElementById(
        "profile-username"
    );

const profileDisplayName =
    document.getElementById(
        "profile-display-name"
    );


const authError =
    document.getElementById("auth-error");

const registerError =
    document.getElementById("register-error");

const profileError =
    document.getElementById("profile-error");


const status =
    document.getElementById("status");

const currentUserElement =
    document.getElementById("current-user");

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

    authScreen.classList.add("hidden");

    registerScreen.classList.add("hidden");

    profileScreen.classList.add("hidden");

    chatScreen.classList.add("hidden");
}


function showLoginScreen() {

    hideAllScreens();

    authScreen.classList.remove("hidden");
}


function showRegisterScreen() {

    hideAllScreens();

    registerScreen.classList.remove("hidden");
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

    element.textContent = message;

    element.style.display = "block";
}


function clearError(element) {

    element.textContent = "";

    element.style.display = "none";
}


// ============================================================
// LOGIN
// ============================================================

loginForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        clearError(authError);


        const email =
            loginEmail.value.trim();

        const password =
            loginPassword.value;


        const {
            data,
            error
        } = await client.auth.signInWithPassword({

            email,

            password
        });


        if (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            showError(
                authError,
                error.message
            );

            return;
        }


        currentUser =
            data.user;


        await initializeUser();
    }
);


// ============================================================
// REGISTER
// ============================================================

registerForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        clearError(registerError);


        const email =
            registerEmail.value.trim();

        const password =
            registerPassword.value;

        const confirmation =
            registerPasswordConfirm.value;


        if (password !== confirmation) {

            showError(
                registerError,
                "Passwords do not match."
            );

            return;
        }


        if (password.length < 6) {

            showError(
                registerError,
                "Password must be at least 6 characters."
            );

            return;
        }


        const {
            data,
            error
        } = await client.auth.signUp({

            email,

            password
        });


        if (error) {

            console.error(
                "REGISTER ERROR:",
                error
            );

            showError(
                registerError,
                error.message
            );

            return;
        }


        if (!data.user) {

            showError(
                registerError,
                "Account created. Check your email to continue."
            );

            return;
        }


        currentUser =
            data.user;


        await initializeUser();
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


    currentProfile =
        await loadProfile();


    if (!currentProfile) {

        showProfileScreen();

        profileUsername.focus();

        return;
    }


    /*
     * The trigger creates a temporary profile:
     *
     * username:     user_XXXXXXXX
     * display_name: New User
     *
     * If that's still present, send the user to
     * profile setup.
     */

    if (
        currentProfile.display_name ===
        "New User"
    ) {

        showProfileScreen();

        profileUsername.value =
            currentProfile.username;

        profileDisplayName.value = "";

        profileUsername.focus();

        return;
    }


    await startChat();
}


// ============================================================
// CREATE / UPDATE PROFILE
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


        // ----------------------------------------------------
        // Username validation
        // ----------------------------------------------------

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


        // ----------------------------------------------------
        // Update automatically-created profile
        // ----------------------------------------------------

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


        if (error) {

            console.error(
                "PROFILE UPDATE ERROR:",
                error
            );


            if (
                error.code ===
                "23505"
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
// SWITCH LOGIN / REGISTER
// ============================================================

showRegister.addEventListener(
    "click",
    () => {

        clearError(authError);

        showRegisterScreen();
    }
);


showLogin.addEventListener(
    "click",
    () => {

        clearError(registerError);

        showLoginScreen();
    }
);


// ============================================================
// MESSAGE UI
// ============================================================

function addMessage(message) {

    // Don't display the same message twice.

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

        element.classList.add("own");
    }


    const username =
        document.createElement("div");

    username.className =
        "username";


    username.textContent =
        message.profile?.display_name ||
        message.profile?.username ||
        message.username ||
        "User";


    const content =
        document.createElement("div");

    content.className =
        "content";


    content.textContent =
        message.content;


    element.appendChild(username);

    element.appendChild(content);

    messages.appendChild(element);


    messages.scrollTop =
        messages.scrollHeight;
}


// ============================================================
// LOAD MESSAGES
// ============================================================

async function loadMessages() {

    console.log(
        "Loading messages..."
    );


    displayedMessageIds.clear();


    const {
        data,
        error
    } = await client

        .from("messages")

        .select(`
            id,
            user_id,
            content,
            created_at,
            username,
            profile:profiles (
                username,
                display_name
            )
        `)

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

        status.textContent =
            "Database error";

        return;
    }


    messages.innerHTML = "";


    if (
        !data ||
        data.length === 0
    ) {

        messages.innerHTML = `
            <div class="empty">
                No messages yet.
            </div>
        `;

        return;
    }


    for (
        const message of data
    ) {

        addMessage(message);
    }
}


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage(content) {

    if (!currentUser) {
        return false;
    }


    const {
        error
    } = await client

        .from("messages")

        .insert({

            user_id:
                currentUser.id,

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


        if (!content) {
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
// REALTIME
// ============================================================

async function startRealtime() {

    await stopRealtime();


    realtimeChannel =
        client

        .channel(
            "messages-channel"
        )

        .on(

            "postgres_changes",

            {

                event: "INSERT",

                schema: "public",

                table: "messages"

            },

            async (payload) => {

                console.log(
                    "REALTIME EVENT:",
                    payload
                );


                /*
                 * Fetch the profile belonging to the
                 * sender of this message.
                 */

                const {
                    data: profile,
                    error
                } = await client

                    .from("profiles")

                    .select(
                        "username, display_name"
                    )

                    .eq(
                        "id",
                        payload.new.user_id
                    )

                    .single();


                if (error) {

                    console.error(
                        "REALTIME PROFILE ERROR:",
                        error
                    );
                }


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


    realtimeChannel = null;
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


    await loadMessages();

    await startRealtime();


    messageInput.focus();
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


        displayedMessageIds.clear();


        messages.innerHTML = `
            <div class="empty">
                No messages yet.
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

            await stopRealtime();

            showLoginScreen();
        }
    }
);


// ============================================================
// START
// ============================================================

checkSession();
