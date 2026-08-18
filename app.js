const SUPABASE_URL = "https://vkelkgabycpxojybguvj.supabase.co";
const SUPABASE_KEY = "sb_publishable_LntMHz6esPpIJszjXzzAzw_W-FVSljU";

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const form = document.getElementById("message-form");
const usernameInput = document.getElementById("username");
const messageInput = document.getElementById("message");
const messages = document.getElementById("messages");
const status = document.getElementById("status");


function addMessage(username, content) {

    const empty = messages.querySelector(".empty");

    if (empty) {
        empty.remove();
    }

    const message = document.createElement("div");
    message.className = "message";

    const usernameElement = document.createElement("div");
    usernameElement.className = "username";
    usernameElement.textContent = username;

    const contentElement = document.createElement("div");
    contentElement.className = "content";
    contentElement.textContent = content;

    message.appendChild(usernameElement);
    message.appendChild(contentElement);

    messages.appendChild(message);

    messages.scrollTop = messages.scrollHeight;
}


async function loadMessages() {

    const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", {
            ascending: true
        });

    if (error) {
        console.error(error);
        status.textContent = "Database error";
        return;
    }

    messages.innerHTML = "";

    for (const message of data) {
        addMessage(
            message.username,
            message.content
        );
    }
}


async function sendMessage(username, content) {

    const { error } = await supabase
        .from("messages")
        .insert({
            username: username,
            content: content
        });

    if (error) {
        console.error(error);
        alert("Failed to send message.");
    }
}


form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const username = usernameInput.value.trim();
    const content = messageInput.value.trim();

    if (!username || !content) {
        return;
    }

    messageInput.value = "";

    await sendMessage(username, content);

    messageInput.focus();
});


supabase
    .channel("messages")
    .on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "messages"
        },
        (payload) => {

            const message = payload.new;

            addMessage(
                message.username,
                message.content
            );
        }
    )
    .subscribe((statusValue) => {

        console.log("Realtime:", statusValue);

        if (statusValue === "SUBSCRIBED") {
            status.textContent = "Connected";
        }
    });


loadMessages();
