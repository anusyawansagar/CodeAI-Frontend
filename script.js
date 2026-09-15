"use strict";

/* =========================================================
   CODEAI FRONTEND
   SMART CHAT SYSTEM + FIREBASE + VISION + FILES
   ========================================================= */

const BACKEND_URL =
    "https://codeai-backend-0y6t.onrender.com";

/* =========================================================
   GLOBAL STATE
   ========================================================= */

let currentUser = null;
let isGuest = false;

let chatHistory = [];
let currentChatId = null;
let cloudChats = [];

let selectedFile = null;
let selectedImage = null;

let isSending = false;

let firebaseAuth = null;
let firebaseDB = null;
let googleProvider = null;

/* =========================================================
   START
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 CodeAI JavaScript started");
    initCodeAI();
});

/* =========================================================
   MAIN INITIALIZATION
   ========================================================= */

function initCodeAI() {

    if (typeof firebase !== "undefined") {

        try {

            if (firebase.apps.length > 0) {

                firebaseAuth = firebase.auth();
                firebaseDB = firebase.firestore();
                googleProvider =
                    new firebase.auth.GoogleAuthProvider();

                console.log("🔥 Firebase ready");

            } else {

                console.warn(
                    "Firebase SDK loaded but no Firebase app was initialized."
                );
            }

        } catch (error) {

            console.error(
                "Firebase setup error:",
                error
            );
        }

    } else {

        console.warn(
            "Firebase SDK not found. Guest mode will still work."
        );
    }

    setupGateway();
    setupChat();
    setupAttachments();
    setupMicrophone();
    setupSidebar();
    setupAbout();
    setupSuggestions();
    setupModeSelector();
    setupAuthState();

    showGateway();

    console.log("✅ CodeAI ready");
}

/* =========================================================
   ELEMENT HELPER
   ========================================================= */

function get(id) {
    return document.getElementById(id);
}

/* =========================================================
   SHOW / HIDE
   ========================================================= */

function showGateway() {

    const gateway = get("accountGateway");
    const app = get("app");

    if (gateway) {
        gateway.classList.remove("hidden");
    }

    if (app) {
        app.classList.add("hidden");
    }
}

function showApp() {

    const gateway = get("accountGateway");
    const app = get("app");

    if (gateway) {
        gateway.classList.add("hidden");
    }

    if (app) {
        app.classList.remove("hidden");
    }
}

/* =========================================================
   GATEWAY
   ========================================================= */

function setupGateway() {

    const googleButton = get("googleLoginBtn");
    const guestButton = get("guestBtn");

    if (guestButton) {

        guestButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                console.log(
                    "👤 Guest button clicked"
                );

                enterGuestMode();
            }
        );

    } else {

        console.error(
            "❌ guestBtn not found"
        );
    }

    if (googleButton) {

        googleButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                console.log(
                    "🔐 Google button clicked"
                );

                loginWithGoogle();
            }
        );

    } else {

        console.error(
            "❌ googleLoginBtn not found"
        );
    }
}

/* =========================================================
   GUEST MODE
   ========================================================= */

function enterGuestMode() {

    currentUser = null;
    isGuest = true;

    currentChatId = "guest";

    localStorage.setItem(
        "codeai_guest",
        "true"
    );

    showApp();
    updateAccountUI();
    loadGuestChat();

    setTimeout(() => {

        const input = get("messageInput");

        if (input) {
            input.focus();
        }

    }, 200);
}

/* =========================================================
   GOOGLE LOGIN
   ========================================================= */

async function loginWithGoogle() {

    const button = get("googleLoginBtn");

    if (!firebaseAuth) {

        alert(
            "Firebase is not ready.\n\n" +
            "Please make sure Firebase Authentication is enabled."
        );

        return;
    }

    try {

        if (button) {

            button.disabled = true;

            button.dataset.oldHTML =
                button.innerHTML;

            button.textContent =
                "Opening Google...";
        }

        if (!googleProvider) {

            googleProvider =
                new firebase.auth.GoogleAuthProvider();
        }

        googleProvider.setCustomParameters({
            prompt: "select_account"
        });

        await firebaseAuth.signInWithPopup(
            googleProvider
        );

        console.log(
            "✅ Google sign-in completed"
        );

    } catch (error) {

        console.error(
            "❌ Google sign-in error:",
            error
        );

        let message =
            "Google Sign-In failed.\n\n";

        if (
            error &&
            error.code === "auth/popup-blocked"
        ) {

            message +=
                "Your browser blocked the Google popup.";

        } else if (
            error &&
            error.code ===
                "auth/popup-closed-by-user"
        ) {

            message +=
                "The Google login window was closed.";

        } else if (
            error &&
            error.code ===
                "auth/unauthorized-domain"
        ) {

            message +=
                "This Vercel domain is not authorized in Firebase.";

        } else if (
            error &&
            error.code ===
                "auth/operation-not-allowed"
        ) {

            message +=
                "Google Sign-In is not enabled in Firebase.";

        } else {

            message +=
                error?.message ||
                "Unknown Firebase error.";
        }

        alert(message);

    } finally {

        if (button) {

            button.disabled = false;

            if (button.dataset.oldHTML) {

                button.innerHTML =
                    button.dataset.oldHTML;
            }
        }
    }
}

/* =========================================================
   FIREBASE AUTH STATE
   ========================================================= */

function setupAuthState() {

    if (!firebaseAuth) {

        console.warn(
            "Firebase Auth unavailable."
        );

        return;
    }

    firebaseAuth.onAuthStateChanged(
        async user => {

            console.log(
                "Auth state:",
                user
                    ? user.email
                    : "signed out"
            );

            if (user) {

                currentUser = user;
                isGuest = false;

                localStorage.removeItem(
                    "codeai_guest"
                );

                showApp();
                updateAccountUI();

                await loadChatList();
                await loadCloudChat();

            } else {

                if (!isGuest) {
                    showGateway();
                }
            }
        }
    );
}

/* =========================================================
   ACCOUNT UI
   ========================================================= */

