const messages = document.getElementById("messages");
const input = document.getElementById("userInput");
const language = document.getElementById("language");

const BACKEND_URL =
    "https://codeai-backend-0y6t.onrender.com";

const STORAGE_KEY = "codeai_chats_v2";

let chats =
    JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
    );

let activeChatId = null;

let pendingFile = null;

let cameraStream = null;


/* =====================================================
   STARTUP
===================================================== */

window.addEventListener("DOMContentLoaded", () => {

    if (!chats.length) {
        createChat(false);
    } else {
        activeChatId = chats[0].id;
        loadChat(activeChatId);
    }

    renderChatList();

});


/* =====================================================
   CHAT STORAGE
===================================================== */

function saveChats() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
    );

}


function createChat(askConfirm = true) {

    if (
        askConfirm &&
        getCurrentMessages().length > 0
    ) {

        if (
            !confirm(
                "Start a new chat?"
            )
        ) {
            return;
        }

    }

    const chat = {

        id:
            Date.now().toString(),

        title:
            "New Chat",

        messages: [],

        createdAt:
            Date.now(),

        updatedAt:
            Date.now()

    };

    chats.unshift(chat);

    activeChatId = chat.id;

    saveChats();

    renderChatList();

    loadChat(chat.id);

}


function newChat() {

    createChat(true);

}


/* =====================================================
   CHAT LIST
===================================================== */

function renderChatList() {

    const list =
        document.getElementById(
            "chatList"
        );

    const search =
        document.getElementById(
            "chatSearch"
        ).value
            .trim()
            .toLowerCase();

    list.innerHTML = "";

    chats
        .filter(chat =>
            chat.title
                .toLowerCase()
                .includes(search)
        )
        .forEach(chat => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "chat-item" +
                (
                    chat.id === activeChatId
                        ? " active"
                        : ""
                );

            const open =
                document.createElement(
                    "button"
                );

            open.className =
                "chat-open";

            open.textContent =
                chat.title;

            open.onclick =
                () => {

                    activeChatId =
                        chat.id;

                    loadChat(chat.id);

                    renderChatList();

                };


            const menu =
                document.createElement(
                    "button"
                );

            menu.className =
                "chat-menu";

            menu.textContent =
                "...";

            menu.onclick =
                () => chatOptions(chat.id);


            row.appendChild(open);

            row.appendChild(menu);

            list.appendChild(row);

        });

}


function chatOptions(id) {

    const chat =
        chats.find(
            item => item.id === id
        );

    if (!chat) return;

    const action =
        prompt(
            "Type R to rename or D to delete:",
            "R"
        );

    if (!action) return;

    if (
        action.toLowerCase() === "r"
    ) {

        const name =
            prompt(
                "New chat name:",
                chat.title
            );

        if (
            name &&
            name.trim()
        ) {

            chat.title =
                name.trim();

            chat.updatedAt =
                Date.now();

            saveChats();

            renderChatList();

            if (
                chat.id ===
                activeChatId
            ) {

                updateChatTitle(
                    chat.title
                );

            }

        }

    }


    if (
        action.toLowerCase() === "d"
    ) {

        if (
            !confirm(
                "Delete this chat?"
            )
        ) {
            return;
        }

        chats =
            chats.filter(
                item =>
                    item.id !== id
            );

        if (
            activeChatId === id
        ) {

            if (chats.length) {

                activeChatId =
                    chats[0].id;

            } else {

                createChat(false);

                return;

            }

        }

        saveChats();

        loadChat(activeChatId);

        renderChatList();

    }

}


/* =====================================================
   LOAD CHAT
===================================================== */

function loadChat(id) {

    const chat =
        chats.find(
            item => item.id === id
        );

    if (!chat) return;

    activeChatId = id;

    messages.innerHTML = "";

    updateChatTitle(
        chat.title
    );

    if (!chat.messages.length) {

        showWelcome();

        return;

    }

    chat.messages.forEach(
        message => {

            addMessage(
                message.text,
                message.type,
                false
            );

        }
    );

}


function showWelcome() {

    messages.innerHTML = `

        <div class="welcome">

            <div class="welcome-icon">
                &lt;/&gt;
            </div>

            <h2>Welcome to CodeAI</h2>

            <p>
                Ask questions, write code,
                analyze files, read documents,
                understand images and more.
            </p>

            <div class="suggestions">

                <button onclick="useSuggestion('Explain Python loops')">
                    Explain Python loops
                </button>

                <button onclick="useSuggestion('Help me debug my code')">
                    Debug my code
                </button>

                <button onclick="useSuggestion('Help me build a website')">
                    Build a website
                </button>

                <button onclick="useSuggestion('What should I learn in JavaScript?')">
                    Learning path
                </button>

            </div>

        </div>

    `;

}


