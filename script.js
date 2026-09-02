const BACKEND_URL = "https://codeai-backend-0y6t.onrender.com";

const messages = document.getElementById("messages");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");

const statusText = document.getElementById("statusText");
const modeText = document.getElementById("modeText");

const chatList = document.getElementById("chatList");
const chatSearch = document.getElementById("chatSearch");

const attachmentBar = document.getElementById("attachmentBar");
const attachmentName = document.getElementById("attachmentName");

const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");

let chats = JSON.parse(
    localStorage.getItem("codeai_chats") || "[]"
);

let currentChatId = localStorage.getItem(
    "codeai_current_chat"
);

let attachedFile = null;
let mediaStream = null;
let recognition = null;
let isListening = false;


/* ============================================================
   CHAT STORAGE
============================================================ */

function saveChats() {

    localStorage.setItem(
        "codeai_chats",
        JSON.stringify(chats)
    );

    if (currentChatId) {
        localStorage.setItem(
            "codeai_current_chat",
            currentChatId
        );
    }
}


function createChat() {

    const chat = {
        id: Date.now().toString(),
        title: "New Chat",
        messages: []
    };

    chats.unshift(chat);

    currentChatId = chat.id;

    saveChats();

    renderChatList();

    renderMessages();
}


function getCurrentChat() {

    return chats.find(
        chat => chat.id === currentChatId
    );
}


function renderChatList() {

    chatList.innerHTML = "";

    const query = chatSearch.value
        .trim()
        .toLowerCase();

    chats
        .filter(chat =>
            chat.title.toLowerCase().includes(query)
        )
        .forEach(chat => {

            const item = document.createElement("div");

            item.className =
                "chat-item" +
                (
                    chat.id === currentChatId
                        ? " active"
                        : ""
                );

            item.textContent = chat.title;

            item.onclick = () => {

                currentChatId = chat.id;

                saveChats();

                renderChatList();
                renderMessages();

                closeSidebarMobile();
            };

            item.oncontextmenu = event => {

                event.preventDefault();

                const newName = prompt(
                    "Rename chat:",
                    chat.title
                );

                if (newName && newName.trim()) {

                    chat.title = newName.trim();

                    saveChats();

                    renderChatList();
                }
            };

            chatList.appendChild(item);

        });
}


function renderMessages() {

    messages.innerHTML = "";

    const chat = getCurrentChat();

    if (!chat || chat.messages.length === 0) {

        showWelcome();

        return;
    }

    chat.messages.forEach(message => {

        addMessageToUI(
            message.role,
            message.content
        );

    });
}


function showWelcome() {

    messages.innerHTML = `
        <div class="welcome">

            <div class="welcome-orb">
                <div></div>
            </div>

            <h2>What can I help you with?</h2>

            <p>
                Ask anything. CodeAI can understand questions,
                files, images, PDFs and more.
            </p>

            <div class="suggestions">

                <button data-prompt="Explain artificial intelligence simply">
                    Explain AI simply
                </button>

                <button data-prompt="Help me create a Python project">
                    Create a Python project
                </button>

                <button data-prompt="Tell me something interesting">
                    Tell me something interesting
                </button>

                <button data-prompt="What can you do?">
                    What can you do?
                </button>

            </div>

        </div>
    `;

    document
        .querySelectorAll("[data-prompt]")
        .forEach(button => {

            button.onclick = () => {

                input.value =
                    button.dataset.prompt;

                sendMessage();
            };

        });
}


/* ============================================================
   UI MESSAGES
============================================================ */

function addMessageToUI(role, text) {

    const wrapper = document.createElement("div");

    wrapper.className =
        `message ${role}`;

    const bubble = document.createElement("div");

    bubble.className = "bubble";

    if (role === "assistant") {

        bubble.innerHTML =
            formatAIResponse(text);

        addCopyButtons(bubble);

    } else {

        bubble.textContent = text;
    }

    wrapper.appendChild(bubble);

    messages.appendChild(wrapper);

    messages.parentElement.scrollTop =
        messages.parentElement.scrollHeight;
}


function formatAIResponse(text) {

    let safe = escapeHTML(text);

    safe = safe.replace(
        /```([\s\S]*?)```/g,
        `<pre><code>$1</code></pre>`
    );

    safe = safe.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    safe = safe.replace(
        /\n/g,
        "<br>"
    );

    return safe;
}