function updateAccountUI() {

    const name = get("accountName");
    const type = get("accountType");
    const avatar = get("accountAvatar");

    if (currentUser && !isGuest) {

        if (name) {

            name.textContent =
                currentUser.displayName ||
                currentUser.email ||
                "Google User";
        }

        if (type) {
            type.textContent =
                "Google Account";
        }

        if (avatar) {

            avatar.src =
                currentUser.photoURL ||
                "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg";
        }

        return;
    }

    if (name) {
        name.textContent = "Guest";
    }

    if (type) {
        type.textContent = "Guest Mode";
    }

    if (avatar) {

        avatar.src =
            "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/user.svg";
    }
}

/* =========================================================
   SIGN OUT
   ========================================================= */

function setupSignOut() {

    const button = get("signOutBtn");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            try {

                if (
                    firebaseAuth &&
                    currentUser &&
                    !isGuest
                ) {

                    await firebaseAuth.signOut();
                }

            } catch (error) {

                console.error(
                    "Sign out error:",
                    error
                );
            }

            currentUser = null;
            isGuest = false;

            currentChatId = null;
            chatHistory = [];
            cloudChats = [];

            localStorage.removeItem(
                "codeai_guest"
            );

            showGateway();
        }
    );
}

/* =========================================================
   GUEST CHAT STORAGE
   ========================================================= */

