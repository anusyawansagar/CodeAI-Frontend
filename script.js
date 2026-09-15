"use strict";

/* =========================================================
   CODEAI FRONTEND
   FINAL AUTH + CHAT + THINKING
   ========================================================= */

const BACKEND_URL = "https://codeai-backend-0y6t.onrender.com";

/* =========================================================
   GLOBAL STATE
   ========================================================= */

let currentUser = null;
let isGuest = false;

let chatHistory = [];
let currentChatId = null;

let selectedFile = null;
let selectedImage = null;

let isSending = false;
let authResolved = false;

/* =========================================================
   ELEMENTS
   ========================================================= */

const gateway = document.getElementById("accountGateway");
const app = document.getElementById("app");

const googleLoginBtn = document.getElementById("googleLoginBtn");
const guestBtn = document.getElementById("guestBtn");
const signOutBtn = document.getElementById("signOutBtn");

const accountName = document.getElementById("accountName");
const accountType = document.getElementById("accountType");
const accountAvatar = document.getElementById("accountAvatar");

const messages = document.getElementById("messages");
const welcome = document.getElementById("welcome");

const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");

const attachBtn = document.getElementById("attachBtn");
const cameraBtn = document.getElementById("cameraBtn");
const micBtn = document.getElementById("micBtn");

const fileInput = document.getElementById("fileInput");
const cameraInput = document.getElementById("cameraInput");
const imageInput = document.getElementById("imageInput");

const attachmentPreview =
    document.getElementById("attachmentPreview");

const attachmentName =
    document.getElementById("attachmentName");

const attachmentType =
    document.getElementById("attachmentType");

const removeAttachmentBtn =
    document.getElementById("removeAttachmentBtn");

const languageSelect =
    document.getElementById("languageSelect");

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

const aboutBtn = document.getElementById("aboutBtn");

/* =========================================================
   ACCOUNT GATEWAY
   ========================================================= */

function showGateway() {
    if (gateway) gateway.classList.remove("hidden");
    if (app) app.classList.add("hidden");

    document.body.classList.add("gateway-active");
}

function showApp() {
    if (!authResolved) return;

    if (gateway) gateway.classList.add("hidden");
    if (app) app.classList.remove("hidden");

    document.body.classList.remove("gateway-active");

    setTimeout(() => {
        if (messageInput) messageInput.focus();
    }, 100);
}

/* =========================================================
   IMPORTANT:
   SHOW LOGIN BEFORE FIREBASE FINISHES CHECKING
   ========================================================= */

showGateway();

/* =========================================================
   GOOGLE LOGIN
   ========================================================= */

if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", async () => {
        try {
            googleLoginBtn.disabled = true;
            googleLoginBtn.textContent = "Opening Google...";

            await firebaseAuth.signInWithPopup(googleProvider);

        } catch (error) {
            console.error("Google login error:", error);

            let message = "Google login failed.";

            if (error && error.code) {
                if (error.code === "auth/unauthorized-domain") {
                    message =
                        "This website domain is not authorized in Firebase.\n\n" +
                        "Add your Vercel domain in:\n" +
                        "Firebase → Authentication → Settings → Authorized domains";
                } else if (error.code === "auth/popup-blocked") {
                    message =
                        "Google popup was blocked by the browser. Please allow popups for CodeAI.";
                } else if (error.code === "auth/popup-closed-by-user") {
                    message = "Google login window was closed.";
                } else {
                    message =
                        "Google login failed.\n\n" +
                        error.message;
                }
            }

            alert(message);

            googleLoginBtn.disabled = false;
            googleLoginBtn.innerHTML =
                "<span>G</span> Continue with Google";
        }
    });
}

/* =========================================================
   GUEST LOGIN
   ========================================================= */

if (guestBtn) {
    guestBtn.addEventListener("click", () => {
        currentUser = null;
        isGuest = true;
        authResolved = true;

        localStorage.setItem("codeai_guest", "true");

        setupAccountUI();
        showApp();
        loadGuestChat();
    });
}

/* =========================================================
   FIREBASE AUTH
   ========================================================= */

firebaseAuth.onAuthStateChanged(async (user) => {

    /*
       Firebase is now giving us the real account state.
    */

    if (user) {
        currentUser = user;
        isGuest = false;

        localStorage.removeItem("codeai_guest");

        setupAccountUI();

        authResolved = true;
        showApp();

        await loadCloudChat();

    } else {

        const guest =
            localStorage.getItem("codeai_guest");

        if (guest === "true") {

            currentUser = null;
            isGuest = true;

            setupAccountUI();

            authResolved = true;
            showApp();

            loadGuestChat();

        } else {

            currentUser = null;
            isGuest = false;

            authResolved = true;

            /*
               NO LOGIN = NO CHAT APP
            */
            showGateway();
        }
    }
});

