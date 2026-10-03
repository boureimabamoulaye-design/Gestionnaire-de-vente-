import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTopButton: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkScroll = (e?: Event) => {
      const winScroll =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;

      let targetScroll = 0;
      if (e && e.target && e.target instanceof HTMLElement) {
        targetScroll = e.target.scrollTop || 0;
      }

      setVisible(Math.max(winScroll, targetScroll) > 80);
    };

    window.addEventListener('scroll', checkScroll, { passive: true, capture: true });
    checkScroll();

    return () => {
      window.removeEventListener('scroll', checkScroll, { capture: true } as EventListenerOptions);
    };
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo?.({ top: 0, behavior: 'smooth' });
    document.body.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={handleScrollToTop}
      aria-label="Retour en haut"
      title="Retour en haut"
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 w-10 h-10 rounded-full bg-[#047857] text-white hover:bg-[#065F46] active:scale-95 shadow-md border border-white/25 flex items-center justify-center transition-all cursor-pointer no-print"
    >
      <ArrowUp className="w-4 h-4" strokeWidth={2.25} />
    </button>
  );
};