function saveGuestChat() {

    if (!isGuest) {
        return;
    }

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

function loadGuestChat() {

    if (!isGuest) {
        return;
    }

    try {

        const saved =
            localStorage.getItem(
                "codeai_guest_chat"
            );

        if (saved) {

            const parsed =
                JSON.parse(saved);

            if (Array.isArray(parsed)) {

                chatHistory = parsed;

            } else {

                chatHistory = [];
            }

        } else {

            chatHistory = [];
        }

    } catch (error) {

        console.error(
            "Guest load error:",
            error
        );

        chatHistory = [];
    }

    renderMessages();
}

/* =========================================================
   SMART CHAT TITLE SYSTEM
   ========================================================= */

function createChatTitle() {

    const firstUserMessage =
        chatHistory.find(
            item =>
                item &&
                item.role === "user"
        );

    if (!firstUserMessage) {
        return "New Chat";
    }

    let text =
        String(
            firstUserMessage.content || ""
        )
        .replace(
            /\[Attached:[^\]]+\]/gi,
            ""
        )
        .replace(
            /\[Attached image\]/gi,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

    if (!text) {
        return "New Chat";
    }

    const lower =
        text.toLowerCase();

    /* =====================================================
       GREETINGS
       ===================================================== */

    if (
        /^(hi|hello|hey|hii|helo|yo|sup|namaste)\b/.test(lower)
    ) {
        return "Greetings";
    }

    if (
        /^(good morning|good afternoon|good evening)\b/.test(lower)
    ) {
        return "Greetings";
    }

    /* =====================================================
       CHATBOT
       ===================================================== */

    if (
        (
            /(create|make|build|develop|design|code).*(chatbot|chat bot|ai assistant)/i
                .test(text)
        ) ||
        (
            /(chatbot|chat bot|ai assistant).*(create|make|build|develop|design|code)/i
                .test(text)
        )
    ) {

        if (/python/.test(lower)) {
            return "Python AI Assistant";
        }

        if (/website|web|html|css|javascript/.test(lower)) {
            return "AI Chatbot Website";
        }

        return "Creating a Chatbot";
    }

    /* =====================================================
       SCHOOL WEBSITE
       ===================================================== */

    if (
        /school/.test(lower) &&
        /(website|web|site|portal|app)/.test(lower)
    ) {
        return "School Website";
    }

    /* =====================================================
       WEBSITE
       ===================================================== */

    if (
        /(create|make|build|develop|design).*(website|web site|web app|webpage|web page)/i
            .test(text)
    ) {

        return "Creating a Website";
    }

    /* =====================================================
       PYTHON
       ===================================================== */

    if (/python/.test(lower)) {

        if (
            /assistant|agent|automation/.test(lower)
        ) {
            return "Python AI Assistant";
        }

        if (
            /game|gaming/.test(lower)
        ) {
            return "Python Game";
        }

        if (
            /error|bug|fix|broken|not working|problem/.test(lower)
        ) {
            return "Fix Python Error";
        }

        if (
            /project|program|create|make|build/.test(lower)
        ) {
            return "Python Project";
        }

        return "Python Help";
    }

    /* =====================================================
       JAVASCRIPT
       ===================================================== */

    if (
        /javascript|script\.js|\bjs\b/.test(lower)
    ) {

        if (
            /error|bug|fix|broken|not working|problem/.test(lower)
        ) {
            return "Fix JavaScript Error";
        }

        return "JavaScript Help";
    }

    /* =====================================================
       HTML / CSS
       ===================================================== */

    if (
        /html|css/.test(lower)
    ) {

        if (
            /error|bug|fix|broken|not working|problem/.test(lower)
        ) {
            return "Fix Web Code";
        }

        return "HTML & CSS Help";
    }

    /* =====================================================
       FIREBASE
       ===================================================== */

    if (
        /firebase|firestore/.test(lower)
    ) {

        if (
            /login|sign.?in|auth|authentication|google/.test(lower)
        ) {
            return "Firebase Login";
        }

        if (
            /database|rules|security/.test(lower)
        ) {
            return "Firebase Database";
        }

        return "Firebase Help";
    }

    /* =====================================================
       VERCEL
       ===================================================== */

    if (/vercel/.test(lower)) {

        if (
            /error|failed|not working|problem/.test(lower)
        ) {
            return "Fix Vercel Deployment";
        }

        return "Vercel Deployment";
    }

    /* =====================================================
       RENDER
       ===================================================== */

    if (/render/.test(lower)) {

        if (
            /error|failed|not working|problem/.test(lower)
        ) {
            return "Fix Render Deployment";
        }

        return "Render Deployment";
    }

    /* =====================================================
       GITHUB
       ===================================================== */

    if (
        /github|git push|git commit|repository|repo/.test(lower)
    ) {
        return "GitHub Help";
    }

    /* =====================================================
       DEPLOYMENT / HOSTING
       ===================================================== */

    if (
        /hosting|domain|deploy|deployment|website online|publish online/.test(lower)
    ) {
        return "Web Deployment";
    }

    /* =====================================================
       GENERAL CODING
       ===================================================== */

    if (
        /code|coding|program|programming|debug|bug|syntax|java|c\+\+|react|node|api/.test(lower)
    ) {

        if (
            /error|bug|fix|broken|not working|problem/.test(lower)
        ) {
            return "Fix Coding Problem";
        }

        return "Coding Help";
    }

    /* =====================================================
       MATH
       ===================================================== */

    if (
        /math|calculate|calculator|equation|algebra|geometry|fraction|percentage|percent|prime|factor|multiplication|division|addition|subtraction|solve.*number/.test(lower)
    ) {
        return "Math Help";
    }

    /* =====================================================
       SCIENCE
       ===================================================== */

    if (
        /science|physics|chemistry|biology|photosynthesis|gravity|atom|molecule|electricity|force|energy|planet|solar system/.test(lower)
    ) {
        return "Science Help";
    }

    /* =====================================================
       IMAGE
       ===================================================== */

    if (
        /image|picture|photo|attached image|analyze this image|camera|what do you see/.test(lower)
    ) {
        return "Image Analysis";
    }

    /* =====================================================
       PDF
       ===================================================== */

    if (/pdf/.test(lower)) {
        return "PDF Help";
    }

    /* =====================================================
       DOCUMENTS / FILES
       ===================================================== */

    if (
        /document|file|notes|read this|summarize this document|explain this document/.test(lower)
    ) {
        return "Document Help";
    }

    /* =====================================================
       YOUTUBE
       ===================================================== */

    if (
        /youtube|shorts|subscriber|subscribers|channel|thumbnail|views|youtube studio/.test(lower)
    ) {

        if (
            /subscriber|subscribers|subs|growth/.test(lower)
        ) {
            return "YouTube Growth";
        }

        if (/thumbnail/.test(lower)) {
            return "YouTube Thumbnail";
        }

        if (/shorts|video/.test(lower)) {
            return "YouTube Shorts";
        }

        return "YouTube Help";
    }

    /* =====================================================
       PC / WINDOWS
       ===================================================== */

    if (
        /computer|pc|windows|laptop|gpu|cpu|graphics|software|driver|nvidia|keyboard|mouse|monitor|ram|storage/.test(lower)
    ) {
        return "PC Help";
    }

    /* =====================================================
       SCHOOL
       ===================================================== */

    if (
        /school|homework|exam|study|class|chapter|lesson|teacher|question paper|assignment/.test(lower)
    ) {
        return "School Help";
    }

    /* =====================================================
       MUSIC
       ===================================================== */

    if (
        /song|music|mashup|remix|beat|audio/.test(lower)
    ) {
        return "Music Help";
    }

    /* =====================================================
       ROBLOX / GAMING
       ===================================================== */

    if (
        /roblox|gaming|vehicle legends|grow a garden|dead rails/.test(lower)
    ) {
        return "Gaming Help";
    }

    /* =====================================================
       AI
       ===================================================== */

    if (
        /artificial intelligence|ai|gemini|gpt|openai|model|llm|machine learning/.test(lower)
    ) {
        return "AI Chat";
    }

    /* =====================================================
       MONEY / ONLINE EARNING
       ===================================================== */

    if (
        /money|earn|earning|income|online earning|freelance|business/.test(lower)
    ) {
        return "Online Earning";
    }

    /* =====================================================
       GENERAL SMART FALLBACK
       ===================================================== */

    let title = text;

    title =
        title
            .replace(
                /^(please|can you|could you|will you|help me|bro|tell me|show me|explain to me|i want to|i need to)\s+/i,
                ""
            )
            .trim();

    if (!title) {
        return "New Chat";
    }

    title =
        title.charAt(0).toUpperCase() +
        title.slice(1);

    /* Remove ending punctuation */

    title =
        title.replace(
            /[.!?]+$/,
            ""
        );

    /* Keep sidebar titles short */

    if (title.length > 45) {

        title =
            title
                .substring(0, 45)
                .trim() +
            "...";
    }

    return title;
}

/* =========================================================
   CLEAN HISTORY
   ========================================================= */

function cleanHistory() {

    return chatHistory
        .filter(
            message =>
                (
                    message.role === "user" ||
                    message.role === "assistant"
                ) &&
                typeof message.content ===
                    "string"
        )
        .slice(-40);
}

/* =========================================================
   SAVE CLOUD CHAT
   ========================================================= */

async function saveCloudChat() {

    if (
        !currentUser ||
        isGuest ||
        !firebaseDB ||
        !chatHistory.length
    ) {
        return;
    }

    try {

        const chats =
            firebaseDB
                .collection("users")
                .doc(currentUser.uid)
                .collection("chats");

        if (!currentChatId) {

            currentChatId =
                chats.doc().id;
        }

        const automaticTitle =
            createChatTitle();

        const existingChat =
            cloudChats.find(
                chat =>
                    chat.id ===
                    currentChatId
            );

        const finalTitle =
            existingChat?.customTitle
                ? existingChat.title
                : automaticTitle;

        await chats
            .doc(currentChatId)
            .set(
                {
                    title:
                        finalTitle,

                    customTitle:
                        existingChat?.customTitle ||
                        false,

                    messages:
                        cleanHistory(),

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                },
                {
                    merge: true
                }
            );

        console.log(
            "☁️ Chat saved:",
            finalTitle
        );

        await loadChatList();

    } catch (error) {

        console.error(
            "❌ Firestore save error:",
            error
        );
    }
}

/* =========================================================
   LOAD ALL CLOUD CHATS
   ========================================================= */

async function loadChatList() {

    if (
        !currentUser ||
        isGuest ||
        !firebaseDB
    ) {
        return;
    }

    try {

        const snapshot =
            await firebaseDB
                .collection("users")
                .doc(currentUser.uid)
                .collection("chats")
                .get();

        cloudChats =
            snapshot.docs.map(
                doc => {

                    const data =
                        doc.data() || {};

                    return {

                        id: doc.id,

                        title:
                            data.title ||
                            "New Chat",

                        customTitle:
                            data.customTitle ||
                            false,

                        updatedAt:
                            data.updatedAt ||
                            null
                    };
                }
            );

        cloudChats.sort(
            (a, b) =>
                (b.updatedAt?.seconds || 0) -
                (a.updatedAt?.seconds || 0)
        );

        renderChatList();

        console.log(
            "☁️ Chat list loaded:",
            cloudChats.length
        );

    } catch (error) {

        console.error(
            "❌ Chat list error:",
            error
        );
    }
}

/* =========================================================
   OPEN SAVED CLOUD CHAT
   ========================================================= */

async function openCloudChat(chatId) {

    if (
        !currentUser ||
        isGuest ||
        !firebaseDB
    ) {
        return;
    }

    try {

        const doc =
            await firebaseDB
                .collection("users")
                .doc(currentUser.uid)
                .collection("chats")
                .doc(chatId)
                .get();

        if (!doc.exists) {
            return;
        }

        const data =
            doc.data() || {};

        currentChatId =
            doc.id;

        chatHistory =
            Array.isArray(data.messages)
                ? data.messages
                : [];

        renderMessages();
        renderChatList();

        console.log(
            "📂 Opened chat:",
            data.title
        );

    } catch (error) {

        console.error(
            "❌ Could not open chat:",
            error
        );
    }
}

/* =========================================================
   RENAME CHAT
   ========================================================= */

async function renameCloudChat(chatId) {

    if (
        !currentUser ||
        isGuest ||
        !firebaseDB
    ) {
        return;
    }

    const chat =
        cloudChats.find(
            item =>
                item.id === chatId
        );

    if (!chat) {
        return;
    }

    const newName =
        prompt(
            "Enter a new name for this chat:",
            chat.title
        );

    if (newName === null) {
        return;
    }

    const cleanedName =
        newName
            .trim()
            .replace(/\s+/g, " ");

    if (!cleanedName) {

        alert(
            "Chat name cannot be empty."
        );

        return;
    }

    if (cleanedName.length > 60) {

        alert(
            "Chat name is too long. Keep it under 60 characters."
        );

        return;
    }

    try {

        await firebaseDB
            .collection("users")
            .doc(currentUser.uid)
            .collection("chats")
            .doc(chatId)
            .update({

                title:
                    cleanedName,

                customTitle:
                    true,

                updatedAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()
            });

        console.log(
            "✏️ Chat renamed:",
            cleanedName
        );

        await loadChatList();

    } catch (error) {

        console.error(
            "❌ Rename error:",
            error
        );

        alert(
            "Could not rename this chat."
        );
    }
}

/* =========================================================
   DELETE CHAT
   ========================================================= */

async function deleteCloudChat(chatId) {

    if (
        !currentUser ||
        isGuest ||
        !firebaseDB
    ) {
        return;
    }

    const chat =
        cloudChats.find(
            item =>
                item.id === chatId
        );

    if (!chat) {
        return;
    }

    const confirmed =
        confirm(
            `Delete "${chat.title}"?\n\nThis chat will be permanently removed from your CodeAI account.`
        );

    if (!confirmed) {
        return;
    }

    try {

        await firebaseDB
            .collection("users")
            .doc(currentUser.uid)
            .collection("chats")
            .doc(chatId)
            .delete();

        console.log(
            "🗑️ Chat deleted:",
            chat.title
        );

        if (currentChatId === chatId) {

            currentChatId = null;
            chatHistory = [];

            renderMessages();
        }

        await loadChatList();

    } catch (error) {

        console.error(
            "❌ Delete error:",
            error
        );

        alert(
            "Could not delete this chat."
        );
    }
}

/* =========================================================
   RENDER CHAT LIST
   ========================================================= */

function renderChatList() {

    const list = get("chatList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (!currentUser || isGuest) {
        return;
    }

    if (!cloudChats.length) {

        const empty =
            document.createElement("div");

        empty.textContent =
            "No saved chats yet.";

        empty.style.opacity =
            "0.5";

        empty.style.padding =
            "10px";

        list.appendChild(empty);

        return;
    }

    cloudChats.forEach(chat => {

        const row =
            document.createElement("div");

        row.className =
            "saved-chat-row";

        row.style.display =
            "flex";

        row.style.alignItems =
            "center";

        row.style.width =
            "100%";

        row.style.marginBottom =
            "4px";

        /* CHAT BUTTON */

        const button =
            document.createElement("button");

        button.type =
            "button";

        button.className =
            "saved-chat";

        button.textContent =
            chat.title;

        button.style.flex =
            "1";

        button.style.minWidth =
            "0";

        button.style.width =
            "100%";

        button.style.textAlign =
            "left";

        button.style.background =
            "transparent";

        button.style.border =
            "0";

        button.style.color =
            "inherit";

        button.style.padding =
            "10px";

        button.style.cursor =
            "pointer";

        button.style.borderRadius =
            "8px";

        button.style.overflow =
            "hidden";

        button.style.textOverflow =
            "ellipsis";

        button.style.whiteSpace =
            "nowrap";

        button.title =
            chat.title;

        if (
            chat.id ===
            currentChatId
        ) {

            button.style.background =
                "rgba(255,255,255,0.08)";
        }

        button.addEventListener(
            "click",
            () => {

                openCloudChat(
                    chat.id
                );
            }
        );

        /* THREE DOT MENU */

        const menuButton =
            document.createElement("button");

        menuButton.type =
            "button";

        menuButton.textContent =
            "⋮";

        menuButton.className =
            "chat-menu-button";

        menuButton.title =
            "Chat options";

        menuButton.style.width =
            "36px";

        menuButton.style.height =
            "36px";

        menuButton.style.flex =
            "0 0 36px";

        menuButton.style.background =
            "transparent";

        menuButton.style.border =
            "0";

        menuButton.style.color =
            "inherit";

        menuButton.style.cursor =
            "pointer";

        menuButton.style.borderRadius =
            "8px";

        menuButton.style.fontSize =
            "20px";

        menuButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                showChatMenu(
                    chat,
                    menuButton
                );
            }
        );

        row.appendChild(button);
        row.appendChild(menuButton);

        list.appendChild(row);
    });
}

