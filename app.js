// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

const SUPABASE_URL = "https://vkelkgabycpxojybguvj.supabase.co";
const SUPABASE_KEY = "sb_publishable_LntMHz6esPpIJszjXzzAzw_W-FVSljU";


// ============================================================
// SUPABASE CLIENT
// ============================================================

const client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ============================================================
// DOM ELEMENTS
// ============================================================

const form = document.getElementById("message-form");

const usernameInput =
    document.getElementById("username");

const messageInput =
    document.getElementById("message");

const messages =
    document.getElementById("messages");

const status =
    document.getElementById("status");


// ============================================================
// UI
// ============================================================

function setStatus(text) {
    status.textContent = text;
}


function clearEmptyMessage() {

    const empty =
        messages.querySelector(".empty");

    if (empty) {
        empty.remove();
    }
}


function addMessage(username, content) {

    clearEmptyMessage();

    const message =
        document.createElement("div");

    message.className = "message";


    const usernameElement =
        document.createElement("div");

    usernameElement.className = "username";

    usernameElement.textContent = username;


    const contentElement =
        document.createElement("div");

    contentElement.className = "content";

    contentElement.textContent = content;


    message.appendChild(usernameElement);
    message.appendChild(contentElement);

    messages.appendChild(message);


    // Scroll to bottom

    messages.scrollTop =
        messages.scrollHeight;
}


// ============================================================
// LOAD EXISTING MESSAGES
// ============================================================

async function loadMessages() {

    console.log("Loading messages...");

    const { data, error } = await client
        .from("messages")
        .select("*")
        .order("created_at", {
            ascending: true
        });


    if (error) {

        console.error(
            "LOAD ERROR:",
            error
        );

        setStatus("Database error");

        messages.innerHTML = `
            <div class="empty">
                Failed to load messages.
                Check the browser console.
            </div>
        `;

        return;
    }


    messages.innerHTML = "";


    if (!data || data.length === 0) {

        messages.innerHTML = `
            <div class="empty">
                No messages yet.
            </div>
        `;

        return;
    }


    for (const message of data) {

        addMessage(
            message.username,
            message.content
        );
    }
}


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage(username, content) {

    console.log(
        "Sending message:",
        username,
        content
    );


    const { data, error } = await client
        .from("messages")
        .insert({
            username: username,
            content: content
        })
        .select();


    if (error) {

        console.error(
            "SEND ERROR:",
            error
        );

        setStatus("Send failed");

        return false;
    }


    console.log(
        "Message inserted:",
        data
    );


    return true;
}


// ============================================================
// FORM SUBMISSION
// ============================================================

form.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const username =
            usernameInput.value.trim();

        const content =
            messageInput.value.trim();


        if (!username || !content) {
            return;
        }


        // Disable button while sending

        const button =
            form.querySelector("button");

        button.disabled = true;


        const success =
            await sendMessage(
                username,
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

console.log(
    "Starting Supabase realtime..."
);


const channel = client
    .channel("messages-channel")

    .on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "messages"
        },

        (payload) => {

            console.log(
                "REALTIME EVENT:",
                payload
            );


            const message =
                payload.new;


            addMessage(
                message.username,
                message.content
            );
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

                setStatus("Connected");

            } else {

                setStatus(
                    subscriptionStatus
                );
            }
        }
    );


// ============================================================
// START APPLICATION
// ============================================================

loadMessages();
