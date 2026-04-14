import {
  requireOptionalNativeModule,
  UnavailabilityError,
} from "expo-modules-core";

type ExpoClipboardNative = {
  setStringAsync?: (
    text: string,
    options?: Record<string, unknown>,
  ) => Promise<boolean>;
  setImageAsync?: (base64Image: string) => Promise<void>;
};

const native = requireOptionalNativeModule<ExpoClipboardNative>("ExpoClipboard");

export async function setStringAsync(
  text: string,
  options?: Record<string, unknown>,
): Promise<boolean> {
  if (!native?.setStringAsync) {
    throw new UnavailabilityError("Clipboard", "setStringAsync");
  }
  return native.setStringAsync(text, options);
}

export async function setImageAsync(base64Image: string): Promise<void> {
  if (!native?.setImageAsync) {
    throw new UnavailabilityError("Clipboard", "setImageAsync");
  }
  return native.setImageAsync(base64Image);
}