/* =========================================================
   ACCOUNT UI
   ========================================================= */

function setupAccountUI() {

    if (!accountName || !accountType || !accountAvatar) {
        return;
    }

    if (currentUser) {

        const name =
            currentUser.displayName ||
            currentUser.email ||
            "Google User";

        accountName.textContent = name;
        accountType.textContent = "Google • Cloud chats";

        accountAvatar.textContent =
            name.charAt(0).toUpperCase();

        /*
           Use Google profile image when available.
        */
        if (currentUser.photoURL) {
            accountAvatar.style.backgroundImage =
                `url("${currentUser.photoURL}")`;

            accountAvatar.style.backgroundSize = "cover";
            accountAvatar.style.backgroundPosition = "center";
            accountAvatar.textContent = "";
        }

    } else {

        accountName.textContent = "Guest";
        accountType.textContent = "Guest • Local only";
        accountAvatar.textContent = "G";

        accountAvatar.style.backgroundImage = "";
    }
}

/* =========================================================
   SIGN OUT
   ========================================================= */

if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {

        try {

            if (currentUser) {

                await firebaseAuth.signOut();

            } else {

                localStorage.removeItem("codeai_guest");

                currentUser = null;
                isGuest = false;
                authResolved = true;

                chatHistory = [];
                currentChatId = null;

                showGateway();
            }

        } catch (error) {

            console.error("Sign out error:", error);

            alert("Could not sign out.");
        }
    });
}

/* =========================================================
   GUEST CHAT
   ========================================================= */

function loadGuestChat() {

    currentChatId = "guest";

    const saved =
        localStorage.getItem("codeai_guest_chat");

    if (saved) {

        try {

            const parsed = JSON.parse(saved);

            chatHistory =
                Array.isArray(parsed)
                    ? parsed
                    : [];

        } catch {

            chatHistory = [];
        }

    } else {

        chatHistory = [];
    }

    renderHistory();
}

function saveGuestChat() {

    try {

        localStorage.setItem(
            "codeai_guest_chat",
            JSON.stringify(chatHistory)
        );

    } catch (error) {

        console.error(
            "Guest save error:",
            error
        );
    }
}

/* =========================================================
   CLOUD CHAT
   ========================================================= */

async function loadCloudChat() {

    if (!currentUser) return;

    try {

        const userChats =
            firebaseDB
                .collection("users")
                .doc(currentUser.uid)
                .collection("chats");

        const snapshot =
            await userChats
                .orderBy("updatedAt", "desc")
                .limit(1)
                .get();

        if (snapshot.empty) {

            chatHistory = [];

            currentChatId =
                userChats.doc().id;

        } else {

            const doc = snapshot.docs[0];
            const data = doc.data();

            currentChatId = doc.id;

            chatHistory =
                Array.isArray(data.messages)
                    ? data.messages.filter(isValidMessage)
                    : [];
        }

        renderHistory();

    } catch (error) {

        console.error(
            "Cloud chat error:",
            error
        );

        chatHistory = [];

        renderHistory();
    }
}

async function saveCloudChat() {

    if (!currentUser) return;

    const userChats =
        firebaseDB
            .collection("users")
            .doc(currentUser.uid)
            .collection("chats");

    if (!currentChatId) {
        currentChatId =
            userChats.doc().id;
    }

    try {

        await userChats
            .doc(currentChatId)
            .set(
                {
                    messages: getCleanHistory(),
                    title: createChatTitle(),
                    updatedAt:
                        firebase.firestore.FieldValue.serverTimestamp()
                },
                {
                    merge: true
                }
            );

    } catch (error) {

        console.error(
            "Cloud save error:",
            error
        );
    }
}

/* =========================================================
   CHAT TITLE
   ========================================================= */

function createChatTitle() {

    const firstUserMessage =
        chatHistory.find(
            item =>
                item &&
                item.role === "user" &&
                typeof item.content === "string"
        );

    if (!firstUserMessage) {
        return "New Chat";
    }

    return String(firstUserMessage.content)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60) || "New Chat";
}

/* =========================================================
   MESSAGE VALIDATION
   ========================================================= */

