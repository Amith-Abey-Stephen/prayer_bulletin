"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface Suggestion {
  name: string;
  type: "state" | "district" | "town";
  parent: string;
}

interface SearchSuggestionsProps {
  value: string;
  onSelect: (name: string) => void;
}

type GroupedSuggestions = {
  state: Suggestion[];
  district: Suggestion[];
  town: Suggestion[];
};

function groupSuggestions(suggestions: Suggestion[]): GroupedSuggestions {
  const grouped: GroupedSuggestions = { state: [], district: [], town: [] };
  suggestions.forEach((s) => {
    if (grouped[s.type]) grouped[s.type].push(s);
  });
  return grouped;
}

const TYPE_LABELS: Record<string, string> = {
  state: "States",
  district: "Districts",
  town: "Towns",
};

const TYPE_STYLES: Record<string, string> = {
  state: "bg-[#ebf0f7] text-[#1e3a5f]",
  district: "bg-[#ede9fe] text-[#6d28d9]",
  town: "bg-[#ecfdf5] text-[#059669]",
};

const TYPE_BADGE: Record<string, string> = {
  state: "State",
  district: "District",
  town: "Town",
};

export default function SearchSuggestions({ value, onSelect }: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      setHighlightedIndex(-1);
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

  const totalCount = suggestions.length;
  const grouped = groupSuggestions(suggestions);
  const groupKeys = (["state", "district", "town"] as const).filter((k) => grouped[k].length > 0);

  const getFlatIndex = useCallback(
    (groupKey: string, itemIndex: number): number => {
      let idx = 0;
      for (const key of groupKeys) {
        if (key === groupKey) return idx + itemIndex;
        idx += grouped[key].length;
      }
      return -1;
    },
    [groupKeys, grouped]
  );

  const selectItem = (index: number) => {
    if (index < 0 || index >= totalCount) return;
    let flatIdx = -1;
    for (const key of groupKeys) {
      for (let j = 0; j < grouped[key].length; j++) {
        flatIdx++;
        if (flatIdx === index) {
          onSelect(grouped[key][j].name);
          setIsOpen(false);
          return;
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < totalCount - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalCount - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          selectItem(highlightedIndex);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  if (!isOpen && !isLoading) return null;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-full mt-1.5 bg-white rounded-xl shadow-lg border border-[#e8e5e0] overflow-hidden animate-fade-in"
    >
      {isLoading ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-4 h-4 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-[#78716c] font-medium">Searching locations...</span>
        </div>
      ) : (
        <div className="py-1" onKeyDown={handleKeyDown}>
          {groupKeys.map((key) => {
            const items = grouped[key];
            return (
              <div key={key}>
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#a8a29e]">
                  {TYPE_LABELS[key]}
                </div>
                {items.map((suggestion, idx) => {
                  const segmentIdx = suggestions.indexOf(suggestion);
                  const globalIdx = segmentIdx;
                  return (
                    <button
                      key={`${suggestion.name}-${idx}`}
                      ref={(el) => {
                        itemRefs.current[globalIdx] = el;
                      }}
                      onClick={() => {
                        onSelect(suggestion.name);
                        setIsOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors ${
                        highlightedIndex === globalIdx
                          ? "bg-[#f5f2ed]"
                          : "hover:bg-[#faf8f5]"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase shrink-0 ${TYPE_STYLES[key]}`}
                      >
                        {key[0]}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span
                          className={`text-sm font-semibold truncate ${
                            highlightedIndex === globalIdx ? "text-[#1e3a5f]" : "text-[#1a1a2e]"
                          }`}
                        >
                          {suggestion.name}
                        </span>
                        <span className="text-[10px] text-[#a8a29e] truncate">
                          {suggestion.type === "state"
                            ? "State"
                            : `${suggestion.parent}`}
                        </span>
                      </div>
                      <span className="ml-auto text-[9px] font-medium text-[#a8a29e] uppercase tracking-wider bg-[#f5f2ed] px-2 py-0.5 rounded-md shrink-0">
                        {TYPE_BADGE[key]}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
