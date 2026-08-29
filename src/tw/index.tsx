import {
  useCssElement,
  useNativeVariable as useFunctionalVariable,
} from "react-native-css";

import { Link as RouterLink } from "expo-router";
import Animated from "react-native-reanimated";
import React from "react";
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  TouchableHighlight as RNTouchableHighlight,
  TextInput as RNTextInput,
  StyleSheet,
} from "react-native";

// CSS Variable hook
export const useCSSVariable =
  process.env.EXPO_OS !== "web"
    ? useFunctionalVariable
    : (variable: string) => `var(${variable})`;

// Generic CSS Wrapper Helper
const wrapCss = (component: any, options: any = { className: "style" }) => {
  const Wrapped = React.forwardRef<any, any>((props, ref) => {
    return useCssElement(component, { ...props, ref } as any, options);
  });
  return Wrapped as any;
};

// CSS-enabled Link
export const Link = wrapCss(RouterLink);

// View
export const View = wrapCss(RNView);

// Text
export const Text = wrapCss(RNText);

// ScrollView
export const ScrollView = wrapCss(RNScrollView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
});

// Pressable
export const Pressable = wrapCss(RNPressable);

// TextInput
export const TextInput = wrapCss(RNTextInput);

// AnimatedScrollView
export const AnimatedScrollView = wrapCss(Animated.ScrollView, {
  className: "style",
  contentClassName: "contentContainerStyle",
  contentContainerClassName: "contentContainerStyle",
});

// TouchableHighlight with underlayColor extraction
function XXTouchableHighlight(
  props: any
) {
  const styleObj = StyleSheet.flatten(props.style) as any;
  const underlayColor = props.underlayColor || (styleObj ? styleObj.underlayColor : undefined);
  const cleanStyle = styleObj ? { ...styleObj } : {};
  delete cleanStyle.underlayColor;
  
  return (
    <RNTouchableHighlight
      underlayColor={underlayColor}
      {...props}
      style={cleanStyle}
    />
  );
}

export const TouchableHighlight = wrapCss(XXTouchableHighlight);