function isValidMessage(item) {

    return (
        item &&
        (
            item.role === "user" ||
            item.role === "assistant"
        ) &&
        typeof item.content === "string"
    );
}

/* =========================================================
   RENDER HISTORY
   ========================================================= */

function renderHistory() {

    if (!messages) return;

    messages.innerHTML = "";

    const validHistory =
        Array.isArray(chatHistory)
            ? chatHistory.filter(isValidMessage)
            : [];

    if (validHistory.length === 0) {

        if (welcome) {
            welcome.classList.remove("hidden");
        }

        return;
    }

    if (welcome) {
        welcome.classList.add("hidden");
    }

    for (const item of validHistory) {

        addMessageToUI(
            item.role === "user"
                ? "user"
                : "ai",
            item.content
        );
    }

    scrollToBottom();
}

/* =========================================================
   UI MESSAGE
   ========================================================= */

function addMessageToUI(type, content) {

    const safeContent =
        typeof content === "string"
            ? content
            : String(content ?? "");

    const row =
        document.createElement("div");

    row.className =
        `message-row ${type}`;

    const avatar =
        document.createElement("div");

    avatar.className =
        "message-avatar";

    avatar.textContent =
        type === "user"
            ? "Y"
            : "C";

    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";

    bubble.innerHTML =
        formatAIText(safeContent);

    row.appendChild(avatar);
    row.appendChild(bubble);

    messages.appendChild(row);

    return bubble;
}

/* =========================================================
   ADD MESSAGE
   ========================================================= */

function addMessage(role, content) {

    const safeContent =
        typeof content === "string"
            ? content
            : String(content ?? "");

    chatHistory.push({
        role: role,
        content: safeContent
    });

    addMessageToUI(
        role === "user"
            ? "user"
            : "ai",
        safeContent
    );
}

/* =========================================================
   THINKING BUBBLE
   ========================================================= */

function createThinkingBubble() {

    const row =
        document.createElement("div");

    row.className =
        "message-row ai thinking-row";

    const avatar =
        document.createElement("div");

    avatar.className =
        "message-avatar";

    avatar.textContent = "C";

    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble thinking";

    bubble.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;

    row.appendChild(avatar);
    row.appendChild(bubble);

    messages.appendChild(row);

    scrollToBottom();

    return row;
}

/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

    if (isSending) return;

    const text =
        String(messageInput?.value || "").trim();

    if (
        !text &&
        !selectedFile &&
        !selectedImage
    ) {
        return;
    }

    isSending = true;

    if (sendBtn) {
        sendBtn.disabled = true;
    }

    if (welcome) {
        welcome.classList.add("hidden");
    }

    let displayText = text;

    if (selectedImage) {

        displayText =
            text
                ? `${text}\n\n[Image attached]`
                : "[Image attached]";

    } else if (selectedFile) {

        displayText =
            text
                ? `${text}\n\n[File: ${selectedFile.name}]`
                : `[File: ${selectedFile.name}]`;
    }

    addMessage(
        "user",
        displayText
    );

    messageInput.value = "";
    autoResize();

    /*
       SHOW THINKING IMMEDIATELY
    */

    const thinkingRow =
        createThinkingBubble();

    try {

        let answer = "";

        if (selectedImage) {

            answer =
                await sendVisionRequest(
                    text,
                    selectedImage
                );

        } else if (selectedFile) {

            const fileText =
                await readBrowserFile(
                    selectedFile
                );

            const combined =
                text
                    ? `${text}\n\nHere is the attached file:\n\n${fileText}`
                    : `Please analyze this file:\n\n${fileText}`;

            answer =
                await sendChatRequest(
                    combined
                );

        } else {

            answer =
                await sendChatRequest(text);
        }

        /*
           ALWAYS FORCE ANSWER TO STRING
        */

        if (
            answer === null ||
            answer === undefined
        ) {
            answer = "";
        }

        answer = String(answer);

        if (!answer.trim()) {
            answer =
                "I couldn't generate a response.";
        }

        thinkingRow.remove();

        chatHistory.push({
            role: "assistant",
            content: answer
        });

        addMessageToUI(
            "ai",
            answer
        );

        if (currentUser) {
            await saveCloudChat();
        } else {
            saveGuestChat();
        }

    } catch (error) {

        console.error(
            "CodeAI request error:",
            error
        );

        thinkingRow.remove();

        const errorText =
            "Sorry bro, I couldn't complete that request.\n\n" +
            (
                error &&
                error.message
                    ? String(error.message)
                    : "Please try again."
            );

        chatHistory.push({
            role: "assistant",
            content: errorText
        });

        addMessageToUI(
            "ai",
            errorText
        );

        if (currentUser) {
            await saveCloudChat();
        } else {
            saveGuestChat();
        }

    } finally {

        clearAttachment();

        isSending = false;

        if (sendBtn) {
            sendBtn.disabled = false;
        }

        scrollToBottom();
    }
}

