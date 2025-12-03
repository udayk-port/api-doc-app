'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function AuthBar() {
  const { token, setToken, clearToken, isAuthenticated } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleApply = useCallback(() => {
    if (inputValue.trim()) {
      // Strip "Bearer " prefix if user included it
      let tokenValue = inputValue.trim();
      if (tokenValue.toLowerCase().startsWith('bearer ')) {
        tokenValue = tokenValue.substring(7);
      }
      setToken(tokenValue);
      setInputValue('');
      setIsExpanded(false);
      // Note: Don't call onAuthChange here - the useEffect in page.tsx 
      // will automatically refetch when the token context changes
    }
  }, [inputValue, setToken]);

  const handleClear = useCallback(() => {
    clearToken();
    setInputValue('');
    // Note: Don't call onAuthChange here - the useEffect in page.tsx 
    // will automatically refetch when the token context changes
  }, [clearToken]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  }, [handleApply]);

  // Mask the token for display
  const maskedToken = token 
    ? `${token.substring(0, 8)}${'•'.repeat(Math.min(20, token.length - 8))}` 
    : '';

  return (
    <div className="bg-slate-800/50 border-b border-slate-700">
      {/* Collapsed State - Just a toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-800/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm text-slate-300">Authentication</span>
          {isAuthenticated && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-green-400">Using custom token</span>
            </span>
          )}
          {!isAuthenticated && (
            <span className="text-xs text-slate-500">Using server credentials</span>
          )}
        </div>
        {isAuthenticated && !isExpanded && (
          <span className="text-xs text-slate-500 font-mono">{maskedToken}</span>
        )}
      </button>

      {/* Expanded State - Input form */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isAuthenticated ? 'Enter new token to replace...' : 'Enter Port API token (JWT)...'}
                className="w-full px-3 py-2 pr-10 bg-slate-900 border border-slate-600 rounded-md text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={handleApply}
              disabled={!inputValue.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
            {isAuthenticated && (
              <button
                onClick={handleClear}
                className="px-4 py-2 border border-slate-600 text-slate-300 text-sm rounded-md hover:bg-slate-700 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {isAuthenticated && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Current token:</span>
              <span className="text-xs text-slate-400 font-mono">{maskedToken}</span>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Enter your Port API token (JWT) to use your own credentials instead of server-side authentication. 
            You can paste the token with or without the &quot;Bearer &quot; prefix.
          </p>
        </div>
      )}
    </div>
  );
}

