const BACKEND_URL =
    "https://codeai-backend-0y6t.onrender.com";


// ============================================================
// USER ID
// ============================================================

let userId = localStorage.getItem("codeai_user_id");

if (!userId) {
    userId =
        crypto.randomUUID?.() ||
        "user-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2);

    localStorage.setItem("codeai_user_id", userId);
}


// ============================================================
// STATE
// ============================================================

let chats =
    JSON.parse(localStorage.getItem("codeai_chats") || "{}");

let currentChatId =
    localStorage.getItem("codeai_current_chat");

let attachedFiles = [];

let mediaRecorder = null;
let audioChunks = [];
let cameraStream = null;


// ============================================================
// ELEMENTS
// ============================================================

const messages = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");
const statusText = document.getElementById("statusText");
const attachments = document.getElementById("attachments");
const chatList = document.getElementById("chatList");
const searchInput = document.getElementById("chatSearch");


// ============================================================
// STORAGE
// ============================================================

function saveChats() {
    localStorage.setItem(
        "codeai_chats",
        JSON.stringify(chats)
    );
}

function saveCurrentChat() {
    if (currentChatId) {
        localStorage.setItem(
            "codeai_current_chat",
            currentChatId
        );
    }
}


// ============================================================
// CHAT CREATION
// ============================================================

function createChat() {

    const id =
        "chat-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2);

    chats[id] = {
        title: "New Chat",
        messages: []
    };

    currentChatId = id;

    saveChats();
    saveCurrentChat();

    renderChatList();
    renderCurrentChat();
}


function ensureChat() {

    if (!currentChatId || !chats[currentChatId]) {
        createChat();
    }
}


// ============================================================
// CHAT LIST
// ============================================================

function renderChatList(filter = "") {

    chatList.innerHTML = "";

    const search = filter.toLowerCase();

    Object.entries(chats)
        .reverse()
        .filter(([_, chat]) =>
            chat.title.toLowerCase().includes(search)
        )
        .forEach(([id, chat]) => {

            const item =
                document.createElement("div");

            item.className =
                "chat-item" +
                (id === currentChatId ? " active" : "");

            item.textContent = chat.title || "New Chat";

            item.onclick = () => {
                currentChatId = id;
                saveCurrentChat();
                renderChatList(searchInput.value);
                renderCurrentChat();
            };

            item.oncontextmenu = (event) => {

                event.preventDefault();

                const newName =
                    prompt(
                        "Rename chat:",
                        chat.title
                    );

                if (newName && newName.trim()) {
                    chat.title = newName.trim();
                    saveChats();
                    renderChatList(searchInput.value);
                }
            };

            item.ondblclick = () => {

                if (
                    confirm(
                        "Delete this chat?"
                    )
                ) {
                    delete chats[id];

                    if (currentChatId === id) {
                        currentChatId = null;
                    }

                    saveChats();

                    ensureChat();
                    renderChatList();
                    renderCurrentChat();
                }
            };

            chatList.appendChild(item);
        });
}


// ============================================================
// RENDER CHAT
// ============================================================

function renderCurrentChat() {

    messages.innerHTML = "";

    const chat =
        chats[currentChatId];

    if (!chat || !chat.messages.length) {
        welcome.style.display = "block";
        return;
    }

    welcome.style.display = "none";

    chat.messages.forEach(message => {

        addMessageToUI(
            message.role,
            message.content,
            false
        );
    });
}


// ============================================================
// MESSAGE UI
// ============================================================

function escapeHTML(value) {

    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}


function formatMessage(text) {

    let escaped =
        escapeHTML(text);

    escaped =
        escaped.replace(
            /```([\s\S]*?)```/g,
            (_, code) => {

                const clean =
                    code.trim();

                return `
                    <pre><code>${clean}</code></pre>
                    <button class="copy-code"
                        data-code="${encodeURIComponent(clean)}">
                        Copy
                    </button>
                `;
            }
        );

    escaped =
        escaped.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

    escaped =
        escaped.replace(
            /\n/g,
            "<br>"
        );

    return escaped;
}


function addMessageToUI(
    role,
    content,
    scroll = true
) {

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "message " + role;

    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";

    bubble.innerHTML =
        formatMessage(content);

    wrapper.appendChild(bubble);

    messages.appendChild(wrapper);

    if (scroll) {
        messages.scrollTop =
            messages.scrollHeight;
    }
}


