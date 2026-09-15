"use strict";

/* =========================================================
   CODEAI - MASTER FRONTEND
   Files + Folders + Images + PDFs + Videos + PDF Creator
   Google Login + Guest Mode + Firestore + Chat
   ========================================================= */

const BACKEND_URL = "https://codeai-backend-0y6t.onrender.com";

/* =========================================================
   DOM
   ========================================================= */

const gateway = document.getElementById("accountGateway");
const app = document.getElementById("app");

const googleLoginBtn = document.getElementById("googleLoginBtn");
const guestBtn = document.getElementById("guestBtn");

const accountName = document.getElementById("accountName");
const accountType = document.getElementById("accountType");
const accountAvatar = document.getElementById("accountAvatar");
const signOutBtn = document.getElementById("signOutBtn");

const newChatBtn = document.getElementById("newChatBtn");
const messages = document.getElementById("messages");
const welcome = document.getElementById("welcome");

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

const languageSelect =
    document.getElementById("languageSelect");

const aboutBtn =
    document.getElementById("aboutBtn");

const menuBtn =
    document.getElementById("menuBtn");


/* =========================================================
   FIREBASE
   ========================================================= */

const firebaseReady =
    typeof firebase !== "undefined" &&
    typeof window.firebaseAuth !== "undefined";

const auth =
    firebaseReady
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

let currentChatId = null;

let currentChat = [];

let selectedFiles = [];

let isSending = false;

let recognition = null;


/* =========================================================
   STORAGE
   ========================================================= */

const GUEST_STORAGE_KEY =
    "codeai_guest_chats";

function loadGuestChats() {

    try {

        return JSON.parse(
            localStorage.getItem(GUEST_STORAGE_KEY)
        ) || {};

    } catch {

        return {};

    }
}

function saveGuestChats(chats) {

    localStorage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify(chats)
    );
}


/* =========================================================
   HTML SAFETY
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
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
   UI
   ========================================================= */

function showGateway() {

    if (gateway) {
        gateway.classList.remove("hidden");
    }

    if (app) {
        app.classList.add("hidden");
    }
}


function showApp() {

    if (gateway) {
        gateway.classList.add("hidden");
    }

    if (app) {
        app.classList.remove("hidden");
    }
}


function scrollBottom() {

    if (messages) {

        messages.scrollTop =
            messages.scrollHeight;

    }
}


function hideWelcome() {

    if (welcome) {
        welcome.style.display = "none";
    }
}


function showWelcome() {

    if (welcome) {
        welcome.style.display = "";
    }
}


/* =========================================================
   MESSAGE UI
   ========================================================= */

function addMessage(role, text, extra = {}) {

    hideWelcome();

    const wrapper =
        document.createElement("div");

    wrapper.className =
        `message ${role}`;

    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";

    if (role === "user") {

        bubble.innerHTML =
            formatAIText(text);

    } else {

        bubble.innerHTML =
            formatAIText(text);

    }

    wrapper.appendChild(bubble);

    if (extra.files && extra.files.length) {

        const filesBox =
            document.createElement("div");

        filesBox.className =
            "message-files";

        extra.files.forEach(file => {

            const item =
                document.createElement("div");

            item.className =
                "message-file";

            item.textContent =
                `📎 ${file.name}`;

            filesBox.appendChild(item);

        });

        wrapper.appendChild(filesBox);
    }

    messages.appendChild(wrapper);

    scrollBottom();

    return wrapper;
}


function addThinking() {

    hideWelcome();

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "message assistant";

    wrapper.id =
        "codeai-thinking";

    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";

    bubble.innerHTML =
        "CodeAI is thinking...";

    wrapper.appendChild(bubble);

    messages.appendChild(wrapper);

    scrollBottom();

    return wrapper;
}


function removeThinking() {

    const item =
        document.getElementById(
            "codeai-thinking"
        );

    if (item) {
        item.remove();
    }
}


/* =========================================================
   CHAT ID
   ========================================================= */

function createChatId() {

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .substring(2, 10)
    );
}


/* =========================================================
   CHAT TITLE
   ========================================================= */

function makeChatTitle(text) {

    const clean =
        String(text || "")
            .replace(/\s+/g, " ")
            .trim();

    if (!clean) {
        return "New Chat";
    }

    return clean.length > 35
        ? clean.substring(0, 35) + "..."
        : clean;
}


