import React from 'react';

function App({ name, onClick }) {
  return (<>
    <div
      onClick={() => onClick(name)}
      className="h-12 w-full mt-2 rounded bg-slate-800 flex items-center justify-center cursor-pointer hover:bg-gray-900 transition"
    >
      <p className="text-white font-semibold">{name}</p>
    </div>
    </>
  );
}

export default App;
