// Background service worker for SocialFlowAI extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('SocialFlowAI extension installed');
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveLike') {
    handleSaveLike(request)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Handle content generation requests
  if (request.action === 'generatePost') {
    console.log('Received request to generate content:', request);

    // Call the API asynchronously
    callAIEndpoint(request)
      .then(text => {
        sendResponse({ success: true, text: text });
      })
      .catch(error => {
        console.error('Error calling AI:', error);
        sendResponse({ success: false, error: error.message || 'Failed to generate content' });
      });

    return true; // Keep message channel open for async response
  }

  if (request.action === 'openPopup') {
    try {
      chrome.action.openPopup();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error opening popup:', error);
      sendResponse({ success: false, error: error.message || 'Failed to open popup' });
    }
    return true;
  }

  if (request.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
});

async function handleSaveLike(request) {
  const { text, context } = request;
  const items = await chrome.storage.sync.get({ likedReplies: [] });
  const newReplies = items.likedReplies;

  // Simple deduplication
  if (!newReplies.some(r => r.text === text)) {
    newReplies.push({ text, context, timestamp: Date.now() });
    // Keep only last 20
    if (newReplies.length > 20) newReplies.shift();
    await chrome.storage.sync.set({ likedReplies: newReplies });
  }
}

// --- OpenAI & Gemini Integration ---

async function callAIEndpoint(request) {
  // Retrieve Settings & Memory
  const settings = await chrome.storage.sync.get({
    aiProvider: 'openai',
    openaiKey: '',
    aiModel: '',
    userBio: '',
    userTone: '',
    likedReplies: []
  });

  const { aiProvider, openaiKey, aiModel, userBio, userTone, likedReplies } = settings;

  if (!openaiKey) {
    return "⚠️ Setup Required: Please click the extension icon -> Settings ⚙️ and enter your API Key.";
  }

  const { prompt, type, context, images, platform } = request;

  // --- PERSONA CONSTRUCTION (Shared) ---
  let systemPrompt = '';

  if (userBio) {
    systemPrompt += `You are this person:\n"${userBio}"\n\n`;
  } else {
    systemPrompt += `You are a professional, helpful, and witty social media assistant.\n`;
  }

  if (userTone) {
    systemPrompt += `YOUR TONE: ${userTone}\n`;
  } else {
    systemPrompt += `YOUR TONE: Professional, conversational, and authentic. No corporate jargon.\n`;
  }

  systemPrompt += `
GOAL: Write a short, high-impact reply or post.
- Sound human and natural.
- Add value or insight.
`;

  if (likedReplies && likedReplies.length > 0) {
    const examples = likedReplies.slice(-3).map(r => `"${r.text}"`).join("\n");
    systemPrompt += `\n\n[STYLE EXAMPLES - Mimic this style]:\n${examples}`;
  }

  if (platform === 'twitter') {
    systemPrompt += `\n\n[TWITTER/X MODE]
    - STYLE: Casual, short, punchy.
    - LENGTH: STRICTLY under 280 chars. Aim for 10-20 words.
    - FORMAT: Lowercase logic allowed if fits tone. No formal greetings.`;
  } else {
    systemPrompt += `\n\n[LINKEDIN MODE]
    - STYLE: Professional but human.
    - FORMAT: Use short paragraphs. Use 1-2 emojis if appropriate.`;
  }

  // --- TASK INSTRUCTION ---
  switch (type) {
    case 'new_post':
      systemPrompt += `\n\nTASK: Create an engaging post based on this idea: "${prompt}". Keep passed context in mind if any.`;
      break;

    case 'custom':
      systemPrompt += `\n\nTASK: REPLY to the context. 
        INSTRUCTION: ${prompt}
        LENGTH: Short (1-2 sentences).`;
      break;

    case 'reply':
    case 'reply_question':
    case 'reply_suggest':
    case 'reply_funny':
    case 'reply_sarcastic':
      systemPrompt += `\n\nTASK: Generate a REPLY based on the post context.
        - LENGTH: STRICTLY 1 sentence. Max 20 words.
        - OUTPUT: ONLY the final comment text.`;

      if (type === 'reply_question') systemPrompt += " Focus: Ask a thought-provoking question.";
      if (type === 'reply_suggest') systemPrompt += " Focus: Add a specific insight or suggestion.";
      if (type === 'reply_funny') systemPrompt += " Focus: Be witty or use light humor.";
      if (type === 'reply_sarcastic') systemPrompt += " Focus: Use sarcasm to make a point.";
      break;

    case 'fix_grammar':
      systemPrompt = "You are an expert editor. Fix grammar, spelling, and clarity. Return ONLY corrected text.";
      break;
  }

  // --- CONTEXT PREPARATION ---
  let finalPrompt = '';

  if (type === 'custom') {
    finalPrompt = `CONTEXT (Post I am replying to):\n"${context || 'No context found'}"`;
  } else {
    if (context) {
      if (context.includes('Replying to comment by')) {
        finalPrompt = `I am replying to a specific comment in a thread.
            
    ${context}

    INSTRUCTION: Reply ONLY to the "Replying to comment" section.
    My draft/notes: ${prompt}`;
      } else {
        finalPrompt = `Context from the post I am replying to:\n"${context}"\n\nMy draft/notes: ${prompt}`;
      }
    } else {
      finalPrompt = prompt;
    }
  }

  // --- ENGINE SELECTION ---

  if (aiProvider === 'gemini') {
    // --- GEMINI HANDLER ---
    const model = aiModel || 'gemini-1.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${openaiKey}`;

    // Gemini doesn't support image URLs directly in the same way. We skip images for now or would need to fetch base64.
    // Assuming text-only for V1 of Gemini support.

    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: finalPrompt }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 500
      }
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API Error: ${errData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      // Parsing Gemini Response
      if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error('Gemini returned no content.');
      }
    } catch (error) {
      console.error('Gemini Call Failed:', error);
      throw error;
    }

  } else {
    // --- OPENAI HANDLER (Default) ---
    const model = aiModel || 'gpt-4o-mini';

    const messages = [
      { role: "system", content: systemPrompt }
    ];

    const userContent = [{ type: "text", text: finalPrompt }];

    // OpenAI Image Handling
    if (images && images.length > 0) {
      userContent.push({
        type: "image_url",
        image_url: { url: images[0] }
      });
    }

    messages.push({ role: "user", content: userContent });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Invalid API Key. Please check settings.');
        }
        throw new Error(`OpenAI API Error: ${errData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();

    } catch (error) {
      console.error('OpenAI Call Failed:', error);
      throw error;
    }
  }
}