/* =========================================================
   LOCAL CHAT SAVE
   ========================================================= */

function saveGuestChat() {

    if (!guestMode || !currentChatId) {
        return;
    }

    const chats =
        loadGuestChats();

    chats[currentChatId] = {

        id: currentChatId,

        title:
            currentChat[0]?.text
                ? makeChatTitle(
                    currentChat[0].text
                )
                : "New Chat",

        messages:
            currentChat,

        updatedAt:
            Date.now()
    };

    saveGuestChats(chats);
}


/* =========================================================
   FIRESTORE
   ========================================================= */

async function saveCloudChat() {

    if (!currentUser || !db || !currentChatId) {
        return;
    }

    try {

        await db
            .collection("users")
            .doc(currentUser.uid)
            .collection("chats")
            .doc(currentChatId)
            .set({

                title:
                    currentChat[0]?.text
                        ? makeChatTitle(
                            currentChat[0].text
                        )
                        : "New Chat",

                messages:
                    currentChat,

                updatedAt:
                    firebase.firestore.FieldValue
                        .serverTimestamp()

            }, {
                merge: true
            });

    } catch (error) {

        console.error(
            "Firestore save error:",
            error
        );

    }
}


async function loadCloudChats() {

    if (!currentUser || !db) {
        return [];
    }

    try {

        const snapshot =
            await db
                .collection("users")
                .doc(currentUser.uid)
                .collection("chats")
                .orderBy(
                    "updatedAt",
                    "desc"
                )
                .get();

        return snapshot.docs.map(
            doc => ({
                id: doc.id,
                ...doc.data()
            })
        );

    } catch (error) {

        console.error(
            "Firestore load error:",
            error
        );

        return [];

    }
}


/* =========================================================
   NEW CHAT
   ========================================================= */

function startNewChat() {

    currentChatId =
        createChatId();

    currentChat = [];

    if (messages) {
        messages.innerHTML = "";
    }

    showWelcome();

    clearAttachments();
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

    currentChat =
        chat.messages || [];

    if (messages) {
        messages.innerHTML = "";
    }

    if (!currentChat.length) {

        showWelcome();

        return;
    }

    hideWelcome();

    currentChat.forEach(item => {

        addMessage(
            item.role,
            item.text,
            {
                files:
                    item.files || []
            }
        );

    });
}


/* =========================================================
   ACCOUNT UI
   ========================================================= */

function updateAccountUI(user) {

    if (!user) {

        if (accountName) {
            accountName.textContent =
                "Guest";
        }

        if (accountType) {
            accountType.textContent =
                "Guest Mode";
        }

        if (accountAvatar) {
            accountAvatar.textContent =
                "G";
        }

        return;
    }

    if (accountName) {

        accountName.textContent =
            user.displayName ||
            "Google User";

    }

    if (accountType) {
        accountType.textContent =
            "Google Account";
    }

    if (accountAvatar) {

        if (user.photoURL) {

            accountAvatar.innerHTML =
                `<img src="${escapeHTML(
                    user.photoURL
                )}" alt="Account">`;

        } else {

            accountAvatar.textContent =
                (
                    user.displayName ||
                    "G"
                )
                .charAt(0)
                .toUpperCase();

        }
    }
}


/* =========================================================
   GOOGLE LOGIN
   ========================================================= */

async function loginWithGoogle() {

    if (!auth || !googleProvider) {

        alert(
            "Firebase is not configured correctly."
        );

        return;
    }

    try {

        const result =
            await auth.signInWithPopup(
                googleProvider
            );

        currentUser =
            result.user;

        guestMode = false;

        updateAccountUI(
            currentUser
        );

        showApp();

        startNewChat();

        console.log(
            "Google login successful:",
            currentUser.email
        );

    } catch (error) {

        console.error(
            "Google login error:",
            error
        );

        alert(
            "Google login failed: " +
            error.message
        );
    }
}


/* =========================================================
   GUEST
   ========================================================= */

function enterGuestMode() {

    currentUser = null;

    guestMode = true;

    updateAccountUI(null);

    showApp();

    startNewChat();
}


/* =========================================================
   SIGN OUT
   ========================================================= */

