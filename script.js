const BACKEND_URL =
    "https://codeai-backend-0y6t.onrender.com";

let chatHistory = [];
let currentAttachment = null;
let currentAttachmentType = null;
let recognition = null;
let isListening = false;


/* =========================
   BASIC ELEMENT HELPERS
========================= */

function getInput() {
    return (
        document.getElementById("userInput") ||
        document.getElementById("messageInput")
    );
}

function getLanguage() {
    return (
        document.getElementById("language") ||
        document.getElementById("languageSelect")
    );
}

function getMessages() {
    return document.getElementById("messages");
}


/* =========================
   HTML ESCAPE
========================= */

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================
   MARKDOWN / AI RESPONSE
========================= */

function formatAIResponse(text) {
    if (!text) return "";

    let safe = escapeHTML(text);

    safe = safe.replace(
        /```([\s\S]*?)```/g,
        function (_, code) {
            return `
                <pre class="code-block"><code>${code.trim()}</code></pre>
            `;
        }
    );

    safe = safe.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    safe = safe.replace(
        /`([^`]+)`/g,
        "<code>$1</code>"
    );

    safe = safe.replace(
        /\n/g,
        "<br>"
    );

    return safe;
}


/* =========================
   ADD MESSAGE
========================= */

function addMessage(text, type = "user", save = true) {

    const messages = getMessages();

    if (!messages) return null;

    const row = document.createElement("div");

    row.className =
        `message-row ${type}`;

    const bubble =
        document.createElement("div");

    bubble.className = "bubble";

    if (type === "ai") {
        bubble.innerHTML =
            formatAIResponse(text);
    } else {
        bubble.textContent = text;
    }

    row.appendChild(bubble);

    messages.appendChild(row);

    messages.scrollTop =
        messages.scrollHeight;

    if (save) {

        chatHistory.push({
            role:
                type === "ai"
                    ? "assistant"
                    : "user",

            content: text,

            type: type
        });
    }

    return row;
}


/* =========================
   WELCOME
========================= */

function removeWelcome() {

    const welcome =
        document.getElementById("welcome");

    if (welcome) {
        welcome.style.display = "none";
    }
}


/* =========================
   SEND NORMAL CHAT
========================= */

async function sendMessage() {

    const input = getInput();

    if (!input) return;

    const text =
        input.value.trim();

    /*
       VIDEO
    */

    if (
        currentAttachment &&
        currentAttachmentType === "video"
    ) {

        await sendVideoToCodeAI(
            currentAttachment,
            text
        );

        input.value = "";

        return;
    }

    /*
       IMAGE
    */

    if (
        currentAttachment &&
        currentAttachmentType === "image"
    ) {

        await sendImageToVision(
            currentAttachment,
            text ||
            "Analyze this image."
        );

        input.value = "";

        return;
    }

    if (!text) return;

    removeWelcome();

    addMessage(
        text,
        "user"
    );

    input.value = "";

    const loading =
        addMessage(
            "Thinking...",
            "ai",
            false
        );

    try {

        const languageElement =
            getLanguage();

        const language =
            languageElement
                ? languageElement.value
                : "general";

        const history =
            chatHistory
                .filter(
                    item =>
                        item.role === "user" ||
                        item.role === "assistant"
                )
                .slice(-20)
                .map(item => ({
                    role: item.role,
                    content:
                        item.content
                }));

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
                        message: text,
                        language: language,
                        history: history
                    })
                }
            );

        const raw =
            await response.text();

        if (!response.ok) {

            throw new Error(
                `Server ${response.status}: ${raw}`
            );
        }

        const data =
            JSON.parse(raw);

        const reply =
            data.reply ||
            data.message ||
            "No response received.";

        const bubble =
            loading.querySelector(
                ".bubble"
            );

        if (bubble) {

            bubble.innerHTML =
                formatAIResponse(reply);
        }

        chatHistory.push({
            role: "assistant",
            content: reply,
            type: "ai"
        });

        await saveCurrentChat();

    } catch (error) {

        console.error(
            "CHAT ERROR:",
            error
        );

        const bubble =
            loading.querySelector(
                ".bubble"
            );

        if (bubble) {

            bubble.textContent =
                "Connection error: " +
                error.message;
        }
    }
}


/* =========================
   IMAGE → VISION
========================= */

async function sendImageToVision(
    file,
    question
) {

    removeWelcome();

    addMessage(
        `🖼️ Image: ${file.name}`,
        "user"
    );

    const loading =
        addMessage(
            "ANALYZING IMAGE...",
            "ai",
            false
        );

    try {

        const imageData =
            await readFileAsDataURL(file);

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
                            question ||
                            "Analyze this image.",
                        image:
                            imageData
                    })
                }
            );

        const raw =
            await response.text();

        if (!response.ok) {

            throw new Error(
                `Vision server ${response.status}: ${raw}`
            );
        }

        const data =
            JSON.parse(raw);

        const reply =
            data.reply ||
            "I could not analyze this image.";

        const bubble =
            loading.querySelector(
                ".bubble"
            );

        if (bubble) {

            bubble.innerHTML =
                formatAIResponse(reply);
        }

        chatHistory.push({
            role: "assistant",
            content: reply,
            type: "ai"
        });

        await saveCurrentChat();

        clearAttachment();

    } catch (error) {

        console.error(
            "IMAGE ERROR:",
            error
        );

        const bubble =
            loading.querySelector(
                ".bubble"
            );

        if (bubble) {

            bubble.textContent =
                "Image analysis error: " +
                error.message;
        }
    }
}


/* =========================
   VIDEO → VIDEO AI
========================= */

async function sendVideoToCodeAI(
    file,
    question
) {

    removeWelcome();

    addMessage(
        `🎬 Video: ${file.name}`,
        "user"
    );

    const loading =
        addMessage(
            "🎬 ANALYZING VIDEO...",
            "ai",
            false
        );

    try {

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );

        formData.append(
            "question",
            question ||
            "Analyze this video and tell me what happens."
        );

        const response =
            await fetch(
                `${BACKEND_URL}/video`,
                {
                    method: "POST",
                    body: formData
                }
            );

        const raw =
            await response.text();

        if (!response.ok) {

            let message = raw;

            try {

                const errorData =
                    JSON.parse(raw);

                message =
                    errorData.detail ||
                    errorData.error ||
                    raw;

            } catch (_) {}

            throw new Error(
                `Video server ${response.status}: ${message}`
            );
        }

        const data =
            JSON.parse(raw);

        const reply =
            data.reply ||
            "I could not analyze this video.";

        const bubble =
            loading.querySelector(
                ".bubble"
            );

        if (bubble) {

            bubble.innerHTML =
                formatAIResponse(reply);
        }

        chatHistory.push({
            role: "assistant",
            content: reply,
            type: "ai"
        });

        await saveCurrentChat();

        clearAttachment();

    } catch (error) {

        console.error(
            "VIDEO ERROR:",
            error
        );

        const bubble =
            loading.querySelector(
                ".bubble"
            );

        if (bubble) {

            bubble.innerHTML =
                `<strong>Video analysis failed.</strong><br><br>` +
                escapeHTML(
                    error.message
                );
        }
    }
}


/* =========================
   FILE READER
========================= */

async function readNormalFile(file) {

    removeWelcome();

    addMessage(
        `📎 File: ${file.name}`,
        "user"
    );

    const loading =
        addMessage(
            "READING FILE...",
            "ai",
            false
        );

    try {

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );

        const response =
            await fetch(
                `${BACKEND_URL}/read-file`,
                {
                    method: "POST",
                    body: formData
                }
            );

        const raw =
            await response.text();

        if (!response.ok) {

            throw new Error(
                raw
            );
        }

        const data =
            JSON.parse(raw);

        const content =
            data.content ||
            "No readable content found.";

        const bubble =
            loading.querySelector(
                ".bubble"
            );

        if (bubble) {

            bubble.innerHTML =
                formatAIResponse(
                    content
                );
        }

        chatHistory.push({
            role: "assistant",
            content: content,
            type: "ai"
        });

        await saveCurrentChat();

        clearAttachment();

    } catch (error) {

        const bubble =
            loading.querySelector(
                ".bubble"
            );

        if (bubble) {

            bubble.textContent =
                "File reading error: " +
                error.message;
        }
    }
}


/* =========================
   PDF
========================= */

async function readPDF(file) {

    removeWelcome();

    addMessage(
        `📄 PDF: ${file.name}`,
        "user"
    );

    const loading =
        addMessage(
            "READING PDF...",
            "ai",
            false
        );

    try {

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );

        const response =
            await fetch(
                `${BACKEND_URL}/read-pdf`,
                {
                    method: "POST",
                    body: formData
                }
            );

        const raw =
            await response.text();

        if (!response.ok) {

            throw new Error(
                raw
            );
        }

        const data =
            JSON.parse(raw);

        const content =
            data.content ||
            "No readable PDF text found.";

        const bubble =
            loading.querySelector(
                ".bubble"
            );

        if (bubble) {

            bubble.innerHTML =
                formatAIResponse(
                    content
                );
        }

        chatHistory.push({
            role: "assistant",
            content: content,
            type: "ai"
        });

        await saveCurrentChat();

        clearAttachment();

    } catch (error) {

        const bubble =
            loading.querySelector(
                ".bubble"
            );

        if (bubble) {

            bubble.textContent =
                "PDF error: " +
                error.message;
        }
    }
}


/* =========================
   FILE SELECTION
========================= */

async function handleSelectedFile(
    file
) {

    if (!file) return;

    currentAttachment =
        file;

    const type =
        file.type || "";

    const name =
        file.name.toLowerCase();

    if (
        type.startsWith("video/") ||
        /\.(mp4|mov|mkv|avi|webm|m4v)$/i.test(name)
    ) {

        currentAttachmentType =
            "video";

        showAttachment(
            file,
            "VIDEO"
        );

        return;
    }

    if (
        type.startsWith("image/")
    ) {

        currentAttachmentType =
            "image";

        showAttachment(
            file,
            "IMAGE"
        );

        return;
    }

    if (
        type === "application/pdf" ||
        name.endsWith(".pdf")
    ) {

        currentAttachmentType =
            "pdf";

        showAttachment(
            file,
            "PDF"
        );

        await readPDF(file);

        return;
    }

    currentAttachmentType =
        "file";

    showAttachment(
        file,
        "FILE"
    );

    await readNormalFile(
        file
    );
}


/* =========================
   CAMERA
========================= */

async function handleCameraImage(
    file
) {

    if (!file) return;

    currentAttachment =
        file;

    currentAttachmentType =
        "image";

    showAttachment(
        file,
        "CAMERA"
    );

    await sendImageToVision(
        file,
        "Analyze this camera image and tell me what you see."
    );
}


/* =========================
   FILE → DATA URL
========================= */

function readFileAsDataURL(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onload =
                () =>
                    resolve(
                        reader.result
                    );

            reader.onerror =
                reject;

            reader.readAsDataURL(
                file
            );
        }
    );
}


/* =========================
   ATTACHMENT UI
========================= */

function showAttachment(
    file,
    type
) {

    const preview =
        document.getElementById(
            "attachmentPreview"
        );

    const nameElement =
        document.getElementById(
            "attachmentName"
        );

    const typeElement =
        document.getElementById(
            "attachmentType"
        );

    if (nameElement) {
        nameElement.textContent =
            file.name;
    }

    if (typeElement) {
        typeElement.textContent =
            type;
    }

    if (preview) {
        preview.classList.add(
            "show"
        );
        preview.style.display =
            "flex";
    }

    /*
       Add video preview without
       destroying existing controls.
    */

    if (
        type === "VIDEO" &&
        preview
    ) {

        let videoPreview =
            document.getElementById(
                "codeaiVideoPreview"
            );

        if (!videoPreview) {

            videoPreview =
                document.createElement(
                    "video"
                );

            videoPreview.id =
                "codeaiVideoPreview";

            videoPreview.controls =
                true;

            videoPreview.muted =
                true;

            videoPreview.playsInline =
                true;

            videoPreview.style.width =
                "100%";

            videoPreview.style.maxHeight =
                "180px";

            videoPreview.style.borderRadius =
                "10px";

            videoPreview.style.marginTop =
                "8px";

            preview.appendChild(
                videoPreview
            );
        }

        videoPreview.src =
            URL.createObjectURL(
                file
            );
    }
}


/* =========================
   CLEAR ATTACHMENT
========================= */

function clearAttachment() {

    currentAttachment =
        null;

    currentAttachmentType =
        null;

    const preview =
        document.getElementById(
            "attachmentPreview"
        );

    if (preview) {

        preview.classList.remove(
            "show"
        );

        preview.style.display =
            "none";
    }

    const videoPreview =
        document.getElementById(
            "codeaiVideoPreview"
        );

    if (videoPreview) {

        if (videoPreview.src) {

            try {
                URL.revokeObjectURL(
                    videoPreview.src
                );
            } catch (_) {}
        }

        videoPreview.remove();
    }
}


/* =========================
   TOOL SETUP
========================= */

function setupTools() {

    let fileInput =
        document.getElementById(
            "fileInput"
        );

    let cameraInput =
        document.getElementById(
            "cameraInput"
        );

    /*
       Create file input if needed.
    */

    if (!fileInput) {

        fileInput =
            document.createElement(
                "input"
            );

        fileInput.type =
            "file";

        fileInput.id =
            "fileInput";

        fileInput.accept =
            "image/*,video/*,.pdf,.txt,.py,.js,.html,.css,.json,.cpp,.c,.java,.md";

        fileInput.style.display =
            "none";

        document.body.appendChild(
            fileInput
        );
    }

    /*
       Create camera input if needed.
    */

    if (!cameraInput) {

        cameraInput =
            document.createElement(
                "input"
            );

        cameraInput.type =
            "file";

        cameraInput.id =
            "cameraInput";

        cameraInput.accept =
            "image/*";

        cameraInput.setAttribute(
            "capture",
            "environment"
        );

        cameraInput.style.display =
            "none";

        document.body.appendChild(
            cameraInput
        );
    }


    /*
       File button
    */

    const attachButton =
        document.getElementById(
            "attachBtn"
        );

    if (attachButton) {

        attachButton.onclick =
            () => {

                fileInput.click();
            };
    }


    /*
       Camera button
    */

    const cameraButton =
        document.getElementById(
            "cameraBtn"
        );

    if (cameraButton) {

        cameraButton.onclick =
            () => {

                cameraInput.click();
            };
    }


    /*
       File selected
    */

    fileInput.onchange =
        async function () {

            const file =
                this.files &&
                this.files[0];

            if (file) {

                await handleSelectedFile(
                    file
                );
            }

            this.value =
                "";
        };


    /*
       Camera selected
    */

    cameraInput.onchange =
        async function () {

            const file =
                this.files &&
                this.files[0];

            if (file) {

                await handleCameraImage(
                    file
                );
            }

            this.value =
                "";
        };


    /*
       Remove attachment
    */

    const removeButton =
        document.getElementById(
            "removeAttachmentBtn"
        );

    if (removeButton) {

        removeButton.onclick =
            clearAttachment;
    }


    /*
       Send button
    */

    const sendButton =
        document.getElementById(
            "sendBtn"
        );

    if (sendButton) {

        sendButton.onclick =
            sendMessage;
    }


    /*
       Enter key
    */

    const input =
        getInput();

    if (input) {

        input.addEventListener(
            "keydown",
            function (event) {

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


    setupMicrophone();
}


/* =========================
   MICROPHONE
========================= */

function setupMicrophone() {

    const micButton =
        document.getElementById(
            "micBtn"
        );

    if (!micButton) return;

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        micButton.onclick =
            () => {

                alert(
                    "Voice input is not supported by this browser."
                );
            };

        return;
    }

    recognition =
        new SpeechRecognition();

    recognition.continuous =
        false;

    recognition.interimResults =
        false;

    recognition.lang =
        "en-IN";

    recognition.onstart =
        () => {

            isListening =
                true;

            micButton.classList.add(
                "active"
            );
        };

    recognition.onend =
        () => {

            isListening =
                false;

            micButton.classList.remove(
                "active"
            );
        };

    recognition.onresult =
        event => {

            const result =
                event.results[
                    event.results.length - 1
                ];

            const text =
                result[0].transcript;

            const input =
                getInput();

            if (input) {

                input.value +=
                    text + " ";

                input.focus();
            }
        };

    recognition.onerror =
        error => {

            console.error(
                "MIC ERROR:",
                error
            );
        };

    micButton.onclick =
        () => {

            if (isListening) {

                recognition.stop();

            } else {

                recognition.start();
            }
        };
}


/* =========================
   NEW CHAT
========================= */

function newChat() {

    chatHistory = [];

    const messages =
        getMessages();

    if (messages) {
        messages.innerHTML = "";
    }

    const welcome =
        document.getElementById(
            "welcome"
        );

    if (welcome) {

        welcome.style.display =
            "";
    }

    clearAttachment();
}


/* =========================
   FIREBASE CLOUD SAVE
========================= */

async function saveCurrentChat() {

    try {

        if (
            typeof firebase === "undefined" ||
            typeof firebase.auth !== "function"
        ) {
            return;
        }

        const user =
            firebase.auth().currentUser;

        if (!user) {

            localStorage.setItem(
                "codeai_guest_history",
                JSON.stringify(
                    chatHistory
                )
            );

            return;
        }

        if (
            typeof firebaseDB === "undefined"
        ) {
            return;
        }

        await firebaseDB
            .collection("users")
            .doc(user.uid)
            .collection("chats")
            .doc("current")
            .set(
                {
                    messages:
                        chatHistory,

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                },
                {
                    merge: true
                }
            );

    } catch (error) {

        console.error(
            "SAVE CHAT ERROR:",
            error
        );
    }
}


/* =========================
   FIREBASE CLOUD LOAD
========================= */

async function loadCurrentChat() {

    try {

        if (
            typeof firebase === "undefined" ||
            typeof firebase.auth !== "function"
        ) {
            return;
        }

        const user =
            firebase.auth().currentUser;

        if (!user) {

            const saved =
                localStorage.getItem(
                    "codeai_guest_history"
                );

            if (saved) {

                chatHistory =
                    JSON.parse(saved);

                restoreHistory();
            }

            return;
        }

        if (
            typeof firebaseDB === "undefined"
        ) {
            return;
        }

        const doc =
            await firebaseDB
                .collection("users")
                .doc(user.uid)
                .collection("chats")
                .doc("current")
                .get();

        if (
            doc.exists &&
            doc.data().messages
        ) {

            chatHistory =
                doc.data().messages;

            restoreHistory();
        }

    } catch (error) {

        console.error(
            "LOAD CHAT ERROR:",
            error
        );
    }
}


/* =========================
   RESTORE HISTORY
========================= */

function restoreHistory() {

    const messages =
        getMessages();

    if (!messages) return;

    messages.innerHTML = "";

    for (const item of chatHistory) {

        const type =
            item.role === "assistant"
                ? "ai"
                : "user";

        addMessage(
            item.content ||
            item.text ||
            "",
            type,
            false
        );
    }

    if (chatHistory.length > 0) {
        removeWelcome();
    }
}


/* =========================
   GOOGLE ACCOUNT DISPLAY
========================= */

function updateAccountUI(user) {

    if (!user) return;

    const name =
        document.getElementById(
            "accountName"
        );

    const type =
        document.getElementById(
            "accountType"
        );

    const avatar =
        document.getElementById(
            "accountAvatar"
        );

    if (name) {

        name.textContent =
            user.displayName ||
            user.email ||
            "Google User";
    }

    if (type) {

        type.textContent =
            "Google Account";
    }

    if (
        avatar &&
        user.photoURL
    ) {

        avatar.src =
            user.photoURL;

        avatar.style.display =
            "block";
    }
}


/* =========================
   GOOGLE AUTH LISTENER
========================= */

function setupFirebaseAuth() {

    if (
        typeof firebase === "undefined" ||
        typeof firebase.auth !== "function"
    ) {
        return;
    }

    firebase.auth().onAuthStateChanged(
        async user => {

            updateAccountUI(user);

            await loadCurrentChat();
        }
    );
}


/* =========================
   SIGN OUT
========================= */

function setupSignOut() {

    const button =
        document.getElementById(
            "signOutBtn"
        );

    if (!button) return;

    button.onclick =
        async () => {

            try {

                if (
                    typeof firebase !== "undefined"
                ) {

                    await firebase
                        .auth()
                        .signOut();
                }

                localStorage.removeItem(
                    "codeai_guest_history"
                );

            } catch (error) {

                console.error(
                    "SIGN OUT ERROR:",
                    error
                );
            }
        };
}


/* =========================
   NEW CHAT BUTTON
========================= */

function setupNewChat() {

    const button =
        document.getElementById(
            "newChatBtn"
        );

    if (button) {

        button.onclick =
            newChat;
    }
}


/* =========================
   START CODEAI
========================= */

function initializeCodeAI() {

    setupTools();

    setupFirebaseAuth();

    setupSignOut();

    setupNewChat();
}


/* =========================
   DOM READY
========================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeCodeAI
    );

} else {

    initializeCodeAI();
}


/* =========================
   GLOBAL FUNCTIONS
========================= */

window.sendMessage =
    sendMessage;

window.newChat =
    newChat;

window.handleSelectedFile =
    handleSelectedFile;

window.handleCameraImage =
    handleCameraImage;

window.clearAttachment =
    clearAttachment;

window.sendVideoToCodeAI =
    sendVideoToCodeAI;

window.sendImageToVision =
    sendImageToVision;