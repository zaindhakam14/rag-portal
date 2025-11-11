//knowledge of insight page 


export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-[#fafafa] to-[#f2f2f2] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative geometric shapes (light gray) */}
      <div className="absolute top-20 right-20 w-32 h-32 border-2 border-[#e5e5e5] rounded-full opacity-60"></div>
      <div className="absolute bottom-32 left-16 w-24 h-24 border-2 border-[#eaeaea] opacity-50 rotate-45"></div>
      <div className="absolute top-1/2 right-1/4 w-16 h-16 border border-[#e0e0e0] opacity-60 rounded-lg"></div>

      {/* Main content */}
      <div className="relative z-10 text-center space-y-12 max-w-4xl mx-auto">
        {/* Brand/Logo area */}
        <div className="space-y-2">
          <div className="inline-block mb-8">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#f3f3f3] to-[#ebebeb] rounded-2xl flex items-center justify-center shadow">
              <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
              </svg>
            </div>
          </div>
          <h1 className="text-7xl md:text-8xl font-light tracking-tight text-black leading-none">
             <span className="font-serif italic">KNOWLEDGE</span>
          </h1>
          <h2 className="text-5xl md:text-6xl font-light tracking-tight text-black">
            <span className="font-serif">on</span> <span className="font-bold">tap</span>
          </h2>
        </div>

        {/* Subtitle */}
        <p className="text-lg text-[#5a5a5a] font-light tracking-wide max-w-md mx-auto">
          "Intelligence at your fingertips"
        </p>

        {/* CTA Button (white pill, black text/border) */}
        <div className="pt-8">
          <a
            href="/chat"
            className="group inline-flex items-center gap-3 px-12 py-5 bg-white text-black border border-black rounded-full font-medium tracking-wide transition-all duration-300 shadow hover:shadow-md hover:bg-[#f6f6f6] transform hover:scale-105"
          >
            <span className="text-lg">Begin</span>
            <svg
              className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
            </svg>
          </a>
        </div>

        {/* Feature highlights */}
        <div className="pt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto bg-white rounded-xl flex items-center justify-center border border-[#e5e5e5]">
              <svg className="w-6 h-6 text-[#4a4a4a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-black tracking-wide">INTELLIGENT</h3>
            <p className="text-xs text-[#5a5a5a] font-light">Contextual understanding</p>
          </div>

          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto bg-white rounded-xl flex items-center justify-center border border-[#e5e5e5]">
              <svg className="w-6 h-6 text-[#4a4a4a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-black tracking-wide">INSTANT</h3>
            <p className="text-xs text-[#5a5a5a] font-light">Real-time responses</p>
          </div>

          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto bg-white rounded-xl flex items-center justify-center border border-[#e5e5e5]">
              <svg className="w-6 h-6 text-[#4a4a4a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-black tracking-wide">SECURE</h3>
            <p className="text-xs text-[#5a5a5a] font-light">Your data protected</p>
          </div>
        </div>
      </div>

      {/* Bottom decorative element */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2 text-[#bcbcbc]">
          <div className="w-1 h-1 bg-current rounded-full"></div>
          <div className="w-1 h-1 bg-current rounded-full"></div>
          <div className="w-1 h-1 bg-current rounded-full"></div>
        </div>
      </div>

      {/* Wave decoration at bottom */}
      <div className="absolute bottom-0 left-0 right-0 opacity-70">
        <svg viewBox="0 0 1200 120" className="w-full text-[#eeeeee]">
          <path
            d="M0,50 C300,100 600,0 900,50 C1050,75 1125,50 1200,50 L1200,120 L0,120 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </main>
  );
}
