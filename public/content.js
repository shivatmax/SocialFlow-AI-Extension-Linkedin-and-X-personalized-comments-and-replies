// Content script for SocialFlowAI - LinkedIn integration

// --- Styles ---
const styles = `
  .SocialFlowAI-trigger-btn {
    position: absolute;
    right: 12px;
    bottom: 12px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: white;
    border: 1px solid #0a66c2;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    z-index: 1000;
    transition: all 0.2s ease;
    padding: 0;
  }
  .SocialFlowAI-trigger-btn:hover {
    transform: scale(1.1);
    background: #f3f2ef;
    box-shadow: 0 4px 8px rgba(0,0,0,0.25);
  }
  
  .SocialFlowAI-new-post-btn {
    background-color: #0a66c2;
    color: white;
    border: none;
    border-radius: 16px;
    padding: 6px 16px;
    font-weight: 600;
    margin-left: 8px;
    cursor: pointer;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background-color 0.2s;
  }
  .SocialFlowAI-new-post-btn:hover {
    background-color: #004182;
  }

  .SocialFlowAI-menu {
    position: absolute;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 6px;
    z-index: 10001;
    display: flex;
    flex-direction: column;
    width: 180px;
    border: 1px solid #e0e0e0;
    font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    animation: fadeIn 0.15s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .SocialFlowAI-menu-item {
    padding: 8px 12px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 14px;
    color: #333;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 10px;
    border: none;
    background: transparent;
    text-align: left;
    width: 100%;
  }
  .SocialFlowAI-menu-item:hover {
    background-color: #eef3f8;
    color: #0a66c2;
  }
  .SocialFlowAI-loader {
    display: flex; 
    align-items: center; 
    justify-content: center; 
    padding: 10px;
    color: #666;
    font-size: 12px;
  }
`;

const styleSheet = document.createElement("style");
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// --- State ---
let activeMenu = null;

// --- 1. New Post Button Logic ---
setInterval(() => {
  // Look for the "Start a post" or similar entry point buttons on LinkedIn
  const shareBox = document.querySelector('.share-box-feed-entry__trigger-container, .share-box-feed-entry-v3__trigger');
  if (shareBox && !shareBox.querySelector('.SocialFlowAI-new-post-btn')) {
    const btn = document.createElement('button');
    btn.className = 'SocialFlowAI-new-post-btn';
    btn.innerHTML = '<span>✨</span> AI Post';
    btn.type = 'button';
    btn.onclick = () => {
      try {
        chrome.runtime.sendMessage({ action: 'openPopup' });
      } catch (e) {
        console.warn('SocialFlowAI: Extension context invalidated. Please refresh the page.');
      }
    };
    shareBox.appendChild(btn);
  }
}, 2000);


// --- 2. Comment Assistance Logic ---

document.addEventListener('focusin', (e) => {
  const target = e.target;
  // Check for contentEditable or Textarea
  if ((target.isContentEditable || target.tagName === 'TEXTAREA' || target.getAttribute('role') === 'textbox')) {
    if (isValidEditor(target)) {
      const wrapper = target.parentElement;
      // Avoid re-attaching
      if (wrapper && !wrapper.querySelector('.SocialFlowAI-trigger-btn')) {
        // Double check we don't attach inside the button itself
        if (!target.closest('.SocialFlowAI-menu')) {
          attachSocialFlowAI(target);
        }
      }
    }
  }
});

function isValidEditor(el) {
  const isLinkedIn = window.location.hostname.includes('linkedin.com');
  const isTwitter = window.location.hostname.includes('x.com') || window.location.hostname.includes('twitter.com');

  if (isLinkedIn) {
    const classes = el.className || '';
    const parentClasses = el.parentElement?.className || '';
    return (
      classes.includes('ql-editor') ||
      classes.includes('editor-content') ||
      el.getAttribute('role') === 'textbox' ||
      (el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('comment')) ||
      parentClasses.includes('comments-comment-box')
    );
  }

  if (isTwitter) {
    // X uses specific testids for the tweet textarea or generic textboxes
    const testId = el.getAttribute('data-testid') || '';
    return (
      testId.startsWith('tweetTextarea') ||
      (el.getAttribute('role') === 'textbox' && el.getAttribute('contenteditable') === 'true')
    );
  }

  return false;
}

