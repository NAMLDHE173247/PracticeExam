"use client";

import { useEffect, useState } from "react";

export function useExamCountdown(deadlineAt: string | undefined) {
  const [seconds, setSeconds] = useState(() => deadlineAt ? Math.max(0, Math.floor((Date.parse(deadlineAt) - Date.now()) / 1000)) : 0);
  useEffect(() => {
    if (!deadlineAt) return;
    const update = () => setSeconds(Math.max(0, Math.floor((Date.parse(deadlineAt) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadlineAt]);
  return seconds;
}
