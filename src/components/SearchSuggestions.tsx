
"use client";

import React, { useState, useEffect, useRef } from "react";

interface Suggestion {
  name: string;
  type: "state" | "district" | "town";
  parent: string;
}

interface SearchSuggestionsProps {
  value: string;
  onSelect: (name: string) => void;
}

export default function SearchSuggestions({ value, onSelect }: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`/api/suggestions?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
      } catch (e) {
        console.error("Failed to fetch suggestions", e);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen || suggestions.length === 0) return null;

  return (
    <div 
      ref={containerRef}
      className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="py-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.name}-${index}`}
            onClick={() => {
              onSelect(suggestion.name);
              setIsOpen(false);
            }}
            className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 group"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold uppercase shrink-0 ${
              suggestion.type === 'state' ? 'bg-blue-100 text-blue-600' : 
              suggestion.type === 'district' ? 'bg-indigo-100 text-indigo-600' : 
              'bg-emerald-100 text-emerald-600'
            }`}>
              {suggestion.type[0]}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                {suggestion.name}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-tight truncate">
                {suggestion.type === 'state' ? 'State' : 
                 suggestion.type === 'district' ? `District • ${suggestion.parent}` : 
                 `Town • ${suggestion.parent}`}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
