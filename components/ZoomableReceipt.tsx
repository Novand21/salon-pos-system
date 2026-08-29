import React, { useRef, useState } from "react";
import { Animated } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

export default function ZoomableReceipt({
  children,
  onZoomChange,
}: {
  children: React.ReactNode;
  onZoomChange?: (isZoomed: boolean) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef({ x: 0, y: 0 });

  // Use state so we can actively toggle the Pan gesture
  const [isZoomed, setIsZoomed] = useState(false);

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onUpdate((event) => {
      let newScale = lastScale.current * event.scale;

      if (newScale < 1) newScale = 1;
      if (newScale > 3) newScale = 3;

      scale.setValue(newScale);

      // Trigger zoom state ON
      if (newScale > 1.05 && !isZoomed) {
        setIsZoomed(true);
        if (onZoomChange) onZoomChange(true);
      }
    })
    .onEnd((event) => {
      let finalScale = lastScale.current * event.scale;

      if (finalScale <= 1.05) {
        finalScale = 1;
        translateX.setValue(0);
        translateY.setValue(0);
        lastOffset.current = { x: 0, y: 0 };

        // Trigger zoom state OFF
        if (isZoomed) {
          setIsZoomed(false);
          if (onZoomChange) onZoomChange(false);
        }
      }
      if (finalScale > 3) finalScale = 3;

      lastScale.current = finalScale;
    });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(isZoomed)
    .onUpdate((event) => {
      translateX.setValue(lastOffset.current.x + event.translationX);
      translateY.setValue(lastOffset.current.y + event.translationY);
    })
    .onEnd((event) => {
      lastOffset.current = {
        x: lastOffset.current.x + event.translationX,
        y: lastOffset.current.y + event.translationY,
      };
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={{
          transform: [
            { translateX: translateX },
            { translateY: translateY },
            { scale: scale },
          ],
          width: "100%",
          alignItems: "center",
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
