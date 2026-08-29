import React from 'react';

// CSS Variable hook - simplified for web
export const useCSSVariable = (variable: string) => {
  return `var(${variable})`;
};

// CSS-enabled components - using HTML elements for web
export const View = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={className} {...props}>
    {children}
  </div>
);

export const Text = ({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={className} {...props}>
    {children}
  </span>
);

export const Pressable = ({ children, className, onPress, disabled = false, ...props }: { 
  children?: React.ReactNode; 
  className?: string; 
  onPress?: () => void;
  disabled?: boolean;
  [key: string]: any;
}) => {
  const handleClick = () => {
    if (!disabled && onPress) {
      onPress();
    }
  };
  
  return (
    <button 
      className={className}
      onClick={handleClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export const TextInput = ({ children, className, ...props }: React.HTMLAttributes<HTMLInputElement>) => (
  <input className={className} {...props} />
);

export const ScrollView = ({ children, className, style, ...props }: { 
  children?: React.ReactNode; 
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any;
}) => (
  <div 
    className={className}
    style={{ overflow: 'auto', ...(style || {}) }}
    {...props}
  >
    {children}
  </div>
);

// Generic CSS Wrapper Helper
const wrapCss = (component: any, options: any = { className: "style" }) => {
  // For web, just return the component as-is since we're already using HTML elements
  return component;
};

export const Link = wrapCss('a');