function attachSocialFlowAI(editor) {
  const wrapper = editor.parentElement;
  if (!wrapper) return;
  const currentPos = window.getComputedStyle(wrapper).position;
  if (currentPos === 'static') wrapper.style.position = 'relative';

  const btn = document.createElement('button');
  btn.className = 'SocialFlowAI-trigger-btn';
  btn.innerHTML = '✨';
  btn.title = 'AI Assistant';
  btn.type = 'button';
  btn.style.zIndex = '9999'; // High Z-Index for Twitter overlay
  btn.onmousedown = (e) => e.preventDefault();
  btn.onclick = (e) => {
    e.stopPropagation();
    toggleMenu(btn, editor);
  };
  wrapper.appendChild(btn);
}

function toggleMenu(triggerBtn, editor) {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
    return;
  }

  const menu = document.createElement('div');
  menu.className = 'SocialFlowAI-menu';

  // Load custom actions
  chrome.storage.sync.get({ customActions: [] }, (items) => {
    const customActions = items.customActions || [];

    const defaultOptions = [
      { label: 'Question', icon: '❓', action: 'reply_question' },
      { label: 'Suggest', icon: '💡', action: 'reply_suggest' },
      { label: 'Funny', icon: '😂', action: 'reply_funny' },
      { label: 'Sarcastic', icon: '😏', action: 'reply_sarcastic' }
    ];

    // Helper to create menu item
    const createItem = (opt, isCustom = false) => {
      const item = document.createElement('button');
      item.className = 'SocialFlowAI-menu-item';
      item.innerHTML = `<span>${opt.icon || '⚡'}</span> ${opt.label}`;

      item.onclick = async () => {
        menu.innerHTML = '<div class="SocialFlowAI-loader"> Analyzing Post... </div>';

        const userDraft = editor.innerText || editor.value || '';

        // Determine Prompt:
        // For default actions, we might pass userDraft if they typed something (though usually empty for quick buttons).
        // For custom actions, the "prompt" is the instruction itself (e.g. "Roast this").

        let finalPrompt = userDraft;
        let actionType = opt.action;

        if (isCustom) {
          actionType = 'custom';
          finalPrompt = opt.prompt; // Pass the custom instruction as the prompt
        }

        // Extract Context including Image URLs
        const { text: postText, images: postImages } = getPostContext(editor);
        const isTwitter = window.location.hostname.includes('x.com') || window.location.hostname.includes('twitter.com');

        try {
          const response = await chrome.runtime.sendMessage({
            action: 'generatePost',
            type: actionType,
            prompt: finalPrompt,
            context: postText,
            images: postImages,
            platform: isTwitter ? 'twitter' : 'linkedin'
          });

          if (response && response.text) {
            insertText(editor, response.text);

            // Show "Save to Memory" Toast
            showSaveToast(triggerBtn, response.text, postText);
          } else if (response && response.error) {
            alert('Error: ' + response.error);
          }
        } catch (err) {
          console.warn('SocialFlowAI Error:', err);
          alert('Error generating text.');
        }

        menu.remove();
        activeMenu = null;
      };
      return item;
    };

    // 1. Default Options
    defaultOptions.forEach(opt => menu.appendChild(createItem(opt)));

    // 2. Custom Options
    if (customActions.length > 0) {
      const divider = document.createElement('div');
      divider.style.cssText = 'height:1px; background:#eee; margin:4px 0;';
      menu.appendChild(divider);

      customActions.forEach(opt => menu.appendChild(createItem(opt, true)));
    }

    // Add "Settings" small link
    const divider2 = document.createElement('div');
    divider2.style.cssText = 'height:1px; background:#eee; margin:4px 0;';
    menu.appendChild(divider2);

    const settingsLink = document.createElement('div');
    settingsLink.style.cssText = 'padding: 6px 12px; font-size: 11px; color:#0a66c2; cursor:pointer; text-align:center;';
    settingsLink.innerText = '⚙️ Settings / Add Buttons';
    settingsLink.onclick = () => {
      chrome.runtime.sendMessage({ action: 'openOptions' });
      menu.remove();
      activeMenu = null;
    };
    menu.appendChild(settingsLink);


    document.body.appendChild(menu);

    // Position menu...
    const rect = triggerBtn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 5}px`;

    let left = rect.left + window.scrollX - 150;
    if (left < 10) left = 10;
    menu.style.left = `${left}px`;

    activeMenu = menu;

    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== triggerBtn) {
        menu.remove();
        activeMenu = null;
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  });
}

function showSaveToast(triggerBtn, text, context) {
  const toast = document.createElement('div');
  toast.className = 'SocialFlowAI-toast';
  toast.innerHTML = `
        <span>Did you like this reply?</span>
        <button id="pp-like-btn">👍 Save Style</button>
        <button id="pp-close-toast">×</button>
    `;
  toast.style.cssText = `
        position: absolute;
        background: #333;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 13px;
        z-index: 10002;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: fadeIn 0.2s ease-out;
    `;

  // Position near the button
  const rect = triggerBtn.getBoundingClientRect();
  toast.style.top = `${rect.bottom + window.scrollY + 5}px`;
  toast.style.left = `${rect.left + window.scrollX - 100}px`;

  document.body.appendChild(toast);

  document.getElementById('pp-like-btn').onclick = () => {
    chrome.runtime.sendMessage({
      action: 'saveLike',
      text: text,
      context: context
    });
    toast.innerHTML = '<span>Saved to Memory! ✨</span>';
    setTimeout(() => toast.remove(), 2000);
  };

  document.getElementById('pp-close-toast').onclick = () => toast.remove();

  // Auto-remove after 10s
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 10000);
}

// --- Context Extraction ---

function getPostContext(editor) {
  console.log('SocialFlowAI: Starting context extraction...');

  if (window.location.hostname.includes('x.com') || window.location.hostname.includes('twitter.com')) {
    return getTwitterContext(editor);
  }

  return getLinkedInContext(editor);
}

function getTwitterContext(editor) {
  let text = '';
  console.log('SocialFlowAI: Extraction for Twitter/X');

  // Strategy 1: Look for text content in the main tweet container (often 'article' or specific cell)
  // If replying in a modal/overlay:
  const modal = editor.closest('[role="dialog"]') || document.querySelector('[role="dialog"]');

  if (modal) {
    console.log('SocialFlowAI: Detected Twitter Modal/Dialog');
    // In a modal, the parent tweet is usually present above
    const tweets = modal.querySelectorAll('[data-testid="tweetText"]');
    if (tweets.length > 0) {
      // Take the first or last depending on UI structure. Usually capturing all provides enough context.
      tweets.forEach(t => text += t.innerText + '\n');
    }
  } else {
    // Timeline or Detail View
    // Find all tweets that are visually *above* this editor
    const allTweets = Array.from(document.querySelectorAll('[data-testid="tweetText"]'));
    const editorRect = editor.getBoundingClientRect();

    let closestTweet = null;
    let minDistance = Infinity;

    allTweets.forEach(el => {
      const rect = el.getBoundingClientRect();
      // Check if tweet is above the editor
      if (rect.bottom < editorRect.top + 150) {
        const dist = editorRect.top - rect.bottom;
        if (dist >= 0 && dist < minDistance) {
          minDistance = dist;
          closestTweet = el;
        }
      }
    });

    if (closestTweet) {
      text = closestTweet.innerText;
      // Try to get author
      const tweetContainer = closestTweet.closest('article');
      if (tweetContainer) {
        const userEl = tweetContainer.querySelector('[data-testid="User-Name"]');
        if (userEl) {
          text = `Replying to @${userEl.innerText.split('\n')[0]}: "${text}"`;
        }
      }
    }
  }

  console.log('SocialFlowAI: Found X tweet text:', text);
  return { text, images: [] };
}

function getLinkedInContext(editor) {
  console.log('SocialFlowAI: LinkedIn extraction logic...');
  console.log('SocialFlowAI: Editor element:', editor);

  // DEBUG: Trace ancestry to find the comment container
  let tempEl = editor;
  const ancestors = [];
  while (tempEl.parentElement && ancestors.length < 10) {
    ancestors.push(tempEl.parentElement.className);
    tempEl = tempEl.parentElement;
  }
  console.log('SocialFlowAI: Editor Ancestry:', ancestors);

  let contextText = '';

  // --- CHECK FOR PARENT COMMENT (Reply to a comment) ---
  // Try to find the closest comment item container
  let parentComment = editor.closest('.comments-comment-item, .comments-comments-list__comment-item, article.comments-comment-item, .comments-comment-item--highlighted, .comments-comment-entity, article.comments-comment-entity');

  // Fallback: If strict parent not found, check if we are in a reply box and find the entity wrapper
  if (!parentComment) {
    const replyBox = editor.closest('.comments-comment-box, .comments-comment-box--reply, .comments-comment-box--cr');
    if (replyBox) {
      console.log('SocialFlowAI: Found reply box. Searching upwards for entity wrapper...');
      // Go up until we find the entity wrapper
      parentComment = replyBox.closest('.comments-comment-entity, .comments-comment-item, article');

      if (!parentComment) {
        // If closest() didn't find it, try naive parent walking (3 levels up max)
        let p = replyBox.parentElement;
        for (let i = 0; i < 3; i++) {
          if (p && p.className && ((p.className.includes && p.className.includes('comment-entity')) || (p.tagName === 'ARTICLE'))) {
            parentComment = p;
            break;
          }
          if (p) p = p.parentElement;
        }
      }
    }
  }

  if (parentComment) {
    console.log('SocialFlowAI: Inspecting potential parent comment container:', parentComment.className || 'No Class');

    // Extract text from this specific comment
    const commentTextEl = parentComment.querySelector(
      '.comments-comment-item__main-content, ' +
      '.feed-shared-text, ' +
      '.comments-comment-item__text, ' +
      '.update-components-text, ' +
      '.comments-comment-item__content-body, ' +
      '.tvm-parent-container, ' +
      '.comments-comment-bridge-item__main-content, ' +
      '.comments-comment-entity__content, ' +
      'span[dir="ltr"]'
    );

    if (commentTextEl) {
      let cText = commentTextEl.innerText.trim();
      cText = cText.replace(/…see more$/gi, '').replace(/\.\.\.see more$/i, '');

      // Get author of the comment
      const commentAuthorEl = parentComment.querySelector('.comments-post-meta__name-text, .comments-comment-item__name, .comments-post-meta__profile-link, .link-without-visited-state');
      const commentAuthor = commentAuthorEl ? commentAuthorEl.innerText.trim().split('\n')[0] : 'User';

      console.log(`SocialFlowAI: Found parent comment by ${commentAuthor}: "${cText.substring(0, 30)}..."`);
      contextText += `Replying to comment by ${commentAuthor}:\n"${cText}"\n\n---\nOriginal Post Context:\n`;
    } else {
      console.warn('SocialFlowAI: Found parent comment container but NO text element. Container classes:', parentComment.className);
      // console.log('SocialFlowAI: Container innerHTML structure (truncated):', parentComment.innerHTML.substring(0, 500));
    }
  } else {
    console.log('SocialFlowAI: No parent comment container found (Top-level comment or detection failed).');
  }

  // --- MAIN POST CONTEXT ---
  // Look for the closest feed update container
  const feedUpdate = editor.closest('.feed-shared-update-v2') ||
    editor.closest('.occludable-update') ||
    editor.closest('li.occludable-update') ||
    editor.closest('div[data-urn]') ||
    editor.closest('article') ||
    editor.closest('.feed-shared-update-detail-viewer');

  if (!feedUpdate) {
    console.warn('SocialFlowAI: Could not find parent feed update container from editor:', editor);
    const parent = editor.parentElement?.parentElement?.parentElement;
    if (parent) console.log('SocialFlowAI: Grandparent class:', parent.className);

    // Return what we have if it's just a comment reply without main post context (rare but possible in modals)
    return { text: contextText, images: [] };
  }

  console.log('SocialFlowAI: Found feed container:', feedUpdate.className || 'No class');

  let text = '';

  // 1. Get Text Content
  const textEls = feedUpdate.querySelectorAll('.feed-shared-update-v2__description, .feed-shared-text, .update-components-text, .update-components-update-v2__commentary');

  // Use a Set to avoid duplicate text from nested elements
  const seenText = new Set();

  textEls.forEach(el => {
    // Basic filtering to avoid menu items or hidden text
    if (el.offsetParent === null) return; // Hidden
    // Avoid re-capturing the comment we are replying to if it happens to be selected
    if (parentComment && parentComment.contains(el)) return;

    // Skip if this element contains other text elements we will process separately
    if (el.querySelector('.feed-shared-update-v2__description, .update-components-text')) return;

    let t = el.innerText.trim();

    // Clean up "see more" text if present
    t = t.replace(/…see more$/gi, '').replace(/\.\.\.see more$/i, '');

    if (t.length > 5 && !seenText.has(t)) {
      text += t + '\n';
      seenText.add(t);
    }
  });

  // Fallback: If no text found, look for aria-label on the article itself
  if (text.length < 10 && feedUpdate.getAttribute('aria-label')) {
    text += feedUpdate.getAttribute('aria-label') + '\n';
  }

  // 2. Get Images (Src and Alt)
  const images = [];
  const imgEls = feedUpdate.querySelectorAll('img');

  imgEls.forEach(img => {
    // Filter out profile pics (often small, circular, or specific classes)
    const isProfile = img.className.includes('ghost-person') ||
      img.className.includes('actor__image') ||
      img.closest('.update-components-actor__image') ||
      img.closest('.feed-shared-actor__image') ||
      img.closest('.update-components-actor__container') ||
      (img.width < 100 && img.height < 100);

    // Exclude reactions and miscellaneous icons
    const isIcon = img.className.includes('reactions-icon') ||
      img.className.includes('artdeco-button__icon') ||
      img.src.includes('data:image');

    if (!isProfile && !isIcon && img.src) {
      // console.log('SocialFlowAI: Found potential content image:', img.src);
      images.push(img.src);
      if (img.alt && img.alt.trim().length > 0) {
        text += `[Image Alt Text: ${img.alt}] `;
      }
    }
  });

  // 3. Get Author
  const authorEl = feedUpdate.querySelector('.update-components-actor__name, .feed-shared-actor__name, .update-components-actor__title');
  if (authorEl) {
    const authorName = authorEl.innerText.split('\n')[0]; // Take first line only
    text = `Post by ${authorName}: ${text}`;
  }

  // Combine Comment Context + Main Post Context
  contextText += text;

  console.log('SocialFlowAI: Extracted Context:', { textLength: contextText.length, imagesCount: images.length });
  return { text: contextText, images };
}

function insertText(editor, text) {
  editor.focus();
  if (editor.isContentEditable) {
    const success = document.execCommand('insertText', false, text);
    if (!success) {
      editor.innerText = text;
    }
  } else {
    editor.value = text;
  }
  ['input', 'change', 'textInput'].forEach(type => {
    editor.dispatchEvent(new Event(type, { bubbles: true }));
  });
}