"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SearchSuggestions from "@/components/SearchSuggestions";

export default function Home() {
  const [location, setLocation] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (location.trim()) {
      router.push(`/bulletin?location=${encodeURIComponent(location.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f3] flex items-center justify-center p-4 font-sans text-[#1a1a2e]">
      <main className="w-full max-w-xl">
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] border border-[#e8e5e0] overflow-hidden animate-fade-in-up">
          <div className="h-1 bg-[#1e3a5f]"></div>

          <div className="p-8 sm:p-10 text-center">
            <div className="mb-6">
              <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a2e] tracking-tight mb-1">
                Cry For India
              </h1>
              <p className="text-sm text-[#78716c] font-medium">
                Prayer Department <span className="text-[#a8a29e]">|</span> AGDMC
              </p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSearch}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-[#a8a29e]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  name="location"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="block w-full pl-11 pr-4 py-4 text-base border border-[#e8e5e0] rounded-xl bg-[#faf8f5] text-[#1a1a2e] focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] focus:bg-white transition-all outline-none placeholder:text-[#a8a29e]"
                  placeholder="Enter your location"
                  required
                  autoComplete="off"
                />
                <SearchSuggestions
                  value={location}
                  onSelect={(name) => {
                    setLocation(name);
                    inputRef.current?.focus();
                  }}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#1e3a5f] hover:bg-[#14294a] text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-sm hover:shadow-md focus:ring-4 focus:ring-[#1e3a5f]/20 outline-none flex justify-center items-center gap-2 text-base"
              >
                <span>Generate Bulletin</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-[#a8a29e] mt-5">
          Cry For India &middot; Prayer Department | AGDMC
        </p>
      </main>
    </div>
  );
}