/* =========================================================
   CHAT API
   ========================================================= */

async function sendChatRequest(text) {

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
                    message: String(text || ""),
                    language:
                        languageSelect?.value || "General",
                    history:
                        getCleanHistory()
                })
            }
        );

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {

        throw new Error(
            String(
                data.detail ||
                `Backend error: ${response.status}`
            )
        );
    }

    const answer =
        data.answer ??
        data.response ??
        data.message ??
        "";

    return String(answer ?? "");
}

/* =========================================================
   VISION
   ========================================================= */

async function sendVisionRequest(
    text,
    imageFile
) {

    const base64 =
        await fileToBase64(
            imageFile
        );

    const response =
        await fetch(
            `${BACKEND_URL}/vision`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    message:
                        String(
                            text ||
                            "Describe and analyze this image."
                        ),

                    image:
                        base64
                })
            }
        );

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {

        throw new Error(
            String(
                data.detail ||
                `Vision error: ${response.status}`
            )
        );
    }

    const answer =
        data.answer ??
        data.response ??
        data.message ??
        "";

    return String(answer ?? "");
}

/* =========================================================
   FILE READER
   ========================================================= */

async function readBrowserFile(file) {

    if (
        file.type &&
        file.type.startsWith("text/")
    ) {
        return await file.text();
    }

    const extension =
        String(file.name || "")
            .split(".")
            .pop()
            .toLowerCase();

    const textExtensions = [
        "txt",
        "py",
        "js",
        "html",
        "css",
        "json",
        "md",
        "csv",
        "java",
        "cpp",
        "c",
        "h",
        "rs",
        "sql",
        "xml",
        "yaml",
        "yml"
    ];

    if (
        textExtensions.includes(extension)
    ) {
        return await file.text();
    }

    return (
        `File name: ${file.name}\n` +
        `File type: ${file.type || "unknown"}\n` +
        `File size: ${formatBytes(file.size)}\n\n` +
        "This file type needs server-side extraction."
    );
}

/* =========================================================
   FILE TO BASE64
   ========================================================= */

function fileToBase64(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onload = () => {

                const result =
                    String(
                        reader.result || ""
                    );

                const comma =
                    result.indexOf(",");

                if (comma === -1) {

                    reject(
                        new Error(
                            "Could not read image."
                        )
                    );

                    return;
                }

                resolve(
                    result.slice(
                        comma + 1
                    )
                );
            };

            reader.onerror =
                () =>
                    reject(
                        new Error(
                            "Could not read file."
                        )
                    );

            reader.readAsDataURL(file);
        }
    );
}

/* =========================================================
   ATTACH FILE
   ========================================================= */

if (attachBtn) {

    attachBtn.addEventListener(
        "click",
        () => fileInput?.click()
    );
}

if (fileInput) {

    fileInput.addEventListener(
        "change",
        () => {

            const file =
                fileInput.files?.[0];

            if (!file) return;

            if (
                file.type &&
                file.type.startsWith("image/")
            ) {

                selectedImage = file;
                selectedFile = null;

            } else {

                selectedFile = file;
                selectedImage = null;
            }

            showAttachment(file);
        }
    );
}

/* =========================================================
   CAMERA
   ========================================================= */

if (cameraBtn) {

    cameraBtn.addEventListener(
        "click",
        () => cameraInput?.click()
    );
}

if (cameraInput) {

    cameraInput.addEventListener(
        "change",
        () => {

            const file =
                cameraInput.files?.[0];

            if (!file) return;

            selectedImage = file;
            selectedFile = null;

            showAttachment(
                file,
                true
            );
        }
    );
}

/* =========================================================
   IMAGE INPUT
   ========================================================= */

if (imageInput) {

    imageInput.addEventListener(
        "change",
        () => {

            const file =
                imageInput.files?.[0];

            if (!file) return;

            selectedImage = file;
            selectedFile = null;

            showAttachment(file);
        }
    );
}

/* =========================================================
   ATTACHMENT PREVIEW
   ========================================================= */

