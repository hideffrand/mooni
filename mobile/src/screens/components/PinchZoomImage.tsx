import React, { useRef, useState } from "react";
import { ActivityIndicator, Animated, PanResponder, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";

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
  placeholderUri,
}: {
  uri: string;
  headers?: Record<string, string>;
  /** Small grid thumb already on the phone; painted while `uri` streams. */
  placeholderUri?: string;
}) {
  const { width, height } = useWindowDimensions();
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
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
      <Animated.View
        style={[styles.image, { transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}
      >
        {placeholderUri ? (
          /* The grid's cached thumb, upscaled behind the large tier: content
             appears the moment the page mounts instead of a spinner-on-black. */
          <Image
            source={{ uri: placeholderUri, headers }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="disk"
            transition={0}
          />
        ) : null}
        {/* expo-image downsamples large originals; RN Image can silently fail
            to decode multi-MB photos on Android. */}
        <Image
          key={attempt}
          source={{ uri, headers }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="disk"
          recyclingKey={uri}
          onLoadStart={() => setStatus("loading")}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          transition={120}
        />
        {status === "loading" && !placeholderUri && (
          <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" />
        )}
        {status === "error" && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setStatus("loading");
              setAttempt((a) => a + 1);
            }}
          >
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>Couldn't load image. Tap to retry.</Text>
            </View>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  errorText: { color: "#fff", fontSize: 14, textAlign: "center", paddingHorizontal: 24 },
});
