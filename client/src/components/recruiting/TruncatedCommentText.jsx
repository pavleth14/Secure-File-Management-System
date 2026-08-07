import { useLayoutEffect, useRef, useState } from 'react';

export default function TruncatedCommentText({
  text,
  lineClamp = 3,
  onViewMore,
  className = 'text-sm text-slate-900 dark:text-slate-100',
}) {
  const textRef = useRef(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;

    setIsTruncated(element.scrollHeight > element.clientHeight + 1);
  }, [text, lineClamp]);

  const clampClass =
    lineClamp === 2 ? 'line-clamp-2' : lineClamp === 4 ? 'line-clamp-4' : 'line-clamp-3';

  return (
    <div>
      <p ref={textRef} className={`${className} ${clampClass} whitespace-pre-wrap break-words`}>
        {text}
      </p>
      {isTruncated && onViewMore && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onViewMore();
          }}
          className="mt-1 text-xs font-medium text-brand-700 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
        >
          View more
        </button>
      )}
    </div>
  );
}
