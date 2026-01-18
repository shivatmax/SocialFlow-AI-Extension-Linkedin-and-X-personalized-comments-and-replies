// Popup script for SocialFlowAI extension

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const promptLabel = document.getElementById('prompt-label');
const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const cancelBtn = document.getElementById('cancel-btn');
const loadingDiv = document.getElementById('loading');
const resultDiv = document.getElementById('result');
const resultText = document.getElementById('result-text');
const copyBtn = document.getElementById('copy-btn');

// Current state
let activeTab = 'new';
let generatedContent = '';

// Initialize
function init() {
  // Set default tab to new post
  activeTab = 'new';

  // Check if we have content from LinkedIn editor in session storage
  try {
    const editorContent = sessionStorage.getItem('SocialFlowAI_editor_content');
    if (editorContent) {
      promptInput.value = editorContent;
      // Clear storage after using it
      sessionStorage.removeItem('SocialFlowAI_editor_content');
    }
  } catch (e) {
    console.error('Error reading from session storage:', e);
  }

  updateUI();
  addEventListeners();

  // Focus on the input field
  setTimeout(() => {
    promptInput.focus();
  }, 100);
}

// Update UI based on active tab
function updateUI() {
  // Update tab styling
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.type === activeTab);
  });

  // Update prompt label and placeholder
  switch (activeTab) {
    case 'new':
      promptLabel.textContent = 'What kind of post would you like to create?';
      promptInput.placeholder = 'e.g., Announce our new product update with enthusiasm';
      break;
    case 'reply':
      promptLabel.textContent = 'How would you like to reply to this post?';
      promptInput.placeholder = 'e.g., Write a supportive response';
      break;
    case 'repost':
      promptLabel.textContent = 'How would you like to share this post?';
      promptInput.placeholder = 'e.g., Summarize with excitement and mention its value for developers';
      break;
  }
}

// Add event listeners
function addEventListeners() {
  // Settings Button
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.type;
      updateUI();
    });
  });

  // Generate button
  generateBtn.addEventListener('click', handleGenerate);

  // Cancel button
  cancelBtn.addEventListener('click', () => {
    window.close();
  });

  // Copy button with visual feedback
  copyBtn.addEventListener('click', () => {
    copyToClipboard(generatedContent);
  });

  // Add "Use in LinkedIn" button to result section
  if (!document.getElementById('insert-btn')) {
    const insertBtn = document.createElement('button');
    insertBtn.id = 'insert-btn';
    insertBtn.className = 'copy-btn';
    insertBtn.style.cssText = `
      position: absolute;
      top: 12px;
      right: 65px;
      padding: 3px 8px;
      font-size: 0.8rem;
      background-color: #0a66c2;
      color: white;
      border: none;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 2px;
    `;
    insertBtn.innerHTML = '📝 Use in LinkedIn';
    insertBtn.addEventListener('click', insertIntoLinkedIn);
    resultDiv.appendChild(insertBtn);
  }

  // Add keyboard shortcut (Ctrl+Enter or Cmd+Enter) to generate
  promptInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleGenerate();
    }
  });

  // Input validation
  promptInput.addEventListener('input', () => {
    generateBtn.disabled = !promptInput.value.trim();
  });
}

// Insert generated content into LinkedIn
function insertIntoLinkedIn() {
  if (!generatedContent) return;

  // Show loading feedback
  const insertBtn = document.getElementById('insert-btn');
  if (insertBtn) {
    insertBtn.innerHTML = '⏳ Inserting...';
    insertBtn.style.backgroundColor = '#888';
  }

  // Send message to content script to insert the content
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0]) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'insertContentIntoEditor', text: generatedContent },
        function (response) {
          if (response && response.success) {
            // Show success feedback
            if (insertBtn) {
              insertBtn.innerHTML = '✓ Inserted!';
              insertBtn.style.backgroundColor = '#4caf50';
              setTimeout(() => {
                window.close();
              }, 1000);
            }
          } else {
            // Show failure feedback but also copy text automatically as fallback
            if (insertBtn) {
              insertBtn.innerHTML = '✗ Failed!';
              insertBtn.style.backgroundColor = '#e53935';
            }

            // Auto-copy the content to clipboard as fallback
            copyToClipboard(generatedContent);
            copyBtn.textContent = 'Copied! ✓';
            copyBtn.style.backgroundColor = '#4caf50';

            // Show more helpful error message
            alert('Could not insert content into LinkedIn editor.\n\nThe content has been copied to your clipboard. Please manually paste it into LinkedIn.');
          }
        }
      );
    } else {
      if (insertBtn) {
        insertBtn.innerHTML = '✗ No tab!';
        insertBtn.style.backgroundColor = '#e53935';
      }
      alert('Cannot find LinkedIn tab. Please ensure you have LinkedIn open in your browser.');
    }
  });
}

// Handle generate button click
function handleGenerate() {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    alert('Please enter a prompt');
    return;
  }

  // Show loading
  loadingDiv.style.display = 'block';
  resultDiv.style.display = 'none';
  generateBtn.disabled = true;

  // Send message to background script
  chrome.runtime.sendMessage(
    {
      action: 'generatePost',
      prompt: prompt,
      type: activeTab
    },
    response => {
      // Hide loading
      loadingDiv.style.display = 'none';

      if (response && response.success) {
        // Save the generated content
        generatedContent = response.text;

        // Show result
        resultText.textContent = response.text;
        resultDiv.style.display = 'block';

        // Scroll to the result
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Automatically select the text for easy copying
        selectElementText(resultText);
      } else {
        alert('Error generating content. Please try again.');
      }

      generateBtn.disabled = false;
    }
  );
}

// Helper function to copy text to clipboard with visual feedback
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => {
      // Show visual feedback
      copyBtn.textContent = 'Copied! ✓';
      copyBtn.style.backgroundColor = '#4caf50';

      // Restore button after 2 seconds
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.style.backgroundColor = '#0a66c2';
      }, 2000);
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
      copyBtn.textContent = 'Failed to copy';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    });
}

// Helper function to select all text in an element
function selectElementText(element) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init); 