async function signOut() {

    try {

        if (auth && currentUser) {
            await auth.signOut();
        }

    } catch (error) {

        console.error(
            "Sign out error:",
            error
        );

    }

    currentUser = null;

    guestMode = false;

    currentChat = [];

    currentChatId = null;

    showGateway();
}


/* =========================================================
   FILE HELPERS
   ========================================================= */

function getFileExtension(name) {

    const parts =
        String(name)
            .split(".");

    return parts.length > 1
        ? parts.pop().toLowerCase()
        : "";
}


function isImageFile(file) {

    return (
        file.type.startsWith("image/")
        ||
        [
            "png",
            "jpg",
            "jpeg",
            "webp",
            "gif"
        ].includes(
            getFileExtension(file.name)
        )
    );
}


function isVideoFile(file) {

    return (
        file.type.startsWith("video/")
        ||
        [
            "mp4",
            "webm",
            "mov",
            "avi",
            "mkv"
        ].includes(
            getFileExtension(file.name)
        )
    );
}


function isPDF(file) {

    return (
        file.type === "application/pdf"
        ||
        getFileExtension(file.name) === "pdf"
    );
}


function isTextFile(file) {

    const ext =
        getFileExtension(file.name);

    return (
        file.type.startsWith("text/")
        ||
        [
            "txt",
            "md",
            "csv",
            "json",
            "xml",
            "html",
            "htm",
            "css",
            "js",
            "jsx",
            "ts",
            "tsx",
            "py",
            "java",
            "cpp",
            "c",
            "h",
            "hpp",
            "cs",
            "php",
            "sql",
            "sh",
            "bat",
            "ps1",
            "yaml",
            "yml",
            "ini",
            "log"
        ].includes(ext)
    );
}


/* =========================================================
   FILE PREVIEW
   ========================================================= */

function updateAttachmentPreview() {

    if (!attachmentPreview) {
        return;
    }

    if (!selectedFiles.length) {

        attachmentPreview.classList.add(
            "hidden"
        );

        return;
    }

    attachmentPreview.classList.remove(
        "hidden"
    );

    if (attachmentName) {

        attachmentName.textContent =
            selectedFiles.length === 1
                ? selectedFiles[0].name
                : `${selectedFiles.length} files selected`;

    }

    if (attachmentType) {

        attachmentType.textContent =
            selectedFiles
                .map(file =>
                    getFriendlyFileType(file)
                )
                .join(", ");

    }
}


function getFriendlyFileType(file) {

    if (isImageFile(file)) {
        return "Image";
    }

    if (isVideoFile(file)) {
        return "Video";
    }

    if (isPDF(file)) {
        return "PDF";
    }

    if (isTextFile(file)) {
        return "Text";
    }

    return file.type || "File";
}


/* =========================================================
   ATTACH FILES
   ========================================================= */

function addFiles(files) {

    if (!files || !files.length) {
        return;
    }

    for (const file of files) {

        const alreadyExists =
            selectedFiles.some(
                existing =>
                    existing.name === file.name &&
                    existing.size === file.size &&
                    existing.lastModified ===
                        file.lastModified
            );

        if (!alreadyExists) {
            selectedFiles.push(file);
        }
    }

    updateAttachmentPreview();
}


/* =========================================================
   CLEAR ATTACHMENTS
   ========================================================= */

function clearAttachments() {

    selectedFiles = [];

    if (fileInput) {
        fileInput.value = "";
    }

    if (cameraInput) {
        cameraInput.value = "";
    }

    if (imageInput) {
        imageInput.value = "";
    }

    updateAttachmentPreview();
}


/* =========================================================
   READ TEXT FILE
   ========================================================= */

async function readTextFile(file) {

    try {

        return await file.text();

    } catch (error) {

        console.error(
            "Text read error:",
            error
        );

        return "";

    }
}


/* =========================================================
   SEND FILE TO BACKEND
   ========================================================= */

async function sendFileToBackend(
    endpoint,
    file
) {

    const formData =
        new FormData();

    formData.append(
        "file",
        file
    );

    const response =
        await fetch(
            BACKEND_URL + endpoint,
            {
                method: "POST",
                body: formData
            }
        );

    if (!response.ok) {

        throw new Error(
            `File endpoint returned ${response.status}`
        );
    }

    return await response.json();
}


/* =========================================================
   PREPARE FILE CONTEXT
   ========================================================= */

