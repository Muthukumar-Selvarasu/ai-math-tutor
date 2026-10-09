import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';

interface Message {
  id: string;
  role: 'tutor' | 'student';
  content: string;
}

export default function Workspace() {
  const { sessionId } = useParams();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'tutor',
      content: 'Hello! I am your AI math tutor. Are you ready to practice some ratios? Here is a question:\nIf the ratio of apples to oranges is $3:4$ and there are $6$ apples, how many oranges are there?',
    },
  ]);
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'student',
      content: input,
    };

    setMessages([...messages, newMessage]);
    setInput('');
    
    // Simulate tutor response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + '1',
          role: 'tutor',
          content: 'That is an interesting thought. Let us break it down. What does the ratio $3:4$ tell us?',
        },
      ]);
    }, 1000);
  };

  const renderContent = (content: string) => {
    // Basic regex to find inline math wrapped in $...$
    const parts = content.split(/(\$.*?\$)/g);
    return parts.map((part, i) => {
      if (part.startsWith('$') && part.endsWith('$')) {
        return <InlineMath key={i} math={part.slice(1, -1)} />;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">SolvePath Tutor</h1>
        <div className="text-sm text-gray-500">
          Session {sessionId || 'Demo'}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === 'student' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-6 py-4 shadow-sm ${
                msg.role === 'student'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
              }`}
            >
              <div className="text-sm font-medium mb-1 opacity-75">
                {msg.role === 'student' ? 'You' : 'Tutor'}
              </div>
              <div className="text-base whitespace-pre-wrap leading-relaxed">
                {renderContent(msg.content)}
              </div>
            </div>
          </div>
        ))}
      </main>

      <footer className="bg-white border-t border-gray-200 p-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto flex items-center space-x-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer or working here..."
            className="flex-1 rounded-full border border-gray-300 px-6 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 py-3 font-medium transition-colors"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
