'use client';

import { useState } from 'react';

export default function PopupPage() {
  const [activeTab, setActiveTab] = useState<'new' | 'reply' | 'repost'>('new');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setResult('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          type: activeTab === 'new' ? 'new_post' : activeTab === 'reply' ? 'reply' : 'repost',
        }),
      });

      const data = await response.json();
      setResult(data.generatedText);
    } catch (error) {
      console.error('Error generating content:', error);
      alert('An error occurred while generating content');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-[400px] p-4 bg-white text-gray-800">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-blue-600 flex items-center">
          <span className="mr-2">📬</span>
          SocialFlowAI
        </h1>
        <p className="text-sm text-gray-600">An AI LinkedIn content assistant</p>
      </header>

      <div className="flex border-b border-gray-200 mb-4">
        <button
          className={`px-3 py-2 ${activeTab === 'new' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('new')}
        >
          📝 New Post
        </button>
        <button
          className={`px-3 py-2 ${activeTab === 'reply' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('reply')}
        >
          💬 Reply
        </button>
        <button
          className={`px-3 py-2 ${activeTab === 'repost' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('repost')}
        >
          🔁 Repost
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          {activeTab === 'new' ? 'What kind of post would you like to create?' :
            activeTab === 'reply' ? 'How would you like to reply to this post?' :
              'How would you like to share this post?'}
        </label>
        <textarea
          className="w-full p-2 border border-gray-300 rounded-md"
          rows={3}
          placeholder={
            activeTab === 'new' ? 'e.g., Announce our new product update with enthusiasm' :
              activeTab === 'reply' ? 'e.g., Write a supportive response' :
                'e.g., Summarize with excitement and mention its value for developers'
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      <div className="flex justify-between">
        <button
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          onClick={() => window.close()}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
        >
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {result && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h3 className="text-sm font-medium mb-2">Generated content:</h3>
          <p className="text-sm whitespace-pre-wrap">{result}</p>
          <div className="mt-3 flex justify-end">
            <button
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md"
              onClick={() => {
                navigator.clipboard.writeText(result);
                alert('Copied to clipboard!');
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 