/* =========================================================
   CHAT MENU
   ========================================================= */

function showChatMenu(
    chat,
    anchor
) {

    closeChatMenus();

    const menu =
        document.createElement("div");

    menu.className =
        "codeai-chat-menu";

    menu.style.position =
        "fixed";

    menu.style.zIndex =
        "99999";

    menu.style.background =
        "#171717";

    menu.style.border =
        "1px solid rgba(255,255,255,0.12)";

    menu.style.borderRadius =
        "10px";

    menu.style.padding =
        "5px";

    menu.style.minWidth =
        "150px";

    menu.style.boxShadow =
        "0 10px 30px rgba(0,0,0,0.45)";

    const rect =
        anchor.getBoundingClientRect();

    let left =
        rect.right - 150;

    let top =
        rect.bottom + 5;

    if (
        left < 8
    ) {
        left = 8;
    }

    if (
        top + 100 >
        window.innerHeight
    ) {

        top =
            rect.top - 105;
    }

    menu.style.left =
        `${left}px`;

    menu.style.top =
        `${top}px`;

    /* RENAME */

    const rename =
        document.createElement("button");

    rename.textContent =
        "✏️ Rename";

    styleMenuItem(rename);

    rename.addEventListener(
        "click",
        () => {

            menu.remove();

            renameCloudChat(
                chat.id
            );
        }
    );

    /* DELETE */

    const remove =
        document.createElement("button");

    remove.textContent =
        "🗑️ Delete";

    styleMenuItem(
        remove,
        true
    );

    remove.addEventListener(
        "click",
        () => {

            menu.remove();

            deleteCloudChat(
                chat.id
            );
        }
    );

    menu.appendChild(rename);
    menu.appendChild(remove);

    document.body.appendChild(menu);

    setTimeout(() => {

        document.addEventListener(
            "click",
            closeChatMenus,
            {
                once: true
            }
        );

    }, 0);
}