async function prepareFilesForAI(files) {

    const fileContext = [];

    const visionFiles = [];

    const pdfFiles = [];

    const otherFiles = [];

    for (const file of files) {

        if (isTextFile(file)) {

            const text =
                await readTextFile(file);

            fileContext.push({
                name: file.name,
                type: "text",
                content: text
            });

            continue;
        }

        if (isImageFile(file)) {

            visionFiles.push(file);

            continue;
        }

        if (isPDF(file)) {

            pdfFiles.push(file);

            continue;
        }

        otherFiles.push(file);
    }


    /* -----------------------------------------------------
       PDF
       ----------------------------------------------------- */

    for (const file of pdfFiles) {

        try {

            const result =
                await sendFileToBackend(
                    "/read-file",
                    file
                );

            fileContext.push({

                name: file.name,

                type: "pdf",

                content:
                    result.text ||
                    result.content ||
                    result.extracted_text ||
                    ""

            });

        } catch (error) {

            console.error(
                "PDF read error:",
                error
            );

            fileContext.push({

                name: file.name,

                type: "pdf",

                content:
                    "[PDF could not be read by the backend.]"

            });
        }
    }


    /* -----------------------------------------------------
       IMAGES
       ----------------------------------------------------- */

    for (const file of visionFiles) {

        try {

            const base64 =
                await fileToBase64(file);

            const result =
                await fetch(
                    BACKEND_URL + "/vision",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                image:
                                    base64,

                                prompt:
                                    "Analyze this image carefully. Identify what is visible, read useful text when possible, describe important objects and explain the information clearly."
                            })
                    }
                );

            if (result.ok) {

                const data =
                    await result.json();

                fileContext.push({

                    name: file.name,

                    type: "image",

                    content:
                        data.answer ||
                        data.description ||
                        data.text ||
                        ""

                });

            } else {

                fileContext.push({

                    name: file.name,

                    type: "image",

                    content:
                        "[Image was attached, but the vision backend is not currently available.]"

                });
            }

        } catch (error) {

            console.error(
                "Vision error:",
                error
            );

            fileContext.push({

                name: file.name,

                type: "image",

                content:
                    "[Image attached. Vision processing failed.]"

            });
        }
    }


    /* -----------------------------------------------------
       OTHER FILES
       ----------------------------------------------------- */

    for (const file of otherFiles) {

        fileContext.push({

            name: file.name,

            type:
                isVideoFile(file)
                    ? "video"
                    : "file",

            content:
                `Attached file: ${file.name}. File type: ${file.type || "unknown"}. Size: ${formatBytes(file.size)}.`

        });
    }

    return fileContext;
}


/* =========================================================
   BASE64
   ========================================================= */

function fileToBase64(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onload = () => {

                resolve(
                    reader.result
                );

            };

            reader.onerror =
                reject;

            reader.readAsDataURL(file);

        }
    );
}


/* =========================================================
   FILE SIZE
   ========================================================= */

function formatBytes(bytes) {

    if (!bytes) {
        return "0 B";
    }

    const units =
        [
            "B",
            "KB",
            "MB",
            "GB"
        ];

    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );

    return (
        Math.round(
            bytes /
            Math.pow(
                1024,
                index
            ) * 100
        ) / 100
    ) + " " +
        units[
            Math.min(
                index,
                units.length - 1
            )
        ];
}


/* =========================================================
   CREATE FILE CONTEXT TEXT
   ========================================================= */

function buildFileContext(fileData) {

    if (!fileData.length) {
        return "";
    }

    let context =
        "\n\n===== ATTACHED FILES =====\n";

    fileData.forEach(
        (file, index) => {

            context +=
                `\nFILE ${index + 1}: ${file.name}\n`;

            context +=
                `TYPE: ${file.type}\n`;

            context +=
                "CONTENT:\n";

            context +=
                file.content || "[No readable content]";

            context +=
                "\n===== END FILE =====\n";
        }
    );

    return context;
}


/* =========================================================
   CHAT WITH BACKEND
   ========================================================= */

