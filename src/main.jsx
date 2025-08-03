import React, { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// import BarRenderer from './BarRenderer';
import './index.css';

function MainApp() {
  const [students, setStudents] = useState([]);
  const [selectedName, setSelectedName] = useState('');

  useEffect(() => {
    fetch('http://localhost:3000/api/students', { credentials: 'include' })
      .then(res => res.json())
      .then(setStudents)
      .catch(console.error);
  }, []);

  const handleSelect = (name) => {
    setSelectedName(name);

    // Open in a NEW tab:
    // window.open(`http://localhost:3000/${encodeURIComponent(name)}`, '_blank');

    // Or, open in the SAME tab:
    window.location.assign(`http://localhost:3000/home/${encodeURIComponent(name)}`);
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-2">
      {students.map((student) => (
        <App
          key={student.username}
          name={student.username}
          onClick={handleSelect}
        />
      ))}

      {/* <BarRenderer selectedName={selectedName} /> */}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MainApp />
  </StrictMode>
);
