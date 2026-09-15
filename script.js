"use strict";

/* =========================================================
   CODEAI FRONTEND
   Clean replacement script
========================================================= */

const BACKEND_URL = "https://codeai-backend-0y6t.onrender.com";

/* =========================================================
   ELEMENTS
========================================================= */

const gateway = document.getElementById("accountGateway");
const app = document.getElementById("app");

const googleLoginBtn = document.getElementById("googleLoginBtn");
const guestBtn = document.getElementById("guestBtn");
const authError = document.getElementById("authError");

const newChatBtn = document.getElementById("newChatBtn");
const chatList = document.getElementById("chatList");

const accountName = document.getElementById("accountName");
const accountType = document.getElementById("accountType");
const accountAvatar = document.getElementById("accountAvatar");
const signOutBtn = document.getElementById("signOutBtn");

const menuBtn = document.getElementById("menuBtn");
const aboutBtn = document.getElementById("aboutBtn");

const welcome = document.getElementById("welcome");
const messages = document.getElementById("messages");

const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

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


/* =========================================================
   FIREBASE
========================================================= */

const firebaseReady =
    typeof firebase !== "undefined" &&
    typeof window.firebaseAuth !== "undefined";

const auth = firebaseReady
    ? window.firebaseAuth
    : null;

const db =
    firebaseReady &&
    typeof window.firestore !== "undefined"
        ? window.firestore
        : null;

let googleProvider = null;

if (firebaseReady && auth) {
    googleProvider =
        new firebase.auth.GoogleAuthProvider();

    googleProvider.setCustomParameters({
        prompt: "select_account"
    });
}


/* =========================================================
   STATE
========================================================= */

let currentUser = null;
let guestMode = false;
let authFinished = false;

let currentChatId = null;
let currentMessages = [];

let cloudChats = [];

let selectedFile = null;
let sending = false;


/* =========================================================
   BASIC HELPERS
========================================================= */

function text(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value);
}


