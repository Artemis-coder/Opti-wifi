import * as Tw from "./index";

export const Animated = {
  View: 'div',
  Text: 'span',
  Pressable: 'button',
  ScrollView: 'div',
  TextInput: 'input',
};

export const framerVariant = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};