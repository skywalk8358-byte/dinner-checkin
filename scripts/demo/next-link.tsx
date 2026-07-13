"use client";

/** demo 版 next/link：把 href 轉成 hash 連結；一律同框導覽（artifact iframe 內開新分頁沒有意義） */
export default function Link({
  href,
  children,
  target: _target,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a href={`#${href}`} {...rest}>
      {children}
    </a>
  );
}
