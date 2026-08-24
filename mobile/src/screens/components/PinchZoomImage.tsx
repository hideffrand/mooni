import React, { useRef } from "react";
import { Animated, PanResponder, StyleSheet, useWindowDimensions, View } from "react-native";

const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 300;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Zoomable image (pinch, pan while zoomed, double-tap) built on Animated +
 * PanResponder. Unzoomed single-finger gestures pass through to the parent
 * pager so item swiping still works.
 */
export default function PinchZoomImage({
  uri,
  headers,
}: {
  uri: string;
  headers?: Record<string, string>;
}) {
  const { width, height } = useWindowDimensions();
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  // Source of truth for gesture logic; Animated values only render.
  const cur = useRef({ scale: 1, tx: 0, ty: 0 });
  const lastTap = useRef(0);
  const pinch = useRef({ active: false, startDist: 0, startScale: 1 });
  const pan = useRef({ startTx: 0, startTy: 0 });

  const clampPan = (s: number, x: number, y: number) => {
    const maxX = (width * (s - 1)) / 2;
    const maxY = (height * (s - 1)) / 2;
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  const setZoom = (s: number, animate: boolean, resetPan: boolean) => {
    const next = clamp(s, 1, MAX_SCALE);
    const spring = (v: Animated.Value, to: number) =>
      animate
        ? Animated.spring(v, { toValue: to, friction: 5, tension: 60, useNativeDriver: false })
        : v.setValue(to);

    if (resetPan && next === 1) {
      cur.current.tx = 0;
      cur.current.ty = 0;
    }
    cur.current.scale = next;
    spring(scale, next);
    if (resetPan && next === 1) {
      spring(tx, 0);
      spring(ty, 0);
    }
  };

  const toggleZoom = () => {
    const next = cur.current.scale > 1 ? 1 : 2.5;
    setZoom(next, true, true);
  };

  const panResponder = useRef(
    PanResponder.create({
      // Claim gestures only when zoomed or pinching; else the pager swipes.
      onStartShouldSetPanResponder: () => cur.current.scale > 1,
      onMoveShouldSetPanResponder: (_e, g) =>
        g.numberActiveTouches === 2 || cur.current.scale > 1,
      onPanResponderGrant: (evt) => {
        const now = Date.now();
        if (now - lastTap.current < DOUBLE_TAP_MS && cur.current.scale === 1) {
          toggleZoom();
          lastTap.current = 0;
          return;
        }
        lastTap.current = now;
        pan.current = { startTx: cur.current.tx, startTy: cur.current.ty };
        pinch.current.active = false;
      },
      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          const d = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          );
          if (!pinch.current.active) {
            pinch.current = { active: true, startDist: d, startScale: cur.current.scale };
          } else {
            const s = clamp((pinch.current.startScale * d) / pinch.current.startDist, 1, MAX_SCALE);
            cur.current.scale = s;
            scale.setValue(s);
          }
        } else if (cur.current.scale > 1) {
          const c = clampPan(cur.current.scale, pan.current.startTx + g.dx, pan.current.startTy + g.dy);
          cur.current.tx = c.x;
          cur.current.ty = c.y;
          tx.setValue(c.x);
          ty.setValue(c.y);
        }
      },
      onPanResponderRelease: () => {
        if (cur.current.scale < 1.05) {
          setZoom(1, true, true);
        }
      },
      onPanResponderTerminate: () => {
        if (cur.current.scale < 1.05) {
          setZoom(1, true, true);
        }
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.Image
        source={{ uri, headers }}
        style={[styles.image, { transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
});
