import React from "react";

/**
 * Reusable loading Skeleton components.
 * Renders pulse animations styling using standard tailwind utilities.
 */

// Simple single pulse block
export function SkeletonBlock({ className = "h-4 w-full bg-border-light rounded" }) {
  return <div className={`animate-pulse ${className}`} />;
}

// Table loading skeleton
export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden w-full">
      {/* Table Header Skeleton */}
      <div className="bg-surface border-b border-border-light px-5 py-4 flex gap-4">
        {[...Array(cols)].map((_, i) => (
          <SkeletonBlock key={i} className="h-3.5 bg-border rounded flex-1" />
        ))}
      </div>
      {/* Table Body Skeleton */}
      <div className="divide-y divide-border-light">
        {[...Array(rows)].map((_, r) => (
          <div key={r} className="px-5 py-4 flex gap-4 items-center">
            {[...Array(cols)].map((_, c) => (
              <SkeletonBlock key={c} className="h-3 bg-border-light rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Card details / grid loader skeleton
export function SkeletonCardGrid({ cards = 3 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
      {[...Array(cards)].map((_, i) => (
        <div key={i} className="bg-card p-5 rounded-xl border border-border shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="w-8 h-8 rounded-lg bg-border-light flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <SkeletonBlock className="h-3 w-1/3 bg-border" />
              <SkeletonBlock className="h-2.5 w-1/2 bg-border-light" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Form loader skeleton
export function SkeletonForm({ fields = 4 }) {
  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-card space-y-6 w-full">
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-1/4 bg-border" />
        <SkeletonBlock className="h-3 w-1/3 bg-border-light" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[...Array(fields)].map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonBlock className="h-3 w-1/5 bg-border" />
            <SkeletonBlock className="h-9 w-full bg-border-light rounded-lg" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <SkeletonBlock className="h-8 w-20 bg-border-light rounded-lg" />
        <SkeletonBlock className="h-8 w-24 bg-border rounded-lg" />
      </div>
    </div>
  );
}

// Universal fallback skeleton page
export default function SkeletonPage() {
  return (
    <div className="min-h-screen bg-page p-5 md:p-8 space-y-6 animate-fade-in font-outfit w-full">
      <div className="space-y-2">
        <SkeletonBlock className="h-6 w-48 bg-border" />
        <SkeletonBlock className="h-3 w-64 bg-border-light" />
      </div>
      <SkeletonCardGrid cards={3} />
      <SkeletonTable rows={4} cols={5} />
    </div>
  );
}