function showAttachment(
    file,
    camera = false
) {

    if (!attachmentPreview) return;

    attachmentPreview.classList.remove(
        "hidden"
    );

    attachmentName.textContent =
        camera
            ? "Camera photo"
            : String(file.name || "Attachment");

    attachmentType.textContent =
        String(file.type || "Attachment");
}

/* =========================================================
   CLEAR ATTACHMENT
   ========================================================= */

if (removeAttachmentBtn) {

    removeAttachmentBtn.addEventListener(
        "click",
        clearAttachment
    );
}

function clearAttachment() {

    selectedFile = null;
    selectedImage = null;

    if (fileInput) fileInput.value = "";
    if (cameraInput) cameraInput.value = "";
    if (imageInput) imageInput.value = "";

    if (attachmentPreview) {

        attachmentPreview.classList.add(
            "hidden"
        );
    }
}

/* =========================================================
   PDF
   ========================================================= */

async function createPDF(
    title,
    content
) {

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
                    title:
                        title ||
                        "CodeAI PDF",

                    content:
                        content || ""
                })
            }
        );

    if (!response.ok) {

        let data = {};

        try {
            data = await response.json();
        } catch {}

        throw new Error(
            String(
                data.detail ||
                `PDF creation failed: ${response.status}`
            )
        );
    }

    const blob =
        await response.blob();

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

    a.href = url;

    a.download =
        `${safeFilename(
            title || "CodeAI"
        )}.pdf`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    setTimeout(
        () => URL.revokeObjectURL(url),
        1000
    );
}

/* =========================================================
   CLEAN HISTORY
   ========================================================= */

function getCleanHistory() {

    return chatHistory
        .filter(isValidMessage)
        .slice(-40)
        .map(item => ({
            role: item.role,
            content: String(item.content)
        }));
}

/* =========================================================
   NEW CHAT
   ========================================================= */

if (newChatBtn) {

    newChatBtn.addEventListener(
        "click",
        async () => {

            chatHistory = [];

            messages.innerHTML = "";

            if (welcome) {
                welcome.classList.remove(
                    "hidden"
                );
            }

            clearAttachment();

            if (currentUser) {

                currentChatId =
                    firebaseDB
                        .collection("users")
                        .doc(currentUser.uid)
                        .collection("chats")
                        .doc().id;

            } else {

                currentChatId = "guest";

                saveGuestChat();
            }

            if (messageInput) {
                messageInput.focus();
            }
        }
    );
}

/* =========================================================
   INPUT
   ========================================================= */

if (sendBtn) {

    sendBtn.addEventListener(
        "click",
        sendMessage
    );
}

if (messageInput) {

    messageInput.addEventListener(
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

    messageInput.addEventListener(
        "input",
        autoResize
    );
}

function autoResize() {

    if (!messageInput) return;

    messageInput.style.height = "auto";

    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            180
        ) + "px";
}

/* =========================================================
   SUGGESTIONS
   ========================================================= */

document
    .querySelectorAll(".suggestion")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                messageInput.value =
                    String(
                        button.textContent || ""
                    ).trim();

                autoResize();

                messageInput.focus();
            }
        );
    });

/* =========================================================
   MODE
   ========================================================= */

if (languageSelect) {

    languageSelect.addEventListener(
        "change",
        () => {

            const mode =
                languageSelect.value;

            messageInput.placeholder =
                mode !== "General"
                    ? `Ask CodeAI about ${mode}...`
                    : "Ask CodeAI anything...";
        }
    );
}

/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

if (menuBtn) {

    menuBtn.addEventListener(
        "click",
        () => {

            if (sidebar) {
                sidebar.classList.toggle(
                    "open"
                );
            }
        }
    );
}

/* =========================================================
   ABOUT
   ========================================================= */

if (aboutBtn) {

    aboutBtn.addEventListener(
        "click",
        () => {

            alert(
                "CodeAI\n\n" +
                "A free general-purpose AI assistant.\n\n" +
                "Creator:\n" +
                "VARAD WANSAGAR sir created me.\n\n" +
                "Free mode: No subscriptions, no ads and no payments."
            );
        }
    );
}

/* =========================================================
   FORMAT AI TEXT
   ========================================================= */

