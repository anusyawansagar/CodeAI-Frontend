"use strict";

/*
=========================================================
CODEAI FRONTEND
CLEAN STABLE VERSION
=========================================================
*/

const BACKEND_URL =
    "https://codeai-backend-0y6t.onrender.com";


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

let firebaseAuth = null;
let firebaseDB = null;
let googleProvider = null;


/* =========================================================
   START AFTER HTML LOADS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    console.log("🚀 CodeAI JavaScript started");

    initCodeAI();

});


/* =========================================================
   MAIN INITIALIZATION
========================================================= */

function initCodeAI() {

    /*
    Get Firebase.
    Firebase scripts must be loaded by index.html.
    */

    if (typeof firebase !== "undefined") {

        try {

            /*
            Use existing Firebase app if available.
            Otherwise use the initialized app.
            */

            if (firebase.apps.length > 0) {

                firebaseAuth =
                    firebase.auth();

                firebaseDB =
                    firebase.firestore();

                googleProvider =
                    new firebase.auth.GoogleAuthProvider();

                console.log(
                    "🔥 Firebase ready"
                );

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

    console.log(
        "✅ CodeAI ready"
    );

}


/* =========================================================
   ELEMENT HELPER
========================================================= */

function get(id) {
    return document.getElementById(id);
}


/* =========================================================
   SHOW / HIDE SCREENS
========================================================= */

function showGateway() {

    const gateway =
        get("accountGateway");

    const app =
        get("app");

    if (gateway) {
        gateway.classList.remove("hidden");
    }

    if (app) {
        app.classList.add("hidden");
    }

}


function showApp() {

    const gateway =
        get("accountGateway");

    const app =
        get("app");

    if (gateway) {
        gateway.classList.add("hidden");
    }

    if (app) {
        app.classList.remove("hidden");
    }

}


/* =========================================================
   ACCOUNT GATEWAY
========================================================= */

function setupGateway() {

    const googleButton =
        get("googleLoginBtn");

    const guestButton =
        get("guestBtn");


    /* -----------------------------------------------------
       GUEST
    ----------------------------------------------------- */

    if (guestButton) {

        guestButton.addEventListener(
            "click",
            function (event) {

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


    /* -----------------------------------------------------
       GOOGLE
    ----------------------------------------------------- */

    if (googleButton) {

        googleButton.addEventListener(
            "click",
            function (event) {

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

        const input =
            get("messageInput");

        if (input) {
            input.focus();
        }

    }, 200);

}


/* =========================================================
   GOOGLE LOGIN
========================================================= */

async function loginWithGoogle() {

    const button =
        get("googleLoginBtn");


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
            error.code ===
            "auth/popup-blocked"
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
        async (user) => {

            console.log(
                "Auth state:",
                user
                    ? user.email
                    : "signed out"
            );


            if (user) {

                currentUser =
                    user;

                isGuest =
                    false;


                localStorage.removeItem(
                    "codeai_guest"
                );


                showApp();

                updateAccountUI();

                await loadCloudChat();


            }

        }
    );

}


/* =========================================================
   ACCOUNT UI
========================================================= */

function updateAccountUI() {

    const name =
        get("accountName");

    const type =
        get("accountType");

    const avatar =
        get("accountAvatar");


    if (
        currentUser &&
        !isGuest
    ) {

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

        name.textContent =
            "Guest";

    }


    if (type) {

        type.textContent =
            "Guest Mode";

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

    const button =
        get("signOutBtn");

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
            JSON.stringify(
                chatHistory
            )
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


            if (
                Array.isArray(parsed)
            ) {

                chatHistory =
                    parsed;

            } else {

                chatHistory =
                    [];

            }

        } else {

            chatHistory =
                [];

        }


    } catch (error) {

        console.error(
            "Guest load error:",
            error
        );

        chatHistory =
            [];

    }


    renderMessages();

}


/* =========================================================
   CLOUD CHAT
========================================================= */

async function saveCloudChat() {

    if (
        !currentUser ||
        isGuest ||
        !firebaseDB
    ) {

        return;

    }


    try {

        if (!currentChatId) {

            currentChatId =
                firebaseDB
                    .collection("users")
                    .doc(currentUser.uid)
                    .collection("chats")
                    .doc()
                    .id;

        }


        await firebaseDB
            .collection("users")
            .doc(currentUser.uid)
            .collection("chats")
            .doc(currentChatId)
            .set(
                {
                    messages:
                        cleanHistory(),

                    title:
                        createChatTitle(),

                    updatedAt:
                        firebase.firestore.FieldValue.serverTimestamp()

                },
                {
                    merge: true
                }
            );


        console.log(
            "☁️ Chat saved to Firestore"
        );


    } catch (error) {

        console.error(
            "❌ Firestore save error:",
            error
        );

    }

}


/* =========================================================
   LOAD CLOUD CHAT
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

        /*
        We intentionally do NOT use orderBy().
        This avoids problems with old documents
        that may not have updatedAt.
        */

        const snapshot =
            await firebaseDB
                .collection("users")
                .doc(currentUser.uid)
                .collection("chats")
                .limit(20)
                .get();


        if (
            snapshot.empty
        ) {

            chatHistory =
                [];

            currentChatId =
                null;

            renderMessages();

            return;

        }


        let newestDoc =
            null;


        snapshot.forEach(
            (doc) => {

                if (!newestDoc) {

                    newestDoc =
                        doc;

                    return;

                }


                const current =
                    doc.data();

                const newest =
                    newestDoc.data();


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

                    newestDoc =
                        doc;

                }

            }
        );


        if (newestDoc) {

            const data =
                newestDoc.data();


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


        console.log(
            "☁️ Cloud chat loaded"
        );


    } catch (error) {

        console.error(
            "❌ Firestore load error:",
            error
        );

        chatHistory =
            [];

        renderMessages();

    }

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
   CHAT TITLE
========================================================= */

function createChatTitle() {

    const first =
        chatHistory.find(
            item =>
                item.role === "user"
        );


    if (!first) {

        return "New Chat";

    }


    let title =
        first.content
            .replace(/\s+/g, " ")
            .trim();


    if (title.length > 45) {

        title =
            title.substring(0, 45) +
            "...";

    }


    return title ||
        "New Chat";

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

    chatHistory =
        [];

    currentChatId =
        null;


    const messages =
        get("messages");

    const welcome =
        get("welcome");


    if (messages) {

        messages.innerHTML =
            "";

    }


    if (welcome) {

        welcome.classList.remove(
            "hidden"
        );

    }


    clearAttachment();


    if (isGuest) {

        saveGuestChat();

    }


    const input =
        get("messageInput");

    if (input) {

        input.value =
            "";

        input.focus();

    }

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


    isSending =
        true;


    input.value =
        "";

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


    chatHistory.push(
        {
            role:
                "user",

            content:
                displayText
        }
    );


    hideWelcome();

    addMessage(
        "user",
        displayText
    );


    if (isGuest) {

        saveGuestChat();

    }


    /*
    Attachment mode
    */

    if (
        selectedImage ||
        (
            selectedFile &&
            selectedFile.type
                .startsWith("image/")
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


        isSending =
            false;

        return;

    }


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


        isSending =
            false;

        return;

    }


    if (selectedFile) {

        const file =
            selectedFile;


        clearAttachment();


        await processFile(
            file,
            text
        );


        isSending =
            false;

        return;

    }


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
                    method:
                        "POST",

                    headers:
                        {
                            "Content-Type":
                                "application/json"
                        },

                    body:
                        JSON.stringify(
                            {
                                message:
                                    text,

                                language:
                                    language,

                                history:
                                    cleanHistory()
                            }
                        )
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


        chatHistory.push(
            {
                role:
                    "assistant",

                content:
                    reply
            }
        );


        addMessage(
            "assistant",
            reply
        );


        if (isGuest) {

            saveGuestChat();

        } else {

            await saveCloudChat();

        }


    } catch (error) {

        console.error(
            "❌ Chat error:",
            error
        );


        removeTyping();


        const errorText =
            "Sorry bro, CodeAI couldn't connect to the AI server right now.";


        chatHistory.push(
            {
                role:
                    "assistant",

                content:
                    errorText
            }
        );


        addMessage(
            "assistant",
            errorText
        );


        if (isGuest) {

            saveGuestChat();

        } else {

            await saveCloudChat();

        }

    }


    isSending =
        false;

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

        welcome.classList.add(
            "hidden"
        );

    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        `message ${
            role === "user"
                ? "user-message"
                : "assistant-message"
        }`;


    const bubble =
        document.createElement(
            "div"
        );


    bubble.className =
        "message-bubble";


    if (role === "assistant") {

        bubble.innerHTML =
            formatAIText(
                content
            );

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


    container.innerHTML =
        "";


    if (
        !chatHistory ||
        !chatHistory.length
    ) {

        if (welcome) {

            welcome.classList.remove(
                "hidden"
            );

        }

        return;

    }


    if (welcome) {

        welcome.classList.add(
            "hidden"
        );

    }


    chatHistory.forEach(
        message => {

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

        welcome.classList.add(
            "hidden"
        );

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
        document.createElement(
            "div"
        );


    wrapper.id =
        "codeaiTyping";


    wrapper.className =
        "message assistant-message";


    const bubble =
        document.createElement(
            "div"
        );


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


    setTimeout(
        () => {

            container.scrollTop =
                container.scrollHeight;

        },
        30
    );

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

    selectedFile =
        null;

    selectedImage =
        null;


    const fileInput =
        get("fileInput");

    const cameraInput =
        get("cameraInput");

    const imageInput =
        get("imageInput");


    if (fileInput) {
        fileInput.value =
            "";
    }

    if (cameraInput) {
        cameraInput.value =
            "";
    }

    if (imageInput) {
        imageInput.value =
            "";
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

        name.textContent =
            "";

    }


    const type =
        get("attachmentType");


    if (type) {

        type.textContent =
            "";

    }

}


/* =========================================================
   IMAGE
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
                "Analyze this image."
        );


        const response =
            await fetch(
                `${BACKEND_URL}/vision`,
                {
                    method:
                        "POST",

                    body:
                        form
                }
            );


        if (!response.ok) {

            throw new Error(
                `Vision server returned ${response.status}`
            );

        }


        const data =
            await response.json();


        removeTyping();


        const reply =
            data.reply ||
            data.response ||
            data.description ||
            "Image analyzed.";


        chatHistory.push(
            {
                role:
                    "assistant",

                content:
                    reply
            }
        );


        addMessage(
            "assistant",
            reply
        );


        await saveCurrentChat();


    } catch (error) {

        removeTyping();


        console.error(
            "Image error:",
            error
        );


        addMessage(
            "assistant",
            "I couldn't analyze that image."
        );

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


        form.append(
            "message",
            question ||
                "Read and summarize this PDF."
        );


        const response =
            await fetch(
                `${BACKEND_URL}/read-pdf`,
                {
                    method:
                        "POST",

                    body:
                        form
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


        const reply =
            data.reply ||
            data.response ||
            data.text ||
            "PDF processed.";


        chatHistory.push(
            {
                role:
                    "assistant",

                content:
                    reply
            }
        );


        addMessage(
            "assistant",
            reply
        );


        await saveCurrentChat();


    } catch (error) {

        removeTyping();


        console.error(
            "PDF error:",
            error
        );


        addMessage(
            "assistant",
            "I couldn't read that PDF."
        );

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


        form.append(
            "message",
            question ||
                "Read this file and explain it."
        );


        const response =
            await fetch(
                `${BACKEND_URL}/read-file`,
                {
                    method:
                        "POST",

                    body:
                        form
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


        const reply =
            data.reply ||
            data.response ||
            data.text ||
            "File processed.";


        chatHistory.push(
            {
                role:
                    "assistant",

                content:
                    reply
            }
        );


        addMessage(
            "assistant",
            reply
        );


        await saveCurrentChat();


    } catch (error) {

        removeTyping();


        console.error(
            "File error:",
            error
        );


        addMessage(
            "assistant",
            "I couldn't read that file."
        );

    }

}


/* =========================================================
   SAVE CURRENT CHAT
========================================================= */

async function saveCurrentChat() {

    if (isGuest) {

        saveGuestChat();

    } else {

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
        (error) => {

            console.error(
                "Microphone error:",
                error
            );

            button.classList.remove(
                "active"
            );

        };


    recognition.onresult =
        (event) => {

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
                    ) + text;


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
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        input.value =
                            button.textContent
                                .trim();

                        autoResize();

                        input.focus();

                    }
                );

            }
        );

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


    value =
        escapeHTML(value);


    /*
    Code blocks
    */

    value =
        value.replace(
            /```([a-zA-Z0-9+#._-]*)\n?([\s\S]*?)```/g,
            function (
                match,
                language,
                code
            ) {

                const lang =
                    language ||
                    "code";


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
                        <pre><code>${code.trim()}</code></pre>
                    </div>
                `;

            }
        );


    /*
    Bold
    */

    value =
        value.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    /*
    Inline code
    */

    value =
        value.replace(
            /`([^`]+)`/g,
            '<code class="inline-code">$1</code>'
        );


    /*
    New lines
    */

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
            button
                .closest(
                    ".code-block"
                );


        const code =
            block
                ?.querySelector(
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