// ============================================================
// SAVE MESSAGE
// ============================================================

function saveMessage(role, content) {

    ensureChat();

    chats[currentChatId].messages.push({
        role,
        content
    });

    if (
        role === "user" &&
        chats[currentChatId].title === "New Chat"
    ) {
        chats[currentChatId].title =
            content.slice(0, 35) +
            (content.length > 35 ? "..." : "");
    }

    saveChats();
    renderChatList();
}


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage() {

    const text =
        input.value.trim();

    if (!text && !attachedFiles.length) {
        return;
    }

    ensureChat();

    let finalMessage = text;

    // Read attached files first
    if (attachedFiles.length) {

        setStatus("READING");

        const fileContext =
            await readAttachedFiles();

        if (fileContext) {

            finalMessage +=
                "\n\n--- ATTACHED FILE CONTEXT ---\n" +
                fileContext +
                "\n--- END ATTACHED FILE CONTEXT ---";
        }
    }

    if (!finalMessage.trim()) {
        return;
    }

    // Display only what user typed
    const visibleUserMessage =
        text ||
        "Analyze the attached file(s).";

    saveMessage(
        "user",
        visibleUserMessage
    );

    addMessageToUI(
        "user",
        visibleUserMessage
    );

    input.value = "";
    input.style.height = "auto";

    clearAttachments();

    setStatus("THINKING");

    try {

        const history =
            chats[currentChatId]
                .messages
                .slice(-20);

        const response =
            await fetch(
                `${BACKEND_URL}/chat`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        user_id: userId,
                        message: finalMessage,
                        history
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail ||
                "Request failed."
            );
        }

        if (!data.success) {
            throw new Error(
                data.reply ||
                "AI request failed."
            );
        }

        saveMessage(
            "assistant",
            data.reply
        );

        addMessageToUI(
            "assistant",
            data.reply
        );

    } catch (error) {

        const errorText =
            "CodeAI error: " +
            error.message;

        saveMessage(
            "assistant",
            errorText
        );

        addMessageToUI(
            "assistant",
            errorText
        );

    } finally {

        setStatus("");
    }
}


// ============================================================
// STATUS
// ============================================================

function setStatus(text) {
    statusText.textContent = text;
}


// ============================================================
// FILE READING
// ============================================================

async function readAttachedFiles() {

    const form =
        new FormData();

    attachedFiles.forEach(file => {
        form.append("files", file);
    });

    try {

        const response =
            await fetch(
                `${BACKEND_URL}/read-files`,
                {
                    method: "POST",
                    body: form
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail ||
                "Could not read files."
            );
        }

        return data.files
            .map(file => {

                return (
                    `FILE: ${file.filename}\n` +
                    file.content
                );
            })
            .join("\n\n")
            .slice(0, 70000);

    } catch (error) {

        addMessageToUI(
            "assistant",
            "File error: " +
            error.message
        );

        return "";
    }
}


function addAttachments(files) {

    for (const file of files) {
        attachedFiles.push(file);
    }

    renderAttachments();
}


function renderAttachments() {

    attachments.innerHTML = "";

    attachedFiles.forEach(
        (file, index) => {

            const item =
                document.createElement("div");

            item.className =
                "attachment";

            item.textContent =
                file.name;

            item.onclick = () => {

                attachedFiles.splice(
                    index,
                    1
                );

                renderAttachments();
            };

            attachments.appendChild(item);
        }
    );
}


function clearAttachments() {

    attachedFiles = [];
    renderAttachments();

    document.getElementById(
        "fileInput"
    ).value = "";

    document.getElementById(
        "folderInput"
    ).value = "";
}


// ============================================================
// VOICE
// ============================================================

