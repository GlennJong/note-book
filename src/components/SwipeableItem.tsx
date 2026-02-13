import React, { useRef, useState } from 'react';

interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  onClick: () => void;
  className?: string; // Add className prop to pass styles
  style?: React.CSSProperties; // Add style prop
}

const SwipeableItem = ({ 
  children, 
  onDelete,
  onClick,
  className,
  style
}: SwipeableItemProps) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const startOffset = useRef<number>(0);
  const isOpen = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startOffset.current = offset; // Capture where we started (0 or -80)
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;
    
    // Calculate new position based on start + drag
    let newOffset = startOffset.current + diff;

    // Constraints
    if (newOffset > 0) newOffset = 0; // Can't go past left edge
    if (newOffset < -120) newOffset = -120; // Max drag left

    setOffset(newOffset);
  };

  const handleTouchEnd = () => {
    startX.current = null;

    // Snap logic
    if (offset < -40) { // Threshold to open (half of 80)
      setOffset(-80); 
      isOpen.current = true;
    } else {
      setOffset(0);
      isOpen.current = false;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isOpen.current) {
        // If open, close it
        e.stopPropagation();
        setOffset(0);
        isOpen.current = false;
    } else {
        onClick();
    }
  };

  return (
    <div 
      className={className}
      style={{ 
        ...style,
        position: 'relative', 
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
        {/* Background Button Layer (Render underneath content) */}
        <div 
            style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: '80px', // Matches open width
                backgroundColor: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                zIndex: 0,
                cursor: 'pointer'
            }}
            onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setOffset(0);
                isOpen.current = false;
            }}
        >
            <span className="material-symbols-outlined">delete</span>
        </div>

        {/* Foreground Content Layer */}
        <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleClick}
            style={{
                backgroundColor: 'var(--bg-card)', 
                position: 'relative',
                zIndex: 1,
                transform: `translateX(${offset}px)`,
                // eslint-disable-next-line react-hooks/refs
                transition: startX.current !== null ? 'none' : 'transform 0.2s ease-out', // No transition while dragging
                height: '100%'
            }}
        >
            {children}
        </div>
    </div>
  );
};

export default SwipeableItem;