function formatAIText(text) {

    if (
        text === null ||
        text === undefined
    ) {
        return "";
    }

    let value =
        String(text);

    let escaped =
        escapeHTML(value);

    /*
       Code blocks
    */

    escaped =
        escaped.replace(
            /```([a-zA-Z0-9+#.-]*)\n?([\s\S]*?)```/g,
            (match, language, code) => {

                const cleanCode =
                    String(code || "").trim();

                const lang =
                    String(
                        language || "code"
                    );

                return `
                    <div class="code-block">
                        <div class="code-header">
                            <span>${lang}</span>
                            <button
                                class="copy-code"
                                onclick="copyCode(this)"
                            >
                                Copy
                            </button>
                        </div>

                        <pre><code>${cleanCode}</code></pre>
                    </div>
                `;
            }
        );

    /*
       Bold
    */

    escaped =
        escaped.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

    /*
       Inline code
    */

    escaped =
        escaped.replace(
            /`([^`]+)`/g,
            '<code class="inline-code">$1</code>'
        );

    /*
       New lines
    */

    escaped =
        escaped.replace(
            /\n/g,
            "<br>"
        );

    return escaped;
}

/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   COPY CODE
   ========================================================= */

window.copyCode =
    async function(button) {

        const block =
            button?.closest(".code-block");

        if (!block) return;

        const codeElement =
            block.querySelector("code");

        if (!codeElement) return;

        const code =
            codeElement.innerText || "";

        try {

            await navigator.clipboard.writeText(
                code
            );

            button.textContent =
                "Copied!";

            setTimeout(
                () => {
                    button.textContent =
                        "Copy";
                },
                1500
            );

        } catch {

            alert(
                "Couldn't copy the code."
            );
        }
    };

/* =========================================================
   SCROLL
   ========================================================= */

function scrollToBottom() {

    const chat =
        document.getElementById(
            "chatArea"
        );

    if (!chat) return;

    requestAnimationFrame(() => {

        chat.scrollTop =
            chat.scrollHeight;
    });
}

/* =========================================================
   HELPERS
   ========================================================= */

function formatBytes(bytes) {

    if (!bytes) return "0 B";

    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];

    const index =
        Math.min(
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            ),
            units.length - 1
        );

    return (
        Math.round(
            (
                bytes /
                Math.pow(
                    1024,
                    index
                )
            ) * 100
        ) / 100
    ) +
        " " +
        units[index];
}

function safeFilename(name) {

    return String(name || "CodeAI")
        .replace(
            /[^a-z0-9-_ ]/gi,
            ""
        )
        .trim()
        .replace(
            /\s+/g,
            "_"
        )
        .slice(0, 80) ||
        "CodeAI";
}

/* =========================================================
   MICROPHONE
   ========================================================= */

let mediaRecorder = null;
let audioChunks = [];
let recording = false;

if (micBtn) {

    micBtn.addEventListener(
        "click",
        async () => {

            if (recording) {
                stopRecording();
            } else {
                await startRecording();
            }
        }
    );
}

async function startRecording() {

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        audioChunks = [];

        mediaRecorder =
            new MediaRecorder(stream);

        mediaRecorder.ondataavailable =
            event => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

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

                const audioBlob =
                    new Blob(
                        audioChunks,
                        {
                            type:
                                "audio/webm"
                        }
                    );

                await transcribeAudio(
                    audioBlob
                );
            };

        mediaRecorder.start();

        recording = true;

        micBtn.textContent =
            "⏹";
    } catch (error) {

        console.error(error);

        alert(
            "Microphone access was not available."
        );
    }
}

function stopRecording() {

    if (
        mediaRecorder &&
        recording
    ) {

        mediaRecorder.stop();

        recording = false;

        micBtn.textContent =
            "🎤";
    }
}

/* =========================================================
   TRANSCRIPTION
   ========================================================= */

async function transcribeAudio(
    audioBlob
) {

    try {

        const formData =
            new FormData();

        formData.append(
            "file",
            audioBlob,
            "voice.webm"
        );

        const response =
            await fetch(
                `${BACKEND_URL}/transcribe`,
                {
                    method: "POST",
                    body: formData
                }
            );

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {

            throw new Error(
                String(
                    data.detail ||
                    `Transcription error: ${response.status}`
                )
            );
        }

        const text =
            String(
                data.text ||
                data.transcription ||
                ""
            );

        if (text) {

            messageInput.value =
                text;

            autoResize();

            messageInput.focus();
        }

    } catch (error) {

        console.error(error);

        alert(
            "I couldn't transcribe that recording."
        );
    }
}

/* =========================================================
   FINAL STARTUP
   ========================================================= */

/*
   Login screen is already visible.
   Firebase decides what happens next.
*/
showGateway();