/* =====================================================
   CURRENT CHAT
===================================================== */

function getCurrentChat() {

    return chats.find(
        chat =>
            chat.id === activeChatId
    );

}


function getCurrentMessages() {

    const chat =
        getCurrentChat();

    return chat
        ? chat.messages
        : [];

}


function saveCurrentChat() {

    const chat =
        getCurrentChat();

    if (!chat) return;

    chat.updatedAt =
        Date.now();

    saveChats();

    renderChatList();

}


/* =====================================================
   SEND MESSAGE
===================================================== */

async function sendMessage() {

    const text =
        input.value.trim();

    if (
        !text &&
        !pendingFile
    ) {
        return;
    }

    const chat =
        getCurrentChat();

    if (!chat) return;


    const welcome =
        document.querySelector(
            ".welcome"
        );

    if (welcome) {
        welcome.remove();
    }


    if (text) {

        addMessage(
            text,
            "user"
        );

        chat.messages.push({
            text: text,
            type: "user"
        });

    }


    input.value = "";


    if (
        chat.title === "New Chat" &&
        text
    ) {

        chat.title =
            makeChatTitle(text);

        updateChatTitle(
            chat.title
        );

        renderChatList();

    }


    const loading =
        addMessage(
            "Thinking...",
            "ai"
        );


    try {

        let reply;


        /* ---------------------------------------------
           FILE
        --------------------------------------------- */

        if (pendingFile) {

            const file =
                pendingFile;

            clearAttachment();

            if (
                file.type &&
                file.type.startsWith(
                    "image/"
                )
            ) {

                reply =
                    await analyzeImage(
                        file,
                        text ||
                        "Analyze this image."
                    );

            } else {

                reply =
                    await analyzeFile(
                        file,
                        text
                    );

            }

        }


        /* ---------------------------------------------
           NORMAL CHAT
        --------------------------------------------- */

        else {

            const response =
                await fetch(
                    `${BACKEND_URL}/chat`,
                    {

                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                message:
                                    text,

                                language:
                                    language.value,

                                history:
                                    chat.messages
                                        .slice(-20)
                                        .map(
                                            message => ({

                                                role:
                                                    message.type ===
                                                    "user"
                                                        ? "user"
                                                        : "assistant",

                                                content:
                                                    message.text

                                            })
                                        )

                            })

                    }
                );


            const raw =
                await response.text();


            if (!response.ok) {

                throw new Error(
                    `Backend error ${response.status}`
                );

            }


            let data;

            try {

                data =
                    JSON.parse(raw);

            } catch {

                throw new Error(
                    "Backend returned invalid JSON."
                );

            }


            if (!data.reply) {

                throw new Error(
                    "Backend did not return a reply."
                );

            }


            reply =
                data.reply;

        }


        loading
            .querySelector(
                ".bubble"
            )
            .innerHTML =
            formatAIResponse(
                reply
            );


        chat.messages.push({

            text: reply,

            type: "ai"

        });


        saveCurrentChat();


    } catch (error) {

        console.error(
            "CODEAI ERROR:",
            error
        );


        loading
            .querySelector(
                ".bubble"
            )
            .textContent =
            "Error: " +
            error.message;

    }

}


/* =====================================================
   ADD MESSAGE
===================================================== */

function addMessage(
    text,
    type,
    save = true
) {

    const message =
        document.createElement(
            "div"
        );

    message.className =
        `message ${type}`;


    const bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "bubble";


    if (type === "ai") {

        bubble.innerHTML =
            formatAIResponse(text);

    } else {

        bubble.textContent =
            text;

    }


    message.appendChild(
        bubble
    );

    messages.appendChild(
        message
    );


    messages.scrollTop =
        messages.scrollHeight;


    if (
        save &&
        type !== "ai"
    ) {

        saveCurrentChat();

    }


    return message;

}


/* =====================================================
   FORMAT RESPONSE
===================================================== */

