import { useEffect, useState } from "react";
import { dateKey } from "@/lib/date";

/** Today's local date key. Rolls over at midnight and when the tab regains focus. */
export function useToday(): string {
  const [today, setToday] = useState(() => dateKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => setToday(dateKey());
    const schedule = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, next.getTime() - now.getTime());
    };
    schedule();
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return today;
}
