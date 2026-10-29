/** Re-mounts on every navigation, giving each page a short opacity/translate entrance (CSS only). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col animate-[page-enter_0.45s_cubic-bezier(0.22,1,0.36,1)_both]">{children}</div>;
}