function styleMenuItem(
    button,
    danger = false
) {

    button.style.display =
        "block";

    button.style.width =
        "100%";

    button.style.padding =
        "9px 12px";

    button.style.border =
        "0";

    button.style.borderRadius =
        "7px";

    button.style.background =
        "transparent";

    button.style.color =
        danger
            ? "#ff6b6b"
            : "#ffffff";

    button.style.textAlign =
        "left";

    button.style.cursor =
        "pointer";

    button.style.fontSize =
        "14px";
}

function closeChatMenus() {

    document
        .querySelectorAll(
            ".codeai-chat-menu"
        )
        .forEach(menu => {
            menu.remove();
        });
}

/* =========================================================
   LOAD NEWEST CLOUD CHAT
   ========================================================= */

async function loadCloudChat() {

    if (
        !currentUser ||
        isGuest ||
        !firebaseDB
    ) {
        return;
    }

    try {

        const snapshot =
            await firebaseDB
                .collection("users")
                .doc(currentUser.uid)
                .collection("chats")
                .get();

        if (snapshot.empty) {

            chatHistory = [];
            currentChatId = null;

            renderMessages();
            renderChatList();

            return;
        }

        let newestDoc = null;

        snapshot.forEach(doc => {

            if (!newestDoc) {

                newestDoc = doc;
                return;
            }

            const current =
                doc.data() || {};

            const newest =
                newestDoc.data() || {};

            const currentTime =
                current.updatedAt?.seconds ||
                0;

            const newestTime =
                newest.updatedAt?.seconds ||
                0;

            if (
                currentTime >
                newestTime
            ) {

                newestDoc = doc;
            }
        });

        if (newestDoc) {

            const data =
                newestDoc.data() || {};

            currentChatId =
                newestDoc.id;

            chatHistory =
                Array.isArray(
                    data.messages
                )
                    ? data.messages
                    : [];
        }

        renderMessages();
        renderChatList();

        console.log(
            "☁️ Newest cloud chat loaded"
        );

    } catch (error) {

        console.error(
            "❌ Firestore load error:",
            error
        );

        chatHistory = [];

        renderMessages();
    }
}

/* =========================================================
   CHAT SETUP
   ========================================================= */

function setupChat() {

    const sendButton =
        get("sendBtn");

    const input =
        get("messageInput");

    const newChat =
        get("newChatBtn");

    if (sendButton) {

        sendButton.addEventListener(
            "click",
            sendMessage
        );
    }

    if (input) {

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

        input.addEventListener(
            "input",
            autoResize
        );
    }

    if (newChat) {

        newChat.addEventListener(
            "click",
            startNewChat
        );
    }

    setupSignOut();
}

/* =========================================================
   NEW CHAT
   ========================================================= */

function startNewChat() {

    chatHistory = [];
    currentChatId = null;

    const messages =
        get("messages");

    const welcome =
        get("welcome");

    if (messages) {
        messages.innerHTML = "";
    }

    if (welcome) {
        welcome.classList.remove("hidden");
    }

    clearAttachment();

    if (isGuest) {
        saveGuestChat();
    }

    renderChatList();

    const input =
        get("messageInput");

    if (input) {

        input.value = "";

        autoResize();

        input.focus();
    }

    console.log(
        "🆕 New chat started"
    );
}

/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

    if (isSending) {
        return;
    }

    const input =
        get("messageInput");

    if (!input) {
        return;
    }

    const text =
        input.value.trim();

    if (
        !text &&
        !selectedFile &&
        !selectedImage
    ) {
        return;
    }

    isSending = true;

    input.value = "";

    autoResize();

    let displayText =
        text;

    if (selectedFile) {

        displayText +=
            (
                displayText
                    ? "\n"
                    : ""
            ) +
            `[Attached: ${selectedFile.name}]`;
    }

    if (selectedImage) {

        displayText +=
            (
                displayText
                    ? "\n"
                    : ""
            ) +
            "[Attached image]";
    }

    chatHistory.push({
        role: "user",
        content: displayText
    });

    hideWelcome();

    addMessage(
        "user",
        displayText
    );

    if (isGuest) {
        saveGuestChat();
    }

    /* IMAGE */

    if (
        selectedImage ||
        (
            selectedFile &&
            selectedFile.type &&
            selectedFile.type.startsWith(
                "image/"
            )
        )
    ) {

        const file =
            selectedImage ||
            selectedFile;

        clearAttachment();

        await processImage(
            file,
            text
        );

        isSending = false;

        return;
    }

    /* PDF */

    if (
        selectedFile &&
        (
            selectedFile.type ===
                "application/pdf" ||
            selectedFile.name
                .toLowerCase()
                .endsWith(".pdf")
        )
    ) {

        const file =
            selectedFile;

        clearAttachment();

        await processPDF(
            file,
            text
        );

        isSending = false;

        return;
    }

    /* OTHER FILE */

    if (selectedFile) {

        const file =
            selectedFile;

        clearAttachment();

        await processFile(
            file,
            text
        );

        isSending = false;

        return;
    }

    /* NORMAL CHAT */

    showTyping();

    try {

        const languageElement =
            get("languageSelect");

        const language =
            languageElement
                ? languageElement.value
                : "General";

        const response =
            await fetch(
                `${BACKEND_URL}/chat`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            message:
                                text,

                            language:
                                language,

                            history:
                                cleanHistory()
                        })
                }
            );

        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );
        }

        const data =
            await response.json();

        removeTyping();

        const reply =
            data.reply ||
            data.response ||
            data.message ||
            "I couldn't generate a response.";

        chatHistory.push({
            role: "assistant",
            content: reply
        });

        addMessage(
            "assistant",
            reply
        );

        await saveCurrentChat();

    } catch (error) {

        console.error(
            "❌ Chat error:",
            error
        );

        removeTyping();

        const errorText =
            "Sorry bro, CodeAI couldn't connect to the AI server right now.";

        chatHistory.push({
            role: "assistant",
            content: errorText
        });

        addMessage(
            "assistant",
            errorText
        );

        await saveCurrentChat();
    }

    isSending = false;
}

