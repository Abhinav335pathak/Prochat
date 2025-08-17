import React, { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// import BarRenderer from './BarRenderer';
import './index.css';

function MainApp() {
  const [students, setStudents] = useState([]);
  const [selectedName, setSelectedName] = useState('');

  useEffect(() => {
    fetch('https://prochat-e7hc.onrender.com/api/students'|| 'http://192.168.1.36:4000/', { credentials: 'include' })
      .then(res => res.json())
      .then(setStudents)
      .catch(console.error);
  }, []);

  const handleSelect = (name) => {
    if (isMobile) {
      setSelectedName(name); // show chat overlay
    } else {
      window.location.href = `/home/${encodeURIComponent(name)}`;
    }
  };

  const handleBackToList = () => {
    setSelectedName('');
  };

  const handleSendMessage = () => {
    if (messageText.trim()) {
      console.log(`Message sent to ${selectedName}:`, messageText);
      setMessageText('');
      // TODO: send to server via fetch/socket
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Student List */}
      <div
        id="student-list"
        className={`${!isMobile ? 'w-1/3' : 'w-full'} glass border border-white/10 overflow-y-auto`}
      >
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/60"></div>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-white/70">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="text-lg font-medium">No students found</p>
              <p className="text-sm">Students will appear here when available</p>
            </div>
          ) : (
            students.map((student) => (
              <App
                key={student.username}
                name={student.username}
                onClick={() => handleSelect(student.username)}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat Overlay (Mobile only) */}
      {isMobile && selectedName && (
        <div
          id="chat-container"
          className="absolute inset-0 bg-gray-900/95 flex flex-col z-50"
        >
          <div className="p-4 flex items-center justify-between bg-gray-800">
            <h2 className="text-white font-bold">Chat with {selectedName}</h2>
            <button
              className="text-red-400 hover:text-red-600"
              onClick={handleBackToList}
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-white">
            {/* Chat messages placeholder */}
            <p className="text-gray-400">No messages yet...</p>
          </div>
          <div className="p-4 flex gap-2 border-t border-gray-700">
            <input
              type="text"
              className="flex-1 px-3 py-2 rounded-md bg-gray-700 text-white focus:outline-none"
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={handleSendMessage}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Desktop filler */}
      <div className="hidden md:block flex-1"></div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MainApp />
  </StrictMode>
);