function formatAIResponse(text) {

    text =
        escapeHTML(
            String(text)
        );


    text =
        text.replace(

            /```([a-zA-Z0-9+#.-]*)\n?([\s\S]*?)```/g,

            function(
                match,
                lang,
                code
            ) {

                return `

                    <div class="code-block">

                        <div class="code-header">

                            <span>
                                ${lang || "code"}
                            </span>

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


    text =
        text.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    text =
        text.replace(
            /\n/g,
            "<br>"
        );


    return text;

}


/* =====================================================
   ESCAPE
===================================================== */

function escapeHTML(text) {

    return text

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


/* =====================================================
   COPY CODE
===================================================== */

function copyCode(button) {

    const code =
        button
            .closest(
                ".code-block"
            )
            .querySelector(
                "code"
            )
            .textContent;


    navigator.clipboard.writeText(
        code
    );


    button.textContent =
        "Copied";


    setTimeout(
        () => {
            button.textContent =
                "Copy";
        },
        1500
    );

}


/* =====================================================
   CHAT TITLE
===================================================== */

function makeChatTitle(text) {

    let title =
        text
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    if (
        title.length > 32
    ) {

        title =
            title.substring(
                0,
                32
            ) +
            "...";

    }


    return title ||
        "New Chat";

}


function updateChatTitle(title) {

    document.getElementById(
        "chatTitle"
    ).textContent =
        title;

}


/* =====================================================
   SUGGESTIONS
===================================================== */

function useSuggestion(text) {

    input.value =
        text;

    input.focus();

}


/* =====================================================
   ENTER
===================================================== */

function handleKey(event) {

    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {

        event.preventDefault();

        sendMessage();

    }

}


/* =====================================================
   TOOLS MENU
===================================================== */

function toggleTools() {

    document
        .getElementById(
            "toolsMenu"
        )
        .classList.toggle(
            "show"
        );

}


function closeTools() {

    document
        .getElementById(
            "toolsMenu"
        )
        .classList.remove(
            "show"
        );

}


/* =====================================================
   FILE SELECTION
===================================================== */

function selectFile() {

    closeTools();

    document
        .getElementById(
            "fileInput"
        )
        .click();

}


function selectImage() {

    closeTools();

    document
        .getElementById(
            "imageInput"
        )
        .click();

}


function selectFolder() {

    closeTools();

    document
        .getElementById(
            "folderInput"
        )
        .click();

}


/* =====================================================
   FILE HANDLING
===================================================== */

function handleFile(event) {

    const file =
        event.target.files[0];

    if (!file) return;

    pendingFile =
        file;

    showAttachment(
        file.name
    );

}


function handleImage(event) {

    const file =
        event.target.files[0];

    if (!file) return;

    pendingFile =
        file;

    showAttachment(
        file.name
    );

}


async function handleFolder(event) {

    const files =
        Array.from(
            event.target.files
        );

    if (!files.length) {
        return;
    }


    closeTools();


    const chat =
        getCurrentChat();


    addMessage(
        `Selected ${files.length} files.`,
        "user"
    );


    const loading =
        addMessage(
            "Reading files...",
            "ai"
        );


    try {

        const formData =
            new FormData();


        files.forEach(
            file => {

                formData.append(
                    "files",
                    file
                );

            }
        );


        const response =
            await fetch(
                `${BACKEND_URL}/read-files`,
                {

                    method: "POST",

                    body: formData

                }
            );


        const data =
            await response.json();


        if (
            !response.ok
        ) {

            throw new Error(
                "Could not read folder."
            );

        }


        const fileText =
            data.files
                .map(
                    file =>
                        `FILE: ${file.filename}\n${file.text}`
                )
                .join(
                    "\n\n"
                );


        const answer =
            await askAIWithContext(

                "Analyze this project folder. Explain its structure, important files, possible problems, and useful improvements.\n\n" +
                fileText

            );


        loading
            .querySelector(
                ".bubble"
            )
            .innerHTML =
            formatAIResponse(
                answer
            );


        chat.messages.push({

            text:
                `Selected ${files.length} files.`,

            type:
                "user"

        });


        chat.messages.push({

            text:
                answer,

            type:
                "ai"

        });


        saveCurrentChat();


    } catch (error) {

        loading
            .querySelector(
                ".bubble"
            )
            .textContent =
            "Error: " +
            error.message;

    }

}


/* =====================================================
   FILE ANALYSIS
===================================================== */

async function analyzeFile(
    file,
    question
) {

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


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            "Could not read file."
        );

    }


    if (
        data.type ===
        "unsupported"
    ) {

        return data.message;

    }


    const prompt =

        question ||

        "Summarize and explain this file.";

    return await askAIWithContext(

        `${prompt}

Filename: ${data.filename}

File contents:

${data.text}`

    );

}


/* =====================================================
   IMAGE ANALYSIS
===================================================== */

async function analyzeImage(
    file,
    question
) {

    const formData =
        new FormData();


    formData.append(
        "file",
        file
    );


    formData.append(
        "question",
        question ||
        "Analyze this image and explain what you can see."
    );


    const response =
        await fetch(
            `${BACKEND_URL}/vision`,
            {

                method: "POST",

                body: formData

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            "Image analysis failed."
        );

    }


    return data.reply;

}


/* =====================================================
   ASK AI WITH FILE CONTEXT
===================================================== */

async function askAIWithContext(
    context
) {

    const chat =
        getCurrentChat();


    const response =
        await fetch(
            `${BACKEND_URL}/chat`,
            {

                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({

                        message:
                            context,

                        language:
                            language.value,

                        history:
                            chat.messages
                                .slice(-20)
                                .map(
                                    message => ({

                                        role:
                                            message.type ===
                                            "user"
                                                ? "user"
                                                : "assistant",

                                        content:
                                            message.text

                                    })
                                )

                    })

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            "AI request failed."
        );

    }


    return data.reply;

}


/* =====================================================
   ATTACHMENT UI
===================================================== */

function showAttachment(
    filename
) {

    const preview =
        document.getElementById(
            "attachmentPreview"
        );


    preview.innerHTML = `

        <div class="attachment">

            <span>${escapeHTML(filename)}</span>

            <button
                onclick="clearAttachment()"
            >
                Remove
            </button>

        </div>

    `;


    preview.classList.add(
        "show"
    );

}


function clearAttachment() {

    pendingFile =
        null;


    document.getElementById(
        "attachmentPreview"
    ).classList.remove(
        "show"
    );


    document.getElementById(
        "fileInput"
    ).value = "";


    document.getElementById(
        "imageInput"
    ).value = "";

}


/* =====================================================
   CAMERA
===================================================== */

async function openCamera() {

    closeTools();


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

                    video: true,

                    audio: false

                });


        video.srcObject =
            cameraStream;


        modal.classList.add(
            "show"
        );


    } catch (error) {

        alert(
            "Camera permission was not available."
        );

    }

}


function closeCamera() {

    const modal =
        document.getElementById(
            "cameraModal"
        );


    modal.classList.remove(
        "show"
    );


    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        cameraStream =
            null;

    }

}


function capturePhoto() {

    const video =
        document.getElementById(
            "cameraVideo"
        );


    const canvas =
        document.getElementById(
            "cameraCanvas"
        );


    canvas.width =
        video.videoWidth;


    canvas.height =
        video.videoHeight;


    const context =
        canvas.getContext(
            "2d"
        );


    context.drawImage(
        video,
        0,
        0
    );


    canvas.toBlob(
        blob => {

            if (!blob) return;


            pendingFile =
                new File(
                    [blob],
                    "camera-photo.jpg",
                    {
                        type:
                            "image/jpeg"
                    }
                );


            showAttachment(
                "camera-photo.jpg"
            );


            closeCamera();

        },

        "image/jpeg",

        0.9
    );

}


/* =====================================================
   MICROPHONE
===================================================== */

function startVoiceInput() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        alert(
            "Voice input is not supported by this browser."
        );

        return;

    }


    const recognition =
        new SpeechRecognition();


    recognition.lang =
        "en-IN";


    recognition.interimResults =
        true;


    recognition.continuous =
        false;


    recognition.onresult =
        event => {

            let result = "";

            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                result +=
                    event.results[i][0]
                        .transcript;

            }

            input.value =
                result;

        };


    recognition.onerror =
        event => {

            console.error(
                "VOICE ERROR:",
                event.error
            );

        };


    recognition.start();

}


/* =====================================================
   CREATE PDF
===================================================== */

async function createPDFFromChat() {

    closeTools();


    const chat =
        getCurrentChat();


    if (
        !chat ||
        !chat.messages.length
    ) {

        alert(
            "There is no conversation to create a PDF from."
        );

        return;

    }


    try {

        const content =
            chat.messages
                .map(
                    message =>
                        `${message.type === "user" ? "User" : "CodeAI"}:\n${message.text}`
                )
                .join(
                    "\n\n"
                );


        const response =
            await fetch(
                `${BACKEND_URL}/create-pdf`,
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            title:
                                chat.title,

                            content:
                                content

                        })

                    }

                );

        if (!response.ok) {

            throw new Error(
                "PDF creation failed."
            );

        }


        const blob =
            await response.blob();


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            `${safeFilename(chat.title)}.pdf`;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );


    } catch (error) {

        alert(
            error.message
        );

    }

}


/* =====================================================
   SAFE FILENAME
===================================================== */

function safeFilename(name) {

    return name
        .replace(
            /[<>:"/\\|?*]/g,
            "_"
        )
        .trim() ||
        "CodeAI_Chat";

}


/* =====================================================
   MOBILE SIDEBAR
===================================================== */

function toggleSidebar() {

    document
        .getElementById(
            "sidebar"
        )
        .classList.toggle(
            "open"
        );

}


/* =====================================================
   ABOUT
===================================================== */

function showAbout() {

    alert(
        "CodeAI\n\nAn AI assistant created by VARAD WANSAGAR."
    );

}