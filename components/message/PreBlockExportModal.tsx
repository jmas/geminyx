import { forwardRef } from "react";
import {
  Modal,
  Platform,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import ViewShot from "react-native-view-shot";
import { parseAnsiSgrToRuns } from "utils/parseAnsiSgr";

export type PreBlockExportModalStyles = {
  exportModalRoot: ViewStyle;
  preTextColumn: ViewStyle;
  preText: TextStyle;
};

export type PreBlockExportModalProps = {
  visible: boolean;
  onShow: () => void;
  captureWidth: number;
  captureHeight: number;
  lines: string[];
  preTextColor: string;
  preCaptureContainerStyle: StyleProp<ViewStyle>;
  styles: PreBlockExportModalStyles;
};

const PreBlockExportModal = forwardRef<ViewShot, PreBlockExportModalProps>(
  function PreBlockExportModal(
    {
      visible,
      onShow,
      captureWidth,
      captureHeight,
      lines,
      preTextColor,
      preCaptureContainerStyle,
      styles: s,
    },
    ref,
  ) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onShow={onShow}
      >
        <View style={s.exportModalRoot} pointerEvents="none">
          <ViewShot
            ref={ref}
            options={{
              format: "png",
              quality: 1,
              result: "base64",
              width: captureWidth,
              height: captureHeight,
            }}
          >
            <View style={preCaptureContainerStyle}>
              <View style={s.preTextColumn}>
                {lines.map((line, li) => (
                  <Text
                    key={`exp-${li}`}
                    numberOfLines={1}
                    {...(Platform.OS === "android"
                      ? { textBreakStrategy: "simple" as const }
                      : {})}
                    style={[s.preText, { color: preTextColor }]}
                  >
                    {parseAnsiSgrToRuns(line, preTextColor).map((run, ri) => (
                      <Text key={ri} style={run.style}>
                        {run.text}
                      </Text>
                    ))}
                  </Text>
                ))}
              </View>
            </View>
          </ViewShot>
        </View>
      </Modal>
    );
  },
);

export default PreBlockExportModal;