function escapeHTML(value) {
    return text(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatAIText(value) {
    let output = escapeHTML(value);

    output = output.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    output = output.replace(
        /`([^`]+)`/g,
        "<code>$1</code>"
    );

    output = output.replace(
        /\n/g,
        "<br>"
    );

    return output;
}


/* =========================================================
   AUTH UI
========================================================= */

function showGateway() {
    if (gateway) {
        gateway.classList.remove("hidden");
    }

    if (app) {
        app.classList.add("hidden");
    }

    document.body.classList.add("gateway-active");
}


function showApp() {
    if (!authFinished) {
        return;
    }

    if (gateway) {
        gateway.classList.add("hidden");
    }

    if (app) {
        app.classList.remove("hidden");
    }

    document.body.classList.remove("gateway-active");

    setTimeout(() => {
        if (messageInput) {
            messageInput.focus();
        }
    }, 150);
}


function authMessage(message) {
    if (authError) {
        authError.textContent = text(message);
    }
}


/* =========================================================
   ACCOUNT
========================================================= */

function updateAccount(user) {
    if (user) {
        const name =
            user.displayName ||
            user.email ||
            "Google User";

        if (accountName) {
            accountName.textContent = name;
        }

        if (accountType) {
            accountType.textContent =
                "Google account";
        }

        if (accountAvatar) {
            accountAvatar.textContent =
                name.charAt(0).toUpperCase();
        }

        return;
    }

    if (accountName) {
        accountName.textContent = "Guest";
    }

    if (accountType) {
        accountType.textContent = "Guest mode";
    }

    if (accountAvatar) {
        accountAvatar.textContent = "G";
    }
}


/* =========================================================
   GOOGLE LOGIN
========================================================= */

if (googleLoginBtn) {
    googleLoginBtn.addEventListener(
        "click",
        async () => {

            if (!auth || !googleProvider) {
                authMessage(
                    "Firebase is not initialized correctly."
                );

                console.error(
                    "Firebase Auth is missing."
                );

                return;
            }

            authMessage("");

            googleLoginBtn.disabled = true;

            const oldHTML =
                googleLoginBtn.innerHTML;

            googleLoginBtn.innerHTML =
                "<span>Connecting...</span>";

            try {

                const result =
                    await auth.signInWithPopup(
                        googleProvider
                    );

                currentUser =
                    result.user;

                guestMode = false;

                updateAccount(currentUser);

                await loadCloudChats();

                if (!currentChatId) {
                    createChat(false);
                }

                authFinished = true;

                showApp();

            } catch (error) {

                console.error(
                    "GOOGLE LOGIN ERROR:",
                    error
                );

                let message =
                    "Google login failed.";

                if (
                    error &&
                    error.code
                ) {

                    if (
                        error.code ===
                        "auth/unauthorized-domain"
                    ) {
                        message =
                            "This Vercel domain is not authorized in Firebase.";
                    }

                    else if (
                        error.code ===
                        "auth/operation-not-allowed"
                    ) {
                        message =
                            "Google Sign-In is not enabled in Firebase.";
                    }

                    else if (
                        error.code ===
                        "auth/popup-blocked"
                    ) {
                        message =
                            "Your browser blocked the Google login popup.";
                    }

                    else if (
                        error.code ===
                        "auth/popup-closed-by-user"
                    ) {
                        message =
                            "Google login was cancelled.";
                    }

                    else if (
                        error.code ===
                        "auth/invalid-api-key"
                    ) {
                        message =
                            "Your Firebase API key is invalid.";
                    }

                    else if (
                        error.code ===
                        "auth/network-request-failed"
                    ) {
                        message =
                            "Network error. Check your internet.";
                    }

                    else {
                        message =
                            "Firebase error: " +
                            error.code;
                    }
                }

                authMessage(message);

            } finally {

                googleLoginBtn.disabled = false;

                googleLoginBtn.innerHTML =
                    oldHTML;
            }
        }
    );
}


/* =========================================================
   GUEST LOGIN
========================================================= */

if (guestBtn) {
    guestBtn.addEventListener(
        "click",
        () => {

            currentUser = null;
            guestMode = true;
            authFinished = true;

            updateAccount(null);

            loadGuestChats();

            showApp();
        }
    );
}


/* =========================================================
   FIREBASE AUTH STATE
========================================================= */

if (auth) {

    auth.onAuthStateChanged(
        async (user) => {

            console.log(
                "Firebase auth state:",
                user
                    ? user.email
                    : "No user"
            );

            if (user) {

                currentUser = user;
                guestMode = false;

                updateAccount(user);

                await loadCloudChats();

                if (!currentChatId) {
                    createChat(false);
                }

                authFinished = true;

                showApp();

            } else {

                currentUser = null;

                if (!guestMode) {

                    currentChatId = null;
                    currentMessages = [];

                    updateAccount(null);

                    authFinished = true;

                    showGateway();
                }
            }
        }
    );

} else {

    console.error(
        "CodeAI: Firebase Auth not found."
    );

    authFinished = true;

    showGateway();

    authMessage(
        "Firebase failed to load. Check index.html Firebase setup."
    );
}


/* =========================================================
   SIGN OUT
========================================================= */

if (signOutBtn) {

    signOutBtn.addEventListener(
        "click",
        async () => {

            try {

                if (guestMode) {

                    guestMode = false;
                    currentUser = null;
                    currentChatId = null;
                    currentMessages = [];

                    clearMessages();

                    showGateway();

                    return;
                }

                if (auth) {
                    await auth.signOut();
                }

                currentUser = null;
                guestMode = false;

                currentChatId = null;
                currentMessages = [];

                clearMessages();

                showGateway();

            } catch (error) {

                console.error(
                    "Sign out error:",
                    error
                );
            }
        }
    );
}


/* =========================================================
   CHAT CREATION
========================================================= */

function createChatObject() {

    const now = Date.now();

    return {

        id:
            "chat_" +
            now +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 8),

        title: "New chat",

        messages: [],

        createdAt: now,

        updatedAt: now
    };
}


function createChat(save = true) {

    const chat =
        createChatObject();

    currentChatId =
        chat.id;

    currentMessages = [];

    clearMessages();

    if (guestMode) {

        const chats =
            getGuestChats();

        chats.unshift(chat);

        saveGuestChats(chats);

    } else if (save) {

        saveCurrentChat();
    }

    renderChatList();
}


if (newChatBtn) {

    newChatBtn.addEventListener(
        "click",
        () => {
            createChat(true);
        }
    );
}


/* =========================================================
   MESSAGE DISPLAY
========================================================= */

function clearMessages() {

    if (messages) {
        messages.innerHTML = "";
    }

    if (welcome) {
        welcome.classList.remove("hidden");
    }
}


function hideWelcome() {

    if (welcome) {
        welcome.classList.add("hidden");
    }
}


function addMessage(role, content) {

    if (!messages) {
        return;
    }

    hideWelcome();

    const row =
        document.createElement("div");

    row.className =
        role === "user"
            ? "message user"
            : "message ai";

    const bubble =
        document.createElement("div");

    bubble.className =
        "message-content";

    if (role === "user") {

        bubble.textContent =
            text(content);

    } else {

        bubble.innerHTML =
            formatAIText(content);
    }

    row.appendChild(bubble);

    messages.appendChild(row);

    const chatArea =
        document.getElementById("chatArea");

    if (chatArea) {

        chatArea.scrollTop =
            chatArea.scrollHeight;
    }
}


function addThinking() {

    if (!messages) {
        return null;
    }

    hideWelcome();

    const row =
        document.createElement("div");

    row.className =
        "message ai thinking-message";

    const bubble =
        document.createElement("div");

    bubble.className =
        "message-content";

    bubble.textContent =
        "Thinking...";

    row.appendChild(bubble);

    messages.appendChild(row);

    const chatArea =
        document.getElementById("chatArea");

    if (chatArea) {
        chatArea.scrollTop =
            chatArea.scrollHeight;
    }

    return row;
}


/* =========================================================
   GUEST STORAGE
========================================================= */

function getGuestChats() {

    try {

        const raw =
            localStorage.getItem(
                "codeai_guest_chats"
            );

        if (!raw) {
            return [];
        }

        const data =
            JSON.parse(raw);

        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.error(
            "Guest storage error:",
            error
        );

        return [];
    }
}


function saveGuestChats(chats) {

    try {

        localStorage.setItem(
            "codeai_guest_chats",
            JSON.stringify(chats)
        );

    } catch (error) {

        console.error(
            "Guest save error:",
            error
        );
    }
}


function loadGuestChats() {

    const chats =
        getGuestChats();

    chats.sort(
        (a, b) =>
            (b.updatedAt || 0) -
            (a.updatedAt || 0)
    );

    if (chats.length > 0) {

        loadChat(chats[0]);

    } else {

        createChat(false);
    }

    renderChatList();
}


/* =========================================================
   FIRESTORE
========================================================= */

function chatsCollection() {

    if (!db || !currentUser) {
        return null;
    }

    return db
        .collection("users")
        .doc(currentUser.uid)
        .collection("chats");
}


async function loadCloudChats() {

    if (!db || !currentUser) {
        return;
    }

    try {

        const snapshot =
            await chatsCollection()
                .orderBy(
                    "updatedAt",
                    "desc"
                )
                .limit(50)
                .get();

        cloudChats = [];

        snapshot.forEach(
            (doc) => {

                const data =
                    doc.data();

                cloudChats.push({

                    id: doc.id,

                    title:
                        data.title ||
                        "New chat",

                    messages:
                        Array.isArray(
                            data.messages
                        )
                            ? data.messages
                            : [],

                    createdAt:
                        data.createdAt ||
                        Date.now(),

                    updatedAt:
                        data.updatedAt ||
                        Date.now()
                });
            }
        );

        if (cloudChats.length > 0) {

            loadChat(
                cloudChats[0]
            );

        } else {

            createChat(false);
        }

        renderChatList();

    } catch (error) {

        console.error(
            "Firestore load error:",
            error
        );

        cloudChats = [];

        createChat(false);
    }
}


/* =========================================================
   LOAD CHAT
========================================================= */

function loadChat(chat) {

    if (!chat) {
        return;
    }

    currentChatId =
        chat.id;

    currentMessages =
        Array.isArray(chat.messages)
            ? chat.messages
            : [];

    clearMessages();

    if (currentMessages.length > 0) {

        currentMessages.forEach(
            (item) => {

                addMessage(
                    item.role === "user"
                        ? "user"
                        : "assistant",
                    item.content
                );
            }
        );
    }

    renderChatList();
}


/* =========================================================
   SAVE CHAT
========================================================= */

async function saveCurrentChat() {

    if (!currentChatId) {
        return;
    }

    const firstUserMessage =
        currentMessages.find(
            (item) =>
                item.role === "user"
        );

    const title =
        firstUserMessage
            ? createChatTitle(
                firstUserMessage.content
            )
            : "New chat";

    const chat = {

        id: currentChatId,

        title: title,

        messages: currentMessages,

        updatedAt: Date.now()
    };


    /* GUEST */

    if (guestMode) {

        const chats =
            getGuestChats();

        const index =
            chats.findIndex(
                (item) =>
                    item.id ===
                    currentChatId
            );

        if (index >= 0) {

            chats[index] = {
                ...chats[index],
                ...chat
            };

        } else {

            chats.push(chat);
        }

        saveGuestChats(chats);

        renderChatList();

        return;
    }


    /* GOOGLE USER */

    if (!db || !currentUser) {
        return;
    }

    try {

        await chatsCollection()
            .doc(currentChatId)
            .set(
                {
                    title: chat.title,

                    messages:
                        chat.messages,

                    updatedAt:
                        chat.updatedAt
                },
                {
                    merge: true
                }
            );

        const index =
            cloudChats.findIndex(
                (item) =>
                    item.id ===
                    currentChatId
            );

        if (index >= 0) {

            cloudChats[index] = {
                ...cloudChats[index],
                ...chat
            };

        } else {

            cloudChats.push(chat);
        }

        renderChatList();

    } catch (error) {

        console.error(
            "Firestore save error:",
            error
        );
    }
}


function createChatTitle(value) {

    let title =
        text(value)
            .replace(/\s+/g, " ")
            .trim();

    if (!title) {
        return "New chat";
    }

    if (title.length > 35) {

        title =
            title.substring(0, 35) +
            "...";
    }

    return title;
}


/* =========================================================
   CHAT LIST
========================================================= */

function renderChatList() {

    if (!chatList) {
        return;
    }

    chatList.innerHTML = "";

    const chats =
        guestMode
            ? getGuestChats()
            : cloudChats;

    chats.sort(
        (a, b) =>
            (b.updatedAt || 0) -
            (a.updatedAt || 0)
    );

    chats.forEach(
        (chat) => {

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.className =
                "chat-list-item";

            if (
                chat.id ===
                currentChatId
            ) {
                button.classList.add(
                    "active"
                );
            }

            button.textContent =
                chat.title ||
                "New chat";

            button.addEventListener(
                "click",
                () => {
                    loadChat(chat);
                }
            );

            chatList.appendChild(
                button
            );
        }
    );
}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

    if (
        sending ||
        !messageInput
    ) {
        return;
    }

    const value =
        messageInput.value.trim();

    if (!value) {
        return;
    }

    if (!currentChatId) {
        createChat(false);
    }

    sending = true;

    messageInput.value = "";

    autoResize();

    currentMessages.push({
        role: "user",
        content: value
    });

    addMessage(
        "user",
        value
    );

    await saveCurrentChat();

    const thinking =
        addThinking();

    try {

        const history =
            currentMessages
                .slice(-20)
                .map(
                    (item) => ({
                        role:
                            item.role ===
                            "assistant"
                                ? "assistant"
                                : "user",

                        content:
                            text(
                                item.content
                            )
                    })
                );

        const response =
            await fetch(
                BACKEND_URL + "/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            message: value,

                            language:
                                "general",

                            history:
                                history
                        })
                }
            );

        if (!response.ok) {

            throw new Error(
                "Backend returned HTTP " +
                response.status
            );
        }

        const data =
            await response.json();

        if (thinking) {
            thinking.remove();
        }

        const answer =
            data.answer ||
            data.response ||
            data.message ||
            data.content ||
            "I could not generate a response.";

        currentMessages.push({
            role: "assistant",
            content: text(answer)
        });

        addMessage(
            "assistant",
            answer
        );

        await saveCurrentChat();

    } catch (error) {

        if (thinking) {
            thinking.remove();
        }

        console.error(
            "CodeAI request error:",
            error
        );

        const errorText =
            "CodeAI error: " +
            text(
                error.message ||
                error
            );

        currentMessages.push({
            role: "assistant",
            content: errorText
        });

        addMessage(
            "assistant",
            errorText
        );

        await saveCurrentChat();

    } finally {

        sending = false;

        if (messageInput) {
            messageInput.focus();
        }
    }
}


/* =========================================================
   SEND BUTTON
========================================================= */

if (sendBtn) {

    sendBtn.addEventListener(
        "click",
        sendMessage
    );
}


/* =========================================================
   ENTER KEY
========================================================= */

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        (event) => {

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

    if (!messageInput) {
        return;
    }

    messageInput.style.height =
        "auto";

    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            180
        ) + "px";
}


/* =========================================================
   FILE ATTACHMENT
========================================================= */

function chooseFile(input) {

    if (!input) {
        return;
    }

    input.click();
}


if (attachBtn) {

    attachBtn.addEventListener(
        "click",
        () => {
            chooseFile(fileInput);
        }
    );
}


if (cameraBtn) {

    cameraBtn.addEventListener(
        "click",
        () => {
            chooseFile(imageInput);
        }
    );
}


function handleFile(file) {

    if (!file) {
        return;
    }

    selectedFile = file;

    if (attachmentName) {
        attachmentName.textContent =
            file.name;
    }

    if (attachmentType) {
        attachmentType.textContent =
            file.type ||
            "File";
    }

    if (attachmentPreview) {
        attachmentPreview.classList.remove(
            "hidden"
        );
    }
}


if (fileInput) {

    fileInput.addEventListener(
        "change",
        (event) => {

            const file =
                event.target.files[0];

            handleFile(file);
        }
    );
}


if (imageInput) {

    imageInput.addEventListener(
        "change",
        (event) => {

            const file =
                event.target.files[0];

            handleFile(file);
        }
    );
}


if (cameraInput) {

    cameraInput.addEventListener(
        "change",
        (event) => {

            const file =
                event.target.files[0];

            handleFile(file);
        }
    );
}


if (removeAttachmentBtn) {

    removeAttachmentBtn.addEventListener(
        "click",
        () => {

            selectedFile = null;

            if (fileInput) {
                fileInput.value = "";
            }

            if (imageInput) {
                imageInput.value = "";
            }

            if (cameraInput) {
                cameraInput.value = "";
            }

            if (attachmentPreview) {
                attachmentPreview.classList.add(
                    "hidden"
                );
            }
        }
    );
}


/* =========================================================
   MICROPHONE
========================================================= */

if (micBtn) {

    micBtn.addEventListener(
        "click",
        () => {

            const SpeechRecognition =
                window.SpeechRecognition ||
                window.webkitSpeechRecognition;

            if (!SpeechRecognition) {

                alert(
                    "Voice input is not supported in this browser."
                );

                return;
            }

            const recognition =
                new SpeechRecognition();

            recognition.lang =
                "en-IN";

            recognition.interimResults =
                false;

            recognition.maxAlternatives =
                1;

            micBtn.disabled = true;

            recognition.start();

            recognition.onresult =
                (event) => {

                    const spoken =
                        event
                            .results[0][0]
                            .transcript;

                    if (messageInput) {

                        messageInput.value +=
                            (
                                messageInput.value
                                    ? " "
                                    : ""
                            ) + spoken;

                        autoResize();

                        messageInput.focus();
                    }
                };

            recognition.onerror =
                (error) => {

                    console.error(
                        "Microphone error:",
                        error
                    );
                };

            recognition.onend =
                () => {

                    micBtn.disabled =
                        false;
                };
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
                "VARAD WANSAGAR sir created me."
            );
        }
    );
}


/* =========================================================
   MOBILE MENU
========================================================= */

if (menuBtn) {

    menuBtn.addEventListener(
        "click",
        () => {

            const sidebar =
                document.querySelector(
                    ".sidebar"
                );

            if (sidebar) {

                sidebar.classList.toggle(
                    "open"
                );
            }
        }
    );
}


/* =========================================================
   QUICK ACTIONS
========================================================= */

document
    .querySelectorAll(".quick-card")
    .forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    if (!messageInput) {
                        return;
                    }

                    const title =
                        button
                            .querySelector(
                                "strong"
                            )
                            ?.textContent ||
                        "";

                    const prompts = {

                        Code:
                            "Help me write and debug some code.",

                        Learn:
                            "Teach me something clearly and step by step.",

                        Analyze:
                            "Help me analyze this.",

                        Create:
                            "Help me create something new."
                    };

                    messageInput.value =
                        prompts[title] ||
                        "";

                    autoResize();

                    messageInput.focus();
                }
            );
        }
    );


/* =========================================================
   BACKEND HEALTH
========================================================= */

async function checkBackend() {

    try {

        const response =
            await fetch(
                BACKEND_URL +
                "/health"
            );

        if (!response.ok) {
            throw new Error(
                "Backend offline"
            );
        }

        console.log(
            "CODEAI BACKEND: ONLINE"
        );

    } catch (error) {

        console.warn(
            "CODEAI BACKEND CHECK FAILED:",
            error
        );
    }
}


/* =========================================================
   START
========================================================= */

showGateway();

checkBackend();

console.log(
    "======================================"
);

console.log(
    "          CODEAI FRONTEND"
);

console.log(
    "          VERSION: CLEAN"
);

console.log(
    "          GOOGLE AUTH READY"
);

console.log(
    "======================================"
);