/* =========================================================
   ADD MESSAGE
   ========================================================= */

function addMessage(
    role,
    content
) {

    const container =
        get("messages");

    if (!container) {
        return;
    }

    const welcome =
        get("welcome");

    if (welcome) {
        welcome.classList.add("hidden");
    }

    const wrapper =
        document.createElement("div");

    wrapper.className =
        `message ${
            role === "user"
                ? "user-message"
                : "assistant-message"
        }`;

    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";

    if (role === "assistant") {

        bubble.innerHTML =
            formatAIText(content);

    } else {

        bubble.textContent =
            content;
    }

    wrapper.appendChild(
        bubble
    );

    container.appendChild(
        wrapper
    );

    scrollToBottom();
}

/* =========================================================
   RENDER SAVED MESSAGES
   ========================================================= */

function renderMessages() {

    const container =
        get("messages");

    const welcome =
        get("welcome");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (
        !chatHistory ||
        !chatHistory.length
    ) {

        if (welcome) {
            welcome.classList.remove("hidden");
        }

        return;
    }

    if (welcome) {
        welcome.classList.add("hidden");
    }

    chatHistory.forEach(
        message => {

            if (
                !message ||
                !message.role ||
                typeof message.content !==
                    "string"
            ) {
                return;
            }

            addMessage(
                message.role,
                message.content
            );
        }
    );

    scrollToBottom();
}

/* =========================================================
   HIDE WELCOME
   ========================================================= */

function hideWelcome() {

    const welcome =
        get("welcome");

    if (welcome) {
        welcome.classList.add("hidden");
    }
}

/* =========================================================
   TYPING
   ========================================================= */

function showTyping() {

    removeTyping();

    const container =
        get("messages");

    if (!container) {
        return;
    }

    const wrapper =
        document.createElement("div");

    wrapper.id =
        "codeaiTyping";

    wrapper.className =
        "message assistant-message";

    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";

    bubble.textContent =
        "CodeAI is thinking...";

    wrapper.appendChild(
        bubble
    );

    container.appendChild(
        wrapper
    );

    scrollToBottom();
}

function removeTyping() {

    const typing =
        get("codeaiTyping");

    if (typing) {
        typing.remove();
    }
}

/* =========================================================
   SCROLL
   ========================================================= */

function scrollToBottom() {

    const container =
        get("messages");

    if (!container) {
        return;
    }

    setTimeout(() => {

        container.scrollTop =
            container.scrollHeight;

    }, 30);
}

/* =========================================================
   AUTO RESIZE
   ========================================================= */

function autoResize() {

    const input =
        get("messageInput");

    if (!input) {
        return;
    }

    input.style.height =
        "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            180
        ) + "px";
}

/* =========================================================
   ATTACHMENTS
   ========================================================= */

function setupAttachments() {

    const attach =
        get("attachBtn");

    const camera =
        get("cameraBtn");

    const fileInput =
        get("fileInput");

    const cameraInput =
        get("cameraInput");

    const imageInput =
        get("imageInput");

    const remove =
        get("removeAttachmentBtn");

    if (
        attach &&
        fileInput
    ) {

        attach.addEventListener(
            "click",
            () => {

                fileInput.click();
            }
        );
    }

    if (
        camera &&
        cameraInput
    ) {

        camera.addEventListener(
            "click",
            () => {

                cameraInput.click();
            }
        );
    }

    if (fileInput) {

        fileInput.addEventListener(
            "change",
            () => {

                const file =
                    fileInput.files?.[0];

                if (!file) {
                    return;
                }

                selectedFile =
                    file;

                selectedImage =
                    null;

                showAttachment(
                    file
                );
            }
        );
    }

    if (imageInput) {

        imageInput.addEventListener(
            "change",
            () => {

                const file =
                    imageInput.files?.[0];

                if (!file) {
                    return;
                }

                selectedImage =
                    file;

                selectedFile =
                    null;

                showAttachment(
                    file
                );
            }
        );
    }

    if (cameraInput) {

        cameraInput.addEventListener(
            "change",
            () => {

                const file =
                    cameraInput.files?.[0];

                if (!file) {
                    return;
                }

                selectedImage =
                    file;

                selectedFile =
                    null;

                showAttachment(
                    file,
                    true
                );
            }
        );
    }

    if (remove) {

        remove.addEventListener(
            "click",
            clearAttachment
        );
    }
}

/* =========================================================
   SHOW ATTACHMENT
   ========================================================= */

function showAttachment(
    file,
    camera = false
) {

    const preview =
        get("attachmentPreview");

    const name =
        get("attachmentName");

    const type =
        get("attachmentType");

    if (preview) {

        preview.classList.remove(
            "hidden"
        );
    }

    if (name) {

        name.textContent =
            camera
                ? "Camera photo"
                : file.name;
    }

    if (type) {

        type.textContent =
            file.type ||
            "Attachment";
    }
}

/* =========================================================
   CLEAR ATTACHMENT
   ========================================================= */

function clearAttachment() {

    selectedFile = null;
    selectedImage = null;

    const fileInput =
        get("fileInput");

    const cameraInput =
        get("cameraInput");

    const imageInput =
        get("imageInput");

    if (fileInput) {
        fileInput.value = "";
    }

    if (cameraInput) {
        cameraInput.value = "";
    }

    if (imageInput) {
        imageInput.value = "";
    }

    const preview =
        get("attachmentPreview");

    if (preview) {

        preview.classList.add(
            "hidden"
        );
    }

    const name =
        get("attachmentName");

    if (name) {
        name.textContent = "";
    }

    const type =
        get("attachmentType");

    if (type) {
        type.textContent = "";
    }
}