function escapeHTML(text) {

    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


function addCopyButtons(container) {

    container
        .querySelectorAll("pre")
        .forEach(pre => {

            const button =
                document.createElement("button");

            button.className = "copy-code";

            button.textContent = "COPY";

            button.onclick = async () => {

                const code =
                    pre.querySelector("code");

                await navigator.clipboard.writeText(
                    code.textContent
                );

                button.textContent = "COPIED";

                setTimeout(() => {
                    button.textContent = "COPY";
                }, 1500);

            };

            pre.appendChild(button);
        });
}


/* ============================================================
   SEND MESSAGE
============================================================ */

async function sendMessage() {

    const text = input.value.trim();

    if (!text) return;

    let chat = getCurrentChat();

    if (!chat) {

        createChat();

        chat = getCurrentChat();
    }


    if (chat.messages.length === 0) {

        chat.title =
            text.length > 35
                ? text.slice(0, 35) + "..."
                : text;
    }


    chat.messages.push({
        role: "user",
        content: text
    });

    saveChats();

    document.querySelector(".welcome")?.remove();

    addMessageToUI(
        "user",
        text
    );

    input.value = "";

    autoResize();


    if (attachedFile) {

        await processAttachment(
            attachedFile,
            chat
        );

        attachedFile = null;

        hideAttachment();
    }


    setStatus("THINKING");

    const thinking = addThinkingMessage();

    try {

        const history =
            chat.messages
                .slice(-20)
                .map(item => ({
                    role: item.role,
                    content: item.content
                }));

        const response = await fetch(
            `${BACKEND_URL}/chat`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    message: text,
                    history: history.slice(0, -1)
                })
            }
        );


        const data = await response.json();

        thinking.remove();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "AI request failed"
            );
        }


        const answer =
            data.response ||
            "I couldn't generate a response.";


        chat.messages.push({
            role: "assistant",
            content: answer
        });

        saveChats();

        addMessageToUI(
            "assistant",
            answer
        );

        renderChatList();

        setStatus("ONLINE");

    } catch (error) {

        thinking.remove();

        addMessageToUI(
            "assistant",
            "CodeAI error: " +
            error.message
        );

        setStatus("ERROR");

        console.error(error);
    }
}


function addThinkingMessage() {

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "message assistant";

    wrapper.innerHTML = `
        <div class="bubble">
            THINKING...
        </div>
    `;

    messages.appendChild(wrapper);

    messages.parentElement.scrollTop =
        messages.parentElement.scrollHeight;

    return wrapper;
}


function setStatus(text) {

    statusText.textContent = text;
    modeText.textContent = text;
}


/* ============================================================
   FILES
============================================================ */

document.getElementById("fileBtn").onclick =
    () => fileInput.click();


document.getElementById("folderBtn").onclick =
    () => folderInput.click();


fileInput.onchange = () => {

    const file = fileInput.files[0];

    if (!file) return;

    attachedFile = file;

    attachmentName.textContent =
        file.name;

    attachmentBar.classList.add("show");
};


folderInput.onchange = async () => {

    const files = [...folderInput.files];

    if (!files.length) return;

    setStatus("READING");

    try {

        const formData = new FormData();

        files.forEach(file => {
            formData.append(
                "files",
                file,
                file.webkitRelativePath || file.name
            );
        });

        const response = await fetch(
            `${BACKEND_URL}/read-files`,
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Folder reading failed"
            );
        }

        input.value =
            "Analyze this selected folder:\n\n" +
            data.combined_text;

        setStatus("ONLINE");

        autoResize();

    } catch (error) {

        setStatus("ERROR");

        alert(error.message);
    }
};


document.getElementById("removeAttachment").onclick =
    () => {

        attachedFile = null;

        fileInput.value = "";

        hideAttachment();
    };


function hideAttachment() {

    attachmentBar.classList.remove("show");
}


/* ============================================================
   FILE PROCESSING
============================================================ */

async function processAttachment(file, chat) {

    setStatus("READING");

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

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.detail ||
                "File reading failed"
            );
        }

        const fileText =
            data.text ||
            "";

        chat.messages.push({
            role: "user",
            content:
                `File: ${file.name}\n\n${fileText}`
        });

        addMessageToUI(
            "user",
            `Attached: ${file.name}`
        );

        saveChats();

    } catch (error) {

        addMessageToUI(
            "assistant",
            "File error: " +
            error.message
        );
    }

    setStatus("ONLINE");
}


/* ============================================================
   PDF
============================================================ */

const pdfModal =
    document.getElementById("pdfModal");

document.getElementById("pdfBtn").onclick =
    () => pdfModal.classList.remove("hidden");


document.getElementById("closePdf").onclick =
    () => pdfModal.classList.add("hidden");


document.getElementById("createPdfBtn").onclick =
    async () => {

        const title =
            document.getElementById("pdfTitle")
                .value.trim();

        const content =
            document.getElementById("pdfContent")
                .value.trim();

        if (!content) {

            alert(
                "Write something for the PDF first."
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
                            title:
                                title ||
                                "CodeAI Document",

                            content
                        })
                    }
                );

            if (!response.ok) {

                const error =
                    await response.json();

                throw new Error(
                    error.detail ||
                    "PDF creation failed"
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
                (title ||
                    "CodeAI Document") +
                ".pdf";

            a.click();

            URL.revokeObjectURL(url);

            pdfModal.classList.add("hidden");

            setStatus("ONLINE");

        } catch (error) {

            setStatus("ERROR");

            alert(error.message);
        }
    };


/* ============================================================
   CAMERA
============================================================ */

const cameraModal =
    document.getElementById("cameraModal");

