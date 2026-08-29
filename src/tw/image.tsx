import { useCssElement } from "react-native-css";
import React from "react";
import { Image as RNImage, ImageProps as RNImageProps } from "expo-image";

export type ImageProps = RNImageProps & { className?: string };

export const Image = React.forwardRef<RNImage, ImageProps>((props, ref) => {
  // Remap objectFit style to contentFit property if needed
  const { style, ...rest } = props;
  
  return useCssElement(
    RNImage,
    { ...rest, style, ref } as any,
    { className: "style" }
  );
});

Image.displayName = "CSS(Image)";