/* =========================================================
   IMAGE / VISION
   ========================================================= */

async function processImage(
    file,
    question
) {

    showTyping();

    try {

        const form =
            new FormData();

        form.append(
            "file",
            file
        );

        form.append(
            "message",
            question ||
                "Analyze this image carefully."
        );

        const response =
            await fetch(
                `${BACKEND_URL}/vision`,
                {
                    method: "POST",
                    body: form
                }
            );

        if (!response.ok) {

            let detail = "";

            try {

                const errorData =
                    await response.json();

                detail =
                    errorData.detail ||
                    "";

            } catch (_) {}

            throw new Error(
                `Vision server returned ${response.status} ${detail}`
            );
        }

        const data =
            await response.json();

        removeTyping();

        const reply =
            data.reply ||
            data.response ||
            data.description ||
            "I couldn't understand the image.";

        chatHistory.push({
            role: "assistant",
            content: reply
        });

        addMessage(
            "assistant",
            reply
        );

        await saveCurrentChat();

    } catch (error) {

        removeTyping();

        console.error(
            "❌ Image error:",
            error
        );

        const errorText =
            "I couldn't analyze that image right now. Please try again.";

        chatHistory.push({
            role: "assistant",
            content: errorText
        });

        addMessage(
            "assistant",
            errorText
        );

        await saveCurrentChat();
    }
}

/* =========================================================
   PDF
   ========================================================= */

async function processPDF(
    file,
    question
) {

    showTyping();

    try {

        const form =
            new FormData();

        form.append(
            "file",
            file
        );

        const response =
            await fetch(
                `${BACKEND_URL}/read-pdf`,
                {
                    method: "POST",
                    body: form
                }
            );

        if (!response.ok) {

            throw new Error(
                `PDF server returned ${response.status}`
            );
        }

        const data =
            await response.json();

        removeTyping();

        let reply =
            data.reply ||
            data.response ||
            data.text ||
            "";

        if (
            !reply &&
            data.content
        ) {

            const instruction =
                question ||
                "Read this PDF.";

            reply =
                `${instruction}\n\n` +
                `PDF: ${data.filename || file.name}\n\n` +
                data.content;
        }

        if (!reply) {

            reply =
                "PDF processed, but no readable text was found.";
        }

        chatHistory.push({
            role: "assistant",
            content: reply
        });

        addMessage(
            "assistant",
            reply
        );

        await saveCurrentChat();

    } catch (error) {

        removeTyping();

        console.error(
            "❌ PDF error:",
            error
        );

        const errorText =
            "I couldn't read that PDF right now.";

        chatHistory.push({
            role: "assistant",
            content: errorText
        });

        addMessage(
            "assistant",
            errorText
        );

        await saveCurrentChat();
    }
}

/* =========================================================
   OTHER FILES
   ========================================================= */

async function processFile(
    file,
    question
) {

    showTyping();

    try {

        const form =
            new FormData();

        form.append(
            "file",
            file
        );

        const response =
            await fetch(
                `${BACKEND_URL}/read-file`,
                {
                    method: "POST",
                    body: form
                }
            );

        if (!response.ok) {

            throw new Error(
                `File server returned ${response.status}`
            );
        }

        const data =
            await response.json();

        removeTyping();

        let reply =
            data.reply ||
            data.response ||
            data.text ||
            "";

        if (
            !reply &&
            data.content
        ) {

            const instruction =
                question ||
                "Read this file and explain it.";

            reply =
                `${instruction}\n\n` +
                `File: ${data.filename || file.name}\n\n` +
                data.content;
        }

        if (!reply) {

            reply =
                "File received successfully.";
        }

        chatHistory.push({
            role: "assistant",
            content: reply
        });

        addMessage(
            "assistant",
            reply
        );

        await saveCurrentChat();

    } catch (error) {

        removeTyping();

        console.error(
            "❌ File error:",
            error
        );

        const errorText =
            "I couldn't read that file right now.";

        chatHistory.push({
            role: "assistant",
            content: errorText
        });

        addMessage(
            "assistant",
            errorText
        );

        await saveCurrentChat();
    }
}

/* =========================================================
   SAVE CURRENT CHAT
   ========================================================= */

async function saveCurrentChat() {

    if (isGuest) {

        saveGuestChat();

    } else if (currentUser) {

        await saveCloudChat();
    }
}

/* =========================================================
   MICROPHONE
   ========================================================= */

function setupMicrophone() {

    const button =
        get("micBtn");

    if (!button) {
        return;
    }

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        console.warn(
            "Speech recognition is not supported by this browser."
        );

        return;
    }

    const recognition =
        new SpeechRecognition();

    recognition.lang =
        "en-IN";

    recognition.continuous =
        false;

    recognition.interimResults =
        false;

    recognition.onstart =
        () => {

            button.classList.add(
                "active"
            );
        };

    recognition.onend =
        () => {

            button.classList.remove(
                "active"
            );
        };

    recognition.onerror =
        error => {

            console.error(
                "Microphone error:",
                error
            );

            button.classList.remove(
                "active"
            );
        };

    recognition.onresult =
        event => {

            const text =
                event.results[0][0]
                    .transcript;

            const input =
                get("messageInput");

            if (input) {

                input.value +=
                    (
                        input.value
                            ? " "
                            : ""
                    ) +
                    text;

                autoResize();

                input.focus();
            }
        };

    button.addEventListener(
        "click",
        () => {

            try {

                recognition.start();

            } catch (error) {

                console.log(
                    "Microphone already running."
                );
            }
        }
    );
}

/* =========================================================
   SUGGESTIONS
   ========================================================= */

function setupSuggestions() {

    const input =
        get("messageInput");

    if (!input) {
        return;
    }

    document
        .querySelectorAll(
            ".suggestion"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    input.value =
                        button.textContent.trim();

                    autoResize();

                    input.focus();
                }
            );
        });
}

/* =========================================================
   MODE SELECTOR
   ========================================================= */