const cameraVideo =
    document.getElementById("cameraVideo");

document.getElementById("cameraBtn").onclick =
    async () => {

        try {

            mediaStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        video: true,
                        audio: false
                    });

            cameraVideo.srcObject =
                mediaStream;

            cameraModal.classList.remove(
                "hidden"
            );

        } catch (error) {

            alert(
                "Camera permission was denied or unavailable."
            );
        }
    };


document.getElementById("closeCamera").onclick =
    closeCamera;


function closeCamera() {

    cameraModal.classList.add("hidden");

    if (mediaStream) {

        mediaStream
            .getTracks()
            .forEach(track =>
                track.stop()
            );

        mediaStream = null;
    }
}


document.getElementById("captureBtn").onclick =
    async () => {

        const canvas =
            document.getElementById(
                "cameraCanvas"
            );

        canvas.width =
            cameraVideo.videoWidth;

        canvas.height =
            cameraVideo.videoHeight;

        const ctx =
            canvas.getContext("2d");

        ctx.drawImage(
            cameraVideo,
            0,
            0
        );

        const image =
            canvas.toDataURL(
                "image/jpeg",
                .85
            );

        closeCamera();

        setStatus("ANALYZING");

        try {

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
                            image,
                            prompt:
                                "Analyze what is visible in this camera image. Be accurate and concise."
                        })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.detail ||
                    "Vision failed"
                );
            }

            addMessageToUI(
                "assistant",
                data.response
            );

            setStatus("ONLINE");

        } catch (error) {

            setStatus("ERROR");

            alert(error.message);
        }
    };


/* ============================================================
   VOICE
============================================================ */

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


if (SpeechRecognition) {

    recognition =
        new SpeechRecognition();

    recognition.lang =
        navigator.language || "en-US";

    recognition.continuous = false;

    recognition.interimResults = true;


    recognition.onstart = () => {

        isListening = true;

        voiceBtn.classList.add(
            "listening"
        );

        input.placeholder =
            "LISTENING";

        setStatus("LISTENING");
    };


    recognition.onresult =
        event => {

            let transcript = "";

            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                transcript +=
                    event.results[i][0]
                        .transcript;
            }

            input.value =
                transcript;

            autoResize();
        };


    recognition.onend = () => {

        isListening = false;

        voiceBtn.classList.remove(
            "listening"
        );

        input.placeholder =
            "Ask CodeAI anything...";

        setStatus("READY");

        if (input.value.trim()) {
            sendMessage();
        }
    };


    recognition.onerror =
        error => {

            console.error(
                "Speech error:",
                error
            );

            isListening = false;

            voiceBtn.classList.remove(
                "listening"
            );

            input.placeholder =
                "Ask CodeAI anything...";

            setStatus("ERROR");
        };


    voiceBtn.onclick = () => {

        if (isListening) {

            recognition.stop();

        } else {

            recognition.start();
        }
    };

} else {

    voiceBtn.onclick = () => {

        alert(
            "Voice recognition is not supported in this browser."
        );
    };
}


/* ============================================================
   MASTER PLAN
============================================================ */

const plansModal =
    document.getElementById("plansModal");


document.getElementById("plansBtn").onclick =
    () => plansModal.classList.remove(
        "hidden"
    );


document.getElementById("topPlanBtn").onclick =
    () => plansModal.classList.remove(
        "hidden"
    );


document.getElementById("closePlans").onclick =
    () => plansModal.classList.add(
        "hidden"
    );


document.getElementById("subscribeBtn").onclick =
    () => {

        alert(
            "Master payment is not connected yet. The payment gateway will be added next."
        );

    };


/* ============================================================
   SETTINGS
============================================================ */

const settingsModal =
    document.getElementById(
        "settingsModal"
    );


document.getElementById("settingsBtn").onclick =
    () => settingsModal.classList.remove(
        "hidden"
    );


document.getElementById("closeSettings").onclick =
    () => settingsModal.classList.add(
        "hidden"
    );


/* ============================================================
   NEW CHAT
============================================================ */

document.getElementById("newChatBtn").onclick =
    createChat;


/* ============================================================
   SEARCH
============================================================ */

chatSearch.oninput =
    renderChatList;


/* ============================================================
   ENTER / RESIZE
============================================================ */

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


function autoResize() {

    input.style.height =
        "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            150
        ) + "px";
}


sendBtn.onclick =
    sendMessage;


/* ============================================================
   MOBILE SIDEBAR
============================================================ */

document.getElementById("mobileMenu")
    .onclick = () => {

        document
            .getElementById("sidebar")
            .classList.toggle("open");
    };


function closeSidebarMobile() {

    document
        .getElementById("sidebar")
        .classList.remove("open");
}


/* ============================================================
   INIT
============================================================ */

if (!chats.length) {

    createChat();

} else {

    if (
        !currentChatId ||
        !getCurrentChat()
    ) {
        currentChatId =
            chats[0].id;
    }

    renderChatList();
    renderMessages();
}

saveChats();