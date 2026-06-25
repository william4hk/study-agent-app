"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProgressBadge() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/progress");
        if (!res.ok) {
          setCount(0);
        } else {
          const json = await res.json();
          if (mounted) setCount(typeof json.count === "number" ? json.count : 0);
        }
      } catch (e) {
        setCount(0);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Link href="/dashboard" className="relative flex items-center text-sm font-medium text-slate-300 hover:text-white">
      Progress
      <span className="ml-2 inline-flex items-center justify-center rounded-full bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-100">
        {loading ? "..." : count ?? 0}
      </span>
    </Link>
  );
}