async function askCodeAI(
    userText,
    fileData
) {

    const history =
        currentChat.map(
            item => ({
                role:
                    item.role === "assistant"
                        ? "assistant"
                        : "user",

                content:
                    item.text
            })
        );

    const language =
        languageSelect
            ? languageSelect.value
            : "general";


    const combinedMessage =
        userText +
        buildFileContext(
            fileData
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

                        message:
                            combinedMessage,

                        language:
                            language,

                        history:
                            history

                    })

            }
        );


    if (!response.ok) {

        const errorText =
            await response.text();

        throw new Error(
            `Backend error ${response.status}: ${errorText}`
        );
    }


    const data =
        await response.json();


    return (
        data.response ||
        data.answer ||
        data.message ||
        "I couldn't generate a response."
    );
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

    if (isSending) {
        return;
    }

    const text =
        messageInput
            ? messageInput.value.trim()
            : "";

    if (!text && !selectedFiles.length) {
        return;
    }

    isSending = true;

    if (sendBtn) {
        sendBtn.disabled = true;
    }


    if (!currentChatId) {
        currentChatId =
            createChatId();
    }


    const filesForMessage =
        selectedFiles.map(
            file => ({
                name: file.name,
                size: file.size,
                type: file.type
            })
        );


    const displayText =
        text ||
        "Please analyze the attached files.";


    currentChat.push({

        role: "user",

        text:
            displayText,

        files:
            filesForMessage,

        timestamp:
            Date.now()

    });


    addMessage(
        "user",
        displayText,
        {
            files:
                filesForMessage
        }
    );


    if (messageInput) {
        messageInput.value = "";
    }


    const filesToProcess =
        [...selectedFiles];


    clearAttachments();


    const thinking =
        addThinking();


    try {

        const fileData =
            await prepareFilesForAI(
                filesToProcess
            );


        const answer =
            await askCodeAI(
                text ||
                "Analyze the attached files and help me.",
                fileData
            );


        removeThinking();


        currentChat.push({

            role: "assistant",

            text:
                answer,

            timestamp:
                Date.now()

        });


        addMessage(
            "assistant",
            answer
        );


        if (guestMode) {

            saveGuestChat();

        } else {

            await saveCloudChat();

        }


    } catch (error) {

        console.error(
            "CodeAI error:",
            error
        );

        removeThinking();


        const errorMessage =
            "Sorry bro, I couldn't process that right now.\n\n" +
            error.message;


        currentChat.push({

            role: "assistant",

            text:
                errorMessage,

            timestamp:
                Date.now()

        });


        addMessage(
            "assistant",
            errorMessage
        );


        if (guestMode) {
            saveGuestChat();
        } else {
            await saveCloudChat();
        }

    }


    isSending = false;

    if (sendBtn) {
        sendBtn.disabled = false;
    }

    if (messageInput) {
        messageInput.focus();
    }
}


/* =========================================================
   PDF CREATOR
   ========================================================= */

