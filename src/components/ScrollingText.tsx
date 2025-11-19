import { useEffect, useRef, useState } from 'react';
import { SCROLL_TEXT_SPEED, SCROLL_TEXT_PAUSE } from '../constants';

interface ScrollingTextProps {
  text: string;
  className?: string;
  maxWidth?: string;
}

export function ScrollingText({ text, className = '', maxWidth = '100%' }: ScrollingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const checkIfNeedsScroll = () => {
      if (!containerRef.current || !textRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const textWidth = textRef.current.scrollWidth;

      if (textWidth > containerWidth) {
        setNeedsScroll(true);
        startScrolling();
      } else {
        setNeedsScroll(false);
        stopScrolling();
      }
    };

    checkIfNeedsScroll();
    window.addEventListener('resize', checkIfNeedsScroll);
    return () => {
      window.removeEventListener('resize', checkIfNeedsScroll);
      stopScrolling();
    };
  }, [text]);

  const startScrolling = () => {
    if (!containerRef.current || !textRef.current || !needsScroll) return;
    
    stopScrolling();
    setIsScrolling(true);
    
    const container = containerRef.current;
    const textElement = textRef.current;
    const containerWidth = container.offsetWidth;
    const textWidth = textElement.scrollWidth;
    const scrollDistance = textWidth - containerWidth;

    let startTime: number | null = null;
    let paused = false;
    let pauseStartTime: number | null = null;
    let totalPauseTime = 0;

    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }

      // Handle pause at start
      if (timestamp - startTime < SCROLL_TEXT_PAUSE) {
        textElement.style.transform = 'translateX(0)';
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate elapsed time minus pause time
      const elapsed = timestamp - startTime - totalPauseTime - SCROLL_TEXT_PAUSE;
      
      // Calculate scroll position
      const scrollPosition = Math.min(
        (elapsed / 1000) * SCROLL_TEXT_SPEED,
        scrollDistance
      );

      if (scrollPosition >= scrollDistance && !paused) {
        // Pause at end
        paused = true;
        pauseStartTime = timestamp;
        textElement.style.transform = `translateX(-${scrollDistance}px)`;
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      if (paused && pauseStartTime) {
        if (timestamp - pauseStartTime >= SCROLL_TEXT_PAUSE) {
          // Reset to start
          paused = false;
          pauseStartTime = null;
          startTime = timestamp;
          totalPauseTime = 0;
          textElement.style.transform = 'translateX(0)';
        }
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      textElement.style.transform = `translateX(-${scrollPosition}px)`;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const stopScrolling = () => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsScrolling(false);
    if (textRef.current) {
      textRef.current.style.transform = 'translateX(0)';
    }
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        maxWidth,
        position: 'relative',
      }}
    >
      <span
        ref={textRef}
        style={{
          display: 'inline-block',
          transition: needsScroll && !isScrolling ? 'transform 0.3s ease' : 'none',
        }}
      >
        {text}
      </span>
    </div>
  );
}