async function toggleVoice() {

    if (
        mediaRecorder &&
        mediaRecorder.state === "recording"
    ) {
        mediaRecorder.stop();
        return;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        alert(
            "Your browser does not support microphone recording."
        );
        return;
    }

    try {

        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });

        audioChunks = [];

        mediaRecorder =
            new MediaRecorder(stream);

        mediaRecorder.ondataavailable =
            event => {

                if (event.data.size > 0) {
                    audioChunks.push(
                        event.data
                    );
                }
            };

        mediaRecorder.onstop =
            async () => {

                stream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );

                voiceBtn.classList.remove(
                    "listening"
                );

                setStatus("THINKING");

                const audioBlob =
                    new Blob(
                        audioChunks,
                        {
                            type:
                                mediaRecorder.mimeType ||
                                "audio/webm"
                        }
                    );

                const form =
                    new FormData();

                form.append(
                    "file",
                    audioBlob,
                    "voice.webm"
                );

                try {

                    const response =
                        await fetch(
                            `${BACKEND_URL}/transcribe`,
                            {
                                method: "POST",
                                body: form
                            }
                        );

                    const data =
                        await response.json();

                    if (
                        !data.success
                    ) {
                        throw new Error(
                            data.error ||
                            "Voice transcription failed."
                        );
                    }

                    input.value =
                        data.text || "";

                    input.style.height =
                        "auto";

                    input.style.height =
                        Math.min(
                            input.scrollHeight,
                            160
                        ) + "px";

                    if (data.text) {
                        await sendMessage();
                    }

                } catch (error) {

                    addMessageToUI(
                        "assistant",
                        "Voice error: " +
                        error.message
                    );

                } finally {

                    setStatus("");
                    audioChunks = [];
                    mediaRecorder = null;
                }
            };

        mediaRecorder.start();

        voiceBtn.classList.add(
            "listening"
        );

        setStatus("LISTENING");

    } catch (error) {

        alert(
            "Microphone permission was not granted."
        );
    }
}


// ============================================================
// CAMERA
// ============================================================

async function openCamera() {

    const modal =
        document.getElementById(
            "cameraModal"
        );

    const video =
        document.getElementById(
            "cameraVideo"
        );

    try {

        cameraStream =
            await navigator.mediaDevices
                .getUserMedia({
                    video: true
                });

        video.srcObject =
            cameraStream;

        modal.classList.remove(
            "hidden"
        );

    } catch (error) {

        alert(
            "Camera permission was not granted."
        );
    }
}


function closeCamera() {

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        cameraStream = null;
    }

    document
        .getElementById("cameraVideo")
        .srcObject = null;

    document
        .getElementById("cameraModal")
        .classList.add("hidden");
}


async function captureCamera() {

    const video =
        document.getElementById(
            "cameraVideo"
        );

    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width =
        video.videoWidth;

    canvas.height =
        video.videoHeight;

    const context =
        canvas.getContext("2d");

    context.drawImage(
        video,
        0,
        0
    );

    const blob =
        await new Promise(
            resolve =>
                canvas.toBlob(
                    resolve,
                    "image/jpeg",
                    0.9
                )
        );

    closeCamera();

    setStatus("THINKING");

    const form =
        new FormData();

    form.append(
        "file",
        blob,
        "camera.jpg"
    );

    try {

        const response =
            await fetch(
                `${BACKEND_URL}/vision`,
                {
                    method: "POST",
                    body: form
                }
            );

        const data =
            await response.json();

        if (!data.success) {
            throw new Error(
                data.reply ||
                "Vision failed."
            );
        }

        saveMessage(
            "assistant",
            data.reply
        );

        addMessageToUI(
            "assistant",
            data.reply
        );

    } catch (error) {

        addMessageToUI(
            "assistant",
            "Vision error: " +
            error.message
        );

    } finally {

        setStatus("");
    }
}


// ============================================================
// PDF
// ============================================================

async function createPDF() {

    const title =
        document.getElementById(
            "pdfTitle"
        ).value.trim();

    const content =
        document.getElementById(
            "pdfContent"
        ).value.trim();

    if (!title || !content) {

        alert(
            "Enter a title and content first."
        );

        return;
    }

    setStatus("CREATING PDF");

    try {

        const response =
            await fetch(
                `${BACKEND_URL}/create-pdf`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        user_id: userId,
                        title,
                        content
                    })
                }
            );

        if (!response.ok) {

            const data =
                await response.json();

            throw new Error(
                data.detail ||
                "PDF creation failed."
            );
        }

        const blob =
            await response.blob();

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;
        link.download =
            "CodeAI.pdf";

        link.click();

        URL.revokeObjectURL(url);

    } catch (error) {

        alert(
            "PDF error: " +
            error.message
        );

    } finally {

        setStatus("");
    }
}


// ============================================================
// SUBSCRIPTION
// ============================================================

