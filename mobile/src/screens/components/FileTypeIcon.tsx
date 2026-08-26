import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { fileUrl } from "../../api/client";
import { useTheme } from "../../context/ThemeContext";
import { ServerSettings } from "../../types";
import { fileTypeVisual } from "../../utils/fileTypes";

/**
 * Visual for one entry in the file browser: server thumbnail for
 * images/videos (falls back to the badge/icon when the thumb fails,
 * e.g. video thumbnails without ffmpeg), a colored extension badge for
 * document types, or a plain glyph.
 */
export default function FileTypeIcon({
  name,
  path,
  isDir,
  settings,
  variant,
}: {
  name: string;
  path: string;
  isDir: boolean;
  settings?: ServerSettings;
  variant: "list" | "grid";
}) {
  const { colors } = useTheme();
  const [thumbFailed, setThumbFailed] = useState(false);
  const s = stylesFor(variant);

  if (isDir) {
    return (
      <View style={s.box}>
        <Ionicons
          name={variant === "grid" ? "folder" : "folder-outline"}
          size={variant === "grid" ? 38 : 22}
          color="#E6B84C"
        />
      </View>
    );
  }

  const visual = fileTypeVisual(name);

  if (visual.kind === "thumb" && settings) {
    return (
      <View style={s.box}>
        <Image
          source={{
            uri: fileUrl(settings, visual.endpoint, path),
            headers: { "X-API-Key": settings.apiKey },
          }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={path}
          onError={() => setThumbFailed(true)}
        />
        {thumbFailed && (
          <Ionicons name="image-outline" size={variant === "grid" ? 38 : 22} color={colors.textSecondary} />
        )}
      </View>
    );
  }

  if (visual.kind === "badge") {
    return (
      <View style={s.box}>
        <Text style={[s.badgeText, { backgroundColor: visual.color }]}>{visual.label}</Text>
      </View>
    );
  }

  return (
    <View style={s.box}>
      <Ionicons
        name={visual.kind === "icon" ? visual.name : "document-outline"}
        size={variant === "grid" ? 38 : 22}
        color={colors.textSecondary}
      />
    </View>
  );
}

function stylesFor(variant: "list" | "grid") {
  return StyleSheet.create({
    box: {
      ...(variant === "list" ? { width: 40, height: 40 } : { width: "100%", height: "100%" }),
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: {
      color: "#fff",
      fontSize: variant === "list" ? 10 : 13,
      fontWeight: "800",
      letterSpacing: 0.5,
      paddingHorizontal: variant === "list" ? 5 : 8,
      paddingVertical: variant === "list" ? 3 : 6,
      borderRadius: 6,
      overflow: "hidden",
      textAlign: "center",
    },
  });
}
