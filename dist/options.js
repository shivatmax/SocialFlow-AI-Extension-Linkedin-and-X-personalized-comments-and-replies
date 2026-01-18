// options.js

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);
document.getElementById('clearMemory').addEventListener('click', clearMemory);
document.getElementById('addActionBtn').addEventListener('click', addAction);
document.getElementById('aiProvider').addEventListener('change', updateModelDropdown);
document.getElementById('modelSelect').addEventListener('change', toggleCustomModelInput);

let customActions = [];

const MODEL_OPTIONS = {
    openai: [
        { value: 'gpt-5.2', label: 'GPT-5.2 (Flagship)' },
        { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
        { value: 'gpt-5-nano', label: 'GPT-5 Nano (Ultra Fast)' },
        { value: 'gpt-4.1', label: 'GPT-4.1' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'custom', label: 'Custom Model ID...' }
    ],
    gemini: [
        { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Deep Reasoning)' },
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Fast Multimodal)' },
        { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
        { value: 'custom', label: 'Custom Model ID...' }
    ]
};

function updateModelDropdown() {
    const provider = document.getElementById('aiProvider').value;
    const select = document.getElementById('modelSelect');
    const currentVal = select.value; // Try to preserve if possible

    select.innerHTML = '';

    const options = MODEL_OPTIONS[provider] || [];
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
    });

    // Reset logic: check if previously selected value exists in new options
    if (currentVal && options.some(o => o.value === currentVal)) {
        select.value = currentVal;
    } else {
        // Default to first option
        select.value = options[0].value;
    }
    toggleCustomModelInput();
}

function toggleCustomModelInput() {
    const select = document.getElementById('modelSelect');
    const customInput = document.getElementById('customModelInput');

    if (select.value === 'custom') {
        customInput.style.display = 'block';
    } else {
        customInput.style.display = 'none';
    }
}

function saveOptions() {
    const provider = document.getElementById('aiProvider').value;
    const apiKey = document.getElementById('apiKey').value.trim();

    const select = document.getElementById('modelSelect');
    let model = select.value;
    if (model === 'custom') {
        model = document.getElementById('customModelInput').value.trim();
    }

    const userBio = document.getElementById('userBio').value.trim();
    const userTone = document.getElementById('userTone').value.trim();

    chrome.storage.sync.set(
        {
            aiProvider: provider,
            openaiKey: apiKey, // keeping key name for backward compat, though it holds either key now
            aiModel: model,
            userBio: userBio,
            userTone: userTone,
            customActions: customActions
        },
        () => {
            const status = document.getElementById('status');
            status.textContent = 'Settings Saved!'
            status.style.opacity = '1';
            setTimeout(() => {
                status.style.opacity = '0';
            }, 2000);
        }
    );
}

function restoreOptions() {
    chrome.storage.sync.get(
        {
            aiProvider: 'openai',
            openaiKey: '',
            aiModel: 'gpt-4o-mini',
            userBio: '',
            userTone: '',
            customActions: [],
            likedReplies: []
        },
        (items) => {
            document.getElementById('aiProvider').value = items.aiProvider;
            document.getElementById('apiKey').value = items.openaiKey;
            document.getElementById('userBio').value = items.userBio;
            document.getElementById('userTone').value = items.userTone;

            // Populate Dropdown
            updateModelDropdown();

            // Set Model Selection
            const model = items.aiModel;
            const select = document.getElementById('modelSelect');

            // Check if stored model is in standard list
            const isStandard = Array.from(select.options).some(o => o.value === model);

            if (isStandard) {
                select.value = model;
            } else {
                // It's a custom model (or migrated legacy value)
                select.value = 'custom';
                document.getElementById('customModelInput').value = model;
            }
            toggleCustomModelInput();

            customActions = items.customActions || [];
            renderActions();
            renderMemories(items.likedReplies);
        }
    );
}

// --- Custom Actions Logic ---

function renderActions() {
    const list = document.getElementById('actionsList');
    list.innerHTML = '';

    if (customActions.length === 0) {
        list.innerHTML = '<div style="color:#666; font-size:13px; font-style:italic;">No custom buttons added yet.</div>';
        return;
    }

    customActions.forEach((action, index) => {
        const item = document.createElement('div');
        item.className = 'action-item';
        item.innerHTML = `
            <div class="action-icon">${action.icon || '⚡'}</div>
            <div class="action-details">
                <div class="action-label">${escapeHtml(action.label)}</div>
                <div class="action-prompt">${escapeHtml(action.prompt)}</div>
            </div>
            <button class="btn btn-delete" data-index="${index}">Delete</button>
        `;
        list.appendChild(item);
    });

    // Add listeners to delete buttons
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            removeAction(idx);
        });
    });
}

function addAction() {
    const iconInput = document.getElementById('newActionIcon');
    const labelInput = document.getElementById('newActionLabel');
    const promptInput = document.getElementById('newActionPrompt');

    const icon = iconInput.value.trim() || '⚡';
    const label = labelInput.value.trim();
    const prompt = promptInput.value.trim();

    if (!label || !prompt) {
        alert('Please provide at least a Label and Instruction.');
        return;
    }

    customActions.push({ icon, label, prompt });
    renderActions();

    // Clear inputs
    iconInput.value = '';
    labelInput.value = '';
    promptInput.value = '';
}

function removeAction(index) {
    customActions.splice(index, 1);
    renderActions();
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- Memory Logic ---

function renderMemories(replies) {
    const list = document.getElementById('memoryList');
    list.innerHTML = '';

    if (!replies || replies.length === 0) {
        list.innerHTML = '<div style="padding:10px; color:#999; text-align:center">No memories yet.</div>';
        return;
    }

    replies.reverse().forEach((reply, index) => {
        const div = document.createElement('div');
        div.className = 'memory-item';

        const textSpan = document.createElement('span');
        textSpan.textContent = `"${reply.text.substring(0, 60)}..."`;
        textSpan.title = reply.text;

        const delBtn = document.createElement('span');
        delBtn.className = 'delete-mem';
        delBtn.textContent = '❌';
        delBtn.onclick = () => removeMemory(replies.length - 1 - index);

        div.appendChild(textSpan);
        div.appendChild(delBtn);
        list.appendChild(div);
    });
}

function clearMemory() {
    if (confirm('Are you sure you want to delete all saved reply memories?')) {
        chrome.storage.sync.set({ likedReplies: [] }, () => {
            renderMemories([]);
        });
    }
}

function removeMemory(originalIndex) {
    chrome.storage.sync.get({ likedReplies: [] }, (items) => {
        const newReplies = items.likedReplies;
        newReplies.splice(originalIndex, 1);
        chrome.storage.sync.set({ likedReplies: newReplies }, () => {
            renderMemories(newReplies);
        });
    });
}