async function checkSubscription() {

    try {

        const response =
            await fetch(
                `${BACKEND_URL}/subscription/status`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        user_id: userId
                    })
                }
            );

        const data =
            await response.json();

        const badge =
            document.getElementById(
                "planBadge"
            );

        if (
            data.active &&
            data.plan === "master"
        ) {

            badge.textContent =
                "MASTER";

        } else {

            badge.textContent =
                "FREE";
        }

    } catch {

        document.getElementById(
            "planBadge"
        ).textContent =
            "FREE";
    }
}


// ============================================================
// EVENTS
// ============================================================

document
    .getElementById("newChatBtn")
    .onclick = createChat;

document
    .getElementById("sendBtn")
    .onclick = sendMessage;

voiceBtn.onclick =
    toggleVoice;

document
    .getElementById("fileBtn")
    .onclick = () => {

        document
            .getElementById("fileInput")
            .click();
    };

document
    .getElementById("folderBtn")
    .onclick = () => {

        document
            .getElementById("folderInput")
            .click();
    };

document
    .getElementById("cameraBtn")
    .onclick = openCamera;

document
    .getElementById("captureBtn")
    .onclick = captureCamera;

document
    .getElementById("pdfBtn")
    .onclick = () => {

        document
            .getElementById("pdfModal")
            .classList.remove("hidden");
    };

document
    .getElementById("createPdfBtn")
    .onclick = createPDF;

document
    .getElementById("masterBtn")
    .onclick = () => {

        document
            .getElementById("masterModal")
            .classList.remove("hidden");
    };

document
    .getElementById("settingsBtn")
    .onclick = () => {

        document
            .getElementById("settingsModal")
            .classList.remove("hidden");
    };

document
    .getElementById("mobileMenu")
    .onclick = () => {

        document
            .getElementById("sidebar")
            .classList.toggle("open");
    };

document
    .getElementById("fileInput")
    .onchange = event => {

        addAttachments(
            Array.from(
                event.target.files
            )
        );
    };

document
    .getElementById("folderInput")
    .onchange = event => {

        addAttachments(
            Array.from(
                event.target.files
            )
        );
    };

searchInput.oninput =
    () => {

        renderChatList(
            searchInput.value
        );
    };

input.addEventListener(
    "input",
    () => {

        input.style.height =
            "auto";

        input.style.height =
            Math.min(
                input.scrollHeight,
                160
            ) + "px";
    }
);

input.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();
        }
    }
);


// Suggestion buttons

document
    .querySelectorAll(
        ".suggestions button"
    )
    .forEach(button => {

        button.className =
            "suggestion";

        button.onclick = () => {

            input.value =
                button.dataset.prompt;

            sendMessage();
        };
    });


// Modal close buttons

document
    .querySelectorAll(
        "[data-close]"
    )
    .forEach(button => {

        button.onclick = () => {

            const id =
                button.dataset.close;

            document
                .getElementById(id)
                .classList.add("hidden");

            if (
                id === "cameraModal"
            ) {
                closeCamera();
            }
        };
    });


// Copy code

document.addEventListener(
    "click",
    event => {

        if (
            event.target.classList.contains(
                "copy-code"
            )
        ) {

            const code =
                decodeURIComponent(
                    event.target.dataset.code
                );

            navigator.clipboard.writeText(
                code
            );

            event.target.textContent =
                "Copied";
        }
    }
);


// Clear chats

document
    .getElementById("clearChatsBtn")
    .onclick = () => {

        if (
            confirm(
                "Delete all local chats?"
            )
        ) {

            localStorage.removeItem(
                "codeai_chats"
            );

            localStorage.removeItem(
                "codeai_current_chat"
            );

            chats = {};
            currentChatId = null;

            ensureChat();
            renderChatList();
            renderCurrentChat();
        }
    };


// Payment placeholder

document
    .getElementById("subscribeBtn")
    .onclick = async () => {

        const message =
            document.getElementById(
                "paymentMessage"
            );

        message.textContent =
            "Payment isn't connected yet. Please buy Master when the payment gateway is enabled.";
    };


// ============================================================
// START
// ============================================================

document.getElementById(
    "userIdDisplay"
).textContent = userId;

if (!Object.keys(chats).length) {
    createChat();
} else {
    if (!currentChatId ||
        !chats[currentChatId]) {

        currentChatId =
            Object.keys(chats)[0];

        saveCurrentChat();
    }

    renderChatList();
    renderCurrentChat();
}

checkSubscription();