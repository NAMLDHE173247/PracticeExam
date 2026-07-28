"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "practice_exam_temporary_user_id";
const objectIdPattern = /^[a-f\d]{24}$/i;

export function useTemporaryUser() {
  const [userId, setUserId] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [stored, setStored] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (objectIdPattern.test(saved)) { setUserId(saved); setInputValue(saved); setStored(true); }
  }, []);
  const saveUserId = useCallback((value: string) => {
    const normalized = value.trim();
    if (!objectIdPattern.test(normalized)) return false;
    window.localStorage.setItem(STORAGE_KEY, normalized);
    setUserId(normalized); setInputValue(normalized); setStored(true); return true;
  }, []);
  return { userId, inputValue, setInputValue, stored, saveUserId, isValid: objectIdPattern.test(userId) };
}
