import React from 'react';

function App({ name = "Click Me", onClick = () => {} }) {
  return (
    <div className="w-full p-3">
      <div 
        onClick={() => onClick(name)}
        className="group relative w-full rounded-2xl bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-indigo-900/90
                   backdrop-blur-sm border border-slate-600/50
                   flex items-center p-5 cursor-pointer
                   hover:border-cyan-400/60 hover:shadow-xl hover:shadow-cyan-500/20
                   transform hover:scale-[1.03] hover:-translate-y-2
                   transition-all duration-500 ease-out
                   before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br 
                   before:from-cyan-500/10 before:via-purple-500/10 before:to-pink-500/10
                   before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500
                   overflow-hidden"
      >
        {/* Animated gradient border */}
        <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent
                        opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="w-full h-full rounded-2xl bg-slate-800/90 backdrop-blur-sm"></div>
        </div>

        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent
                        -translate-x-full group-hover:translate-x-full
                        transition-transform duration-1000 ease-in-out
                        skew-x-12"></div>

        {/* Content container */}
        <div className="relative z-10 flex items-center w-full">
          {/* Avatar */}
          <div className="relative flex-shrink-0 mr-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500
                           flex items-center justify-center text-white font-bold text-lg
                           shadow-lg group-hover:shadow-cyan-500/40
                           transition-all duration-500
                           group-hover:scale-110 group-hover:rotate-12">
              {name.charAt(0).toUpperCase()}
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full
                           border-2 border-slate-800 shadow-sm animate-pulse
                           group-hover:bg-emerald-300 transition-colors duration-300"></div>
          </div>

          {/* Name and status */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-lg tracking-wide truncate
                          group-hover:text-cyan-100 transition-colors duration-300
                          drop-shadow-sm">
              {name}
            </h3>
            <p className="text-slate-400 text-sm font-medium
                          group-hover:text-cyan-300 transition-colors duration-300">
              Active now
            </p>
          </div>

          {/* Action indicator */}
          <div className="flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-8 h-8 rounded-full bg-slate-600/50 group-hover:bg-cyan-500/20
                           flex items-center justify-center
                           transition-all duration-300
                           group-hover:scale-110">
              <svg className="w-4 h-4 text-slate-300 group-hover:text-cyan-300
                             transition-colors duration-300 transform group-hover:translate-x-1"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Floating particles effect */}
        <div className="absolute top-2 right-4 w-2 h-2 rounded-full bg-cyan-400/60
                        opacity-0 group-hover:opacity-100
                        transition-all duration-700 delay-200
                        group-hover:animate-ping"></div>
        <div className="absolute bottom-3 left-6 w-1 h-1 rounded-full bg-purple-400/60
                        opacity-0 group-hover:opacity-100
                        transition-all duration-700 delay-400
                        group-hover:animate-pulse"></div>
      </div>
    </div>
  );
}

export default App;
