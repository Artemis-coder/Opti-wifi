import React from 'react';

export type ImageProps = React.ImgHTMLAttributes<HTMLImageElement> & { 
  className?: string; 
};

export const Image = React.forwardRef<HTMLImageElement, ImageProps>((props, ref) => {
  const { className, ...rest } = props;
  
  return (
    <img 
      className={className} 
      ref={ref} 
      {...rest} 
    />
  );
});

Image.displayName = 'Image';