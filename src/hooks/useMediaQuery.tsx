import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive media queries
 * Uses window.matchMedia API to detect viewport changes
 *
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @returns boolean indicating if the query matches
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * if (isMobile) {
 *   return <MobileMenu />;
 * }
 */
export const useMediaQuery = (query: string): boolean => {
  // Initialize with false to prevent SSR issues
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Create media query list
    const media = window.matchMedia(query);

    // Set initial value
    setMatches(media.matches);

    // Create listener for changes
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers use addEventListener
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      // Fallback for older browsers
      media.addListener(listener);
    }

    // Cleanup function
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [query]);

  return matches;
};

/**
 * Hook to check if viewport is mobile size
 * Mobile: < 768px
 */
export const useIsMobile = (): boolean => {
  return useMediaQuery('(max-width: 767px)');
};

/**
 * Hook to check if viewport is tablet size
 * Tablet: 768px - 991px
 */
export const useIsTablet = (): boolean => {
  return useMediaQuery('(min-width: 768px) and (max-width: 991px)');
};

/**
 * Hook to check if viewport is desktop size
 * Desktop: >= 992px
 */
export const useIsDesktop = (): boolean => {
  return useMediaQuery('(min-width: 992px)');
};

/**
 * Hook to check if viewport is large desktop
 * Large Desktop: >= 1200px
 */
export const useIsLargeDesktop = (): boolean => {
  return useMediaQuery('(min-width: 1200px)');
};

/**
 * Hook to check if viewport is extra large desktop
 * Extra Large Desktop: >= 1400px
 */
export const useIsXLargeDesktop = (): boolean => {
  return useMediaQuery('(min-width: 1400px)');
};

/**
 * Hook to check if user prefers reduced motion
 * Useful for accessibility - disable animations if true
 */
export const usePrefersReducedMotion = (): boolean => {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
};

/**
 * Hook to check if user prefers dark color scheme
 * Useful for system-based theme detection
 */
export const usePrefersDarkMode = (): boolean => {
  return useMediaQuery('(prefers-color-scheme: dark)');
};

/**
 * Hook to get current breakpoint name
 * Returns: 'mobile' | 'tablet' | 'desktop' | 'large' | 'xlarge'
 */
export const useBreakpoint = (): 'mobile' | 'tablet' | 'desktop' | 'large' | 'xlarge' => {
  const isXLarge = useMediaQuery('(min-width: 1400px)');
  const isLarge = useMediaQuery('(min-width: 1200px)');
  const isDesktop = useMediaQuery('(min-width: 992px)');
  const isTablet = useMediaQuery('(min-width: 768px)');

  if (isXLarge) return 'xlarge';
  if (isLarge) return 'large';
  if (isDesktop) return 'desktop';
  if (isTablet) return 'tablet';
  return 'mobile';
};

/**
 * Hook to check if device supports touch
 * Note: This is a rough approximation - some laptops have touch screens
 */
export const useIsTouchDevice = (): boolean => {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    );
  }, []);

  return isTouch;
};