async function createPDFFromText() {

    let sourceText = "";


    /* -----------------------------------------------------
       If text is selected in the browser
       ----------------------------------------------------- */

    const selection =
        window.getSelection
            ? window.getSelection().toString()
            : "";


    if (selection.trim()) {

        sourceText =
            selection.trim();

    }


    /* -----------------------------------------------------
       Otherwise ask user
       ----------------------------------------------------- */

    if (!sourceText) {

        sourceText =
            prompt(
                "Paste or enter the text you want in the PDF:"
            ) || "";

    }


    if (!sourceText.trim()) {

        alert(
            "No text was selected or entered."
        );

        return;
    }


    /* -----------------------------------------------------
       Ask how much text
       ----------------------------------------------------- */

    const amount =
        prompt(
            "How much text should CodeAI put in the PDF?\n\n" +
            "Examples:\n" +
            "• All\n" +
            "• First 500 words\n" +
            "• First 2 pages worth\n" +
            "• 1000 characters\n\n" +
            "Type a number for word count, or ALL:"
        );


    if (amount === null) {
        return;
    }


    let finalText =
        sourceText;


    const cleanAmount =
        amount
            .trim()
            .toLowerCase();


    if (
        cleanAmount !== "all" &&
        cleanAmount !== ""
    ) {

        const number =
            parseInt(
                cleanAmount,
                10
            );


        if (
            Number.isFinite(number) &&
            number > 0
        ) {

            const words =
                sourceText
                    .trim()
                    .split(/\s+/);


            finalText =
                words
                    .slice(
                        0,
                        number
                    )
                    .join(" ");

        }
    }


    const filename =
        prompt(
            "Enter the PDF filename:",
            "CodeAI_Document.pdf"
        );


    if (!filename) {
        return;
    }


    try {

        const response =
            await fetch(
                BACKEND_URL +
                "/create-pdf",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            text:
                                finalText,

                            filename:
                                filename.endsWith(".pdf")
                                    ? filename
                                    : filename + ".pdf"

                        })

                    }
                );


        if (!response.ok) {

            throw new Error(
                `PDF server returned ${response.status}`
            );
        }


        const contentType =
            response.headers.get(
                "content-type"
            ) || "";


        if (
            contentType.includes(
                "application/pdf"
            )
        ) {

            const blob =
                await response.blob();


            downloadBlob(
                blob,
                filename.endsWith(".pdf")
                    ? filename
                    : filename + ".pdf"
            );

            addMessage(
                "assistant",
                "PDF created successfully. 📄"
            );

            return;
        }


        const data =
            await response.json();


        if (data.url) {

            window.open(
                data.url,
                "_blank"
            );

            return;
        }


        if (data.pdf) {

            const binary =
                atob(data.pdf);

            const bytes =
                new Uint8Array(
                    binary.length
                );

            for (
                let i = 0;
                i < binary.length;
                i++
            ) {

                bytes[i] =
                    binary.charCodeAt(i);

            }


            downloadBlob(

                new Blob(
                    [bytes],
                    {
                        type:
                            "application/pdf"
                    }
                ),

                filename.endsWith(".pdf")
                    ? filename
                    : filename + ".pdf"
            );

            return;
        }


        throw new Error(
            "The backend did not return a PDF."
        );


    } catch (error) {

        console.error(
            "PDF creation error:",
            error
        );

        alert(
            "PDF creation failed:\n" +
            error.message
        );
    }
}


/* =========================================================
   DOWNLOAD BLOB
   ========================================================= */

function downloadBlob(
    blob,
    filename
) {

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        filename;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    setTimeout(
        () =>
            URL.revokeObjectURL(url),
        1000
    );
}


/* =========================================================
   CAMERA
   ========================================================= */

function openCamera() {

    if (cameraInput) {

        cameraInput.setAttribute(
            "accept",
            "image/*"
        );

        cameraInput.setAttribute(
            "capture",
            "environment"
        );

        cameraInput.click();

        return;
    }

    if (imageInput) {
        imageInput.click();
    }
}


/* =========================================================
   MICROPHONE
   ========================================================= */

function startMicrophone() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        alert(
            "Your browser does not support microphone speech recognition."
        );

        return;
    }


    if (recognition) {

        try {
            recognition.stop();
        } catch {}

        recognition = null;

        return;
    }


    recognition =
        new SpeechRecognition();


    recognition.lang =
        "en-IN";

    recognition.continuous =
        false;

    recognition.interimResults =
        true;


    recognition.onstart =
        () => {

            if (micBtn) {
                micBtn.classList.add(
                    "active"
                );
            }

        };


    recognition.onresult =
        event => {

            let finalText =
                "";

            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                finalText +=
                    event.results[i][0]
                        .transcript;

            }


            if (messageInput) {
                messageInput.value =
                    finalText;
            }

        };


    recognition.onerror =
        error => {

            console.error(
                "Speech error:",
                error
            );

        };


    recognition.onend =
        () => {

            if (micBtn) {
                micBtn.classList.remove(
                    "active"
                );
            }

            recognition =
                null;

        };


    recognition.start();
}


/* =========================================================
   ABOUT
   ========================================================= */

function showAbout() {

    alert(
        "CodeAI\n\n" +
        "Your futuristic AI assistant.\n\n" +
        "VARAD WANSAGAR sir created me."
    );
}


/* =========================================================
   BACKEND HEALTH
   ========================================================= */

async function checkBackend() {

    try {

        const response =
            await fetch(
                BACKEND_URL +
                "/health",
                {
                    method: "GET"
                }
            );


        if (!response.ok) {
            throw new Error(
                "Backend offline"
            );
        }


        console.log(
            "CodeAI backend: ONLINE"
        );


    } catch (error) {

        console.warn(
            "CodeAI backend unavailable:",
            error
        );

    }
}


/* =========================================================
   QUICK ACTIONS
   ========================================================= */

