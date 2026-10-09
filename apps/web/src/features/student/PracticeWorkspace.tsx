import React, { useState } from 'react';
import { InlineMath, BlockMath } from 'react-katex';

interface Question {
  id: string;
  text: string;
  mathEq?: string;
}

interface PracticeWorkspaceProps {
  question: Question;
  onSubmitAttempt: (attempt: string) => Promise<void>;
}

export function PracticeWorkspace({ question, onSubmitAttempt }: PracticeWorkspaceProps) {
  const [attempt, setAttempt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attempt.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmitAttempt(attempt);
      setAttempt('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-md space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900" id="question-heading">Practice Question</h2>
        <div className="text-gray-700 text-lg" role="region" aria-labelledby="question-heading">
          <p>{question.text}</p>
          {question.mathEq && (
            <div className="my-4 p-4 bg-gray-50 rounded-lg text-center overflow-x-auto">
              <BlockMath math={question.mathEq} />
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="attempt-input" className="block text-sm font-medium text-gray-700 mb-2">
            Your Working & Answer
          </label>
          <textarea
            id="attempt-input"
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Show your working here..."
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            disabled={isSubmitting}
            aria-label="Student answer input"
          />
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !attempt.trim()}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Attempt'}
          </button>
        </div>
      </form>
    </div>
  );
}