function setupModeSelector() {

    const select =
        get("languageSelect");

    const input =
        get("messageInput");

    if (
        !select ||
        !input
    ) {
        return;
    }

    select.addEventListener(
        "change",
        () => {

            const mode =
                select.value;

            if (
                mode &&
                mode !== "General"
            ) {

                input.placeholder =
                    `Ask CodeAI about ${mode}...`;

            } else {

                input.placeholder =
                    "Ask CodeAI anything...";
            }
        }
    );
}

/* =========================================================
   SIDEBAR
   ========================================================= */

function setupSidebar() {

    const menu =
        get("menuBtn");

    const sidebar =
        get("sidebar");

    if (
        !menu ||
        !sidebar
    ) {
        return;
    }

    menu.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "open"
            );
        }
    );
}

/* =========================================================
   ABOUT
   ========================================================= */

function setupAbout() {

    const button =
        get("aboutBtn");

    if (!button) {
        return;
    }

    button.addEventListener(
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

    /* SAVE CODE BLOCKS BEFORE ESCAPING */

    const codeBlocks = [];

    value =
        value.replace(
            /```([a-zA-Z0-9+#._-]*)\n?([\s\S]*?)```/g,
            (
                match,
                language,
                code
            ) => {

                const index =
                    codeBlocks.length;

                codeBlocks.push({
                    language:
                        language ||
                        "code",

                    code:
                        code.trim()
                });

                return `___CODE_BLOCK_${index}___`;
            }
        );

    value =
        escapeHTML(value);

    /* RESTORE CODE BLOCKS */

    codeBlocks.forEach(
        (block, index) => {

            const safeCode =
                escapeHTML(
                    block.code
                );

            const safeLanguage =
                escapeHTML(
                    block.language
                );

            value =
                value.replace(
                    `___CODE_BLOCK_${index}___`,
                    `
                    <div class="code-block">
                        <div class="code-header">
                            <span>${safeLanguage}</span>

                            <button
                                class="copy-code"
                                onclick="copyCode(this)"
                            >
                                Copy
                            </button>
                        </div>

                        <pre><code>${safeCode}</code></pre>
                    </div>
                    `
                );
        }
    );

    /* BOLD */

    value =
        value.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

    /* INLINE CODE */

    value =
        value.replace(
            /`([^`]+)`/g,
            '<code class="inline-code">$1</code>'
        );

    /* NEW LINES */

    value =
        value.replace(
            /\n/g,
            "<br>"
        );

    return value;
}

/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

/* =========================================================
   COPY CODE
   ========================================================= */

async function copyCode(button) {

    try {

        const block =
            button.closest(
                ".code-block"
            );

        const code =
            block?.querySelector(
                "code"
            );

        if (!code) {
            return;
        }

        await navigator.clipboard.writeText(
            code.textContent
        );

        const oldText =
            button.textContent;

        button.textContent =
            "Copied!";

        setTimeout(
            () => {

                button.textContent =
                    oldText;

            },
            1200
        );

    } catch (error) {

        console.error(
            "Copy error:",
            error
        );
    }
}

/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.continueAsGuest =
    enterGuestMode;

window.continueWithGoogle =
    loginWithGoogle;

window.sendMessage =
    sendMessage;

window.startNewChat =
    startNewChat;

window.clearAttachment =
    clearAttachment;

window.copyCode =
    copyCode;

window.openCloudChat =
    openCloudChat;

window.loadChatList =
    loadChatList;

window.renameCloudChat =
    renameCloudChat;

window.deleteCloudChat =
    deleteCloudChat;
    /* =========================================================
   CODEAI MOBILE SIDEBAR — REAL OPEN/CLOSE BUTTON
   ========================================================= */

(function setupCodeAISidebar() {

    function setup() {

        const sidebar = document.getElementById("sidebar");
        const menuBtn = document.getElementById("menuBtn");
        const closeBtn = document.getElementById("sidebarCloseBtn");
        const overlay = document.getElementById("sidebarOverlay");

        if (!sidebar || !menuBtn || !closeBtn || !overlay) {
            console.warn("CodeAI sidebar elements not found.");
            return;
        }

        function openSidebar() {

            sidebar.classList.add("open");
            overlay.classList.add("active");

            menuBtn.setAttribute("aria-expanded", "true");
            menuBtn.setAttribute("aria-label", "Close menu");

            document.body.classList.add("sidebar-open");
        }

        function closeSidebar() {

            sidebar.classList.remove("open");
            overlay.classList.remove("active");

            menuBtn.setAttribute("aria-expanded", "false");
            menuBtn.setAttribute("aria-label", "Open menu");

            document.body.classList.remove("sidebar-open");
        }

        function toggleSidebar() {

            if (sidebar.classList.contains("open")) {
                closeSidebar();
            } else {
                openSidebar();
            }
        }

        /* HAMBURGER */

        menuBtn.addEventListener("click", function(event) {

            event.preventDefault();
            event.stopPropagation();

            toggleSidebar();

        });

        /* REAL X BUTTON */

        closeBtn.addEventListener("click", function(event) {

            event.preventDefault();
            event.stopPropagation();

            closeSidebar();

        });

        /* CLICK OUTSIDE SIDEBAR */

        overlay.addEventListener("click", function(event) {

            event.preventDefault();

            closeSidebar();

        });

        /* ESC KEY */

        document.addEventListener("keydown", function(event) {

            if (event.key === "Escape") {
                closeSidebar();
            }

        });

        /* CLOSE WHEN CLICKING A CHAT ON MOBILE */

        sidebar.addEventListener("click", function(event) {

            const chatButton =
                event.target.closest(".chat-button");

            if (
                chatButton &&
                window.innerWidth <= 768
            ) {
                closeSidebar();
            }

        });

        /* CLOSE WHEN NEW CHAT IS PRESSED */

        const newChatBtn =
            document.getElementById("newChatBtn");

        if (newChatBtn) {

            newChatBtn.addEventListener("click", function() {

                if (window.innerWidth <= 768) {
                    closeSidebar();
                }

            });

        }

        /* RESET WHEN GOING BACK TO DESKTOP */

        window.addEventListener("resize", function() {

            if (window.innerWidth > 768) {
                closeSidebar();
            }

        });

        console.log("✅ CodeAI sidebar controls ready");

    }

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            setup
        );

    } else {

        setup();

    }

})();