function setupQuickActions() {

    document
        .querySelectorAll(
            "[data-prompt]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const promptText =
                        button.dataset.prompt;

                    if (messageInput) {

                        messageInput.value =
                            promptText;

                        messageInput.focus();

                    }

                }
            );

        });
}


/* =========================================================
   FILE INPUT EVENTS
   ========================================================= */

if (attachBtn) {

    attachBtn.addEventListener(
        "click",
        () => {

            if (fileInput) {
                fileInput.click();
            }

        }
    );
}


if (cameraBtn) {

    cameraBtn.addEventListener(
        "click",
        openCamera
    );
}


if (fileInput) {

    fileInput.addEventListener(
        "change",
        event => {

            addFiles(
                Array.from(
                    event.target.files || []
                )
            );

        }
    );
}


if (cameraInput) {

    cameraInput.addEventListener(
        "change",
        event => {

            addFiles(
                Array.from(
                    event.target.files || []
                )
            );

        }
    );
}


if (imageInput) {

    imageInput.addEventListener(
        "change",
        event => {

            addFiles(
                Array.from(
                    event.target.files || []
                )
            );

        }
    );
}


if (removeAttachmentBtn) {

    removeAttachmentBtn.addEventListener(
        "click",
        clearAttachments
    );
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
}


/* =========================================================
   MICROPHONE
   ========================================================= */

if (micBtn) {

    micBtn.addEventListener(
        "click",
        startMicrophone
    );
}


/* =========================================================
   NEW CHAT
   ========================================================= */

if (newChatBtn) {

    newChatBtn.addEventListener(
        "click",
        startNewChat
    );
}


/* =========================================================
   GOOGLE LOGIN
   ========================================================= */

if (googleLoginBtn) {

    googleLoginBtn.addEventListener(
        "click",
        loginWithGoogle
    );
}


/* =========================================================
   GUEST LOGIN
   ========================================================= */

if (guestBtn) {

    guestBtn.addEventListener(
        "click",
        enterGuestMode
    );
}


/* =========================================================
   SIGN OUT
   ========================================================= */

if (signOutBtn) {

    signOutBtn.addEventListener(
        "click",
        signOut
    );
}


/* =========================================================
   ABOUT
   ========================================================= */

if (aboutBtn) {

    aboutBtn.addEventListener(
        "click",
        showAbout
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
   PDF BUTTON SUPPORT
   ---------------------------------------------------------
   If your HTML has a button with:
   id="createPdfBtn"
   it automatically works.
   ========================================================= */

const createPdfBtn =
    document.getElementById(
        "createPdfBtn"
    );


if (createPdfBtn) {

    createPdfBtn.addEventListener(
        "click",
        createPDFFromText
    );
}


/* =========================================================
   DRAG & DROP
   ========================================================= */

if (messages) {

    messages.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

        }
    );


    messages.addEventListener(
        "drop",
        event => {

            event.preventDefault();

            addFiles(
                Array.from(
                    event.dataTransfer.files || []
                )
            );

        }
    );
}


/* =========================================================
   FIREBASE AUTH STATE
   ========================================================= */

if (auth) {

    auth.onAuthStateChanged(
        async user => {

            if (user) {

                currentUser =
                    user;

                guestMode =
                    false;

                updateAccountUI(
                    user
                );

                showApp();

                startNewChat();

                console.log(
                    "Authenticated:",
                    user.email
                );

            }

        }
    );

}


/* =========================================================
   INITIAL STATE
   ========================================================= */

function bootCodeAI() {

    updateAttachmentPreview();

    setupQuickActions();

    checkBackend();

    if (!auth) {

        console.warn(
            "Firebase authentication is not available."
        );

    }

    console.log(
        "================================"
    );

    console.log(
        "CODEAI FRONTEND ONLINE"
    );

    console.log(
        "Files: ENABLED"
    );

    console.log(
        "Images: ENABLED"
    );

    console.log(
        "PDF Reader: ENABLED"
    );

    console.log(
        "PDF Creator: ENABLED"
    );

    console.log(
        "Folders: ENABLED"
    );

    console.log(
        "Camera: ENABLED"
    );

    console.log(
        "Microphone: ENABLED"
    );

    console.log(
        "================================"
    );
}


bootCodeAI();