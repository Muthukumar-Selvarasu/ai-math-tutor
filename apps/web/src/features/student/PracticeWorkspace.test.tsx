import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PracticeWorkspace } from './PracticeWorkspace';
import React from 'react';
import '@testing-library/jest-dom';

describe('PracticeWorkspace', () => {
  const mockQuestion = {
    id: 'q1',
    text: 'If the ratio of apples to oranges is 3:4, and there are 12 apples, how many oranges are there?',
    mathEq: '\\frac{3}{4} = \\frac{12}{x}'
  };

  it('renders question text and math equation', () => {
    render(<PracticeWorkspace question={mockQuestion} onSubmitAttempt={vi.fn()} />);
    
    expect(screen.getByText(mockQuestion.text)).toBeInTheDocument();
    // KaTeX renders math elements inside .katex-html
    const mathElements = document.getElementsByClassName('katex-html');
    expect(mathElements.length).toBeGreaterThan(0);
  });

  it('allows student to type and submit an attempt', async () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PracticeWorkspace question={mockQuestion} onSubmitAttempt={mockSubmit} />);
    
    const input = screen.getByLabelText(/Your Working & Answer/i);
    const submitBtn = screen.getByRole('button', { name: /Submit Attempt/i });
    
    fireEvent.change(input, { target: { value: '16 oranges because 4 * 4 = 16' } });
    expect(input).toHaveValue('16 oranges because 4 * 4 = 16');
    
    fireEvent.click(submitBtn);
    
    expect(mockSubmit).toHaveBeenCalledWith('16 oranges because 4 * 4 = 16');
    
    // verify input is cleared after submission
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('disables submit button while submitting', async () => {
    let resolveSubmit: (value: void) => void;
    const mockSubmit = vi.fn().mockImplementation(() => new Promise(resolve => {
      resolveSubmit = resolve;
    }));
    
    render(<PracticeWorkspace question={mockQuestion} onSubmitAttempt={mockSubmit} />);
    
    const input = screen.getByLabelText(/Your Working & Answer/i);
    const submitBtn = screen.getByRole('button', { name: /Submit Attempt/i });
    
    fireEvent.change(input, { target: { value: 'my answer' } });
    fireEvent.click(submitBtn);
    
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent(/Submitting\.\.\./i);
    
    // @ts-ignore
    resolveSubmit();
    
    await waitFor(() => {
      expect(submitBtn).not.toHaveTextContent(/Submitting\.\.\./i);
    });
  });
});
