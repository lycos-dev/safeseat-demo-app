import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";

export default function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#06111B", "#0A1C2D", "#07141F"]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.glow, styles.glowTop]} />
        <View style={[styles.glow, styles.glowBottom]} />

        <Image
          source={require("../../assets/images/appImgs/car-cropped.png")}
          resizeMode="contain"
          style={styles.carSilhouette}
        />

        <View style={styles.horizonLine} />
        <View style={[styles.roadEdge, styles.roadEdgeLeft]} />
        <View style={[styles.roadEdge, styles.roadEdgeRight]} />
        <View style={[styles.roadDash, { bottom: 30 }]} />
        <View style={[styles.roadDash, { bottom: 112 }]} />
        <View style={[styles.roadDash, { bottom: 194 }]} />
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07141F",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(52, 209, 127, 0.10)",
  },
  glowTop: {
    width: 330,
    height: 330,
    top: -145,
    right: -120,
  },
  glowBottom: {
    width: 260,
    height: 260,
    bottom: -105,
    left: -110,
    backgroundColor: "rgba(55, 145, 255, 0.09)",
  },
  carSilhouette: {
    position: "absolute",
    width: 430,
    height: 478,
    right: -165,
    top: 60,
    opacity: 0.095,
    transform: [{ rotate: "-5deg" }],
  },
  horizonLine: {
    position: "absolute",
    left: "12%",
    right: "12%",
    bottom: 268,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  roadEdge: {
    position: "absolute",
    bottom: -80,
    width: 2,
    height: 390,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  roadEdgeLeft: {
    left: "24%",
    transform: [{ rotate: "12deg" }],
  },
  roadEdgeRight: {
    right: "24%",
    transform: [{ rotate: "-12deg" }],
  },
  roadDash: {
    position: "absolute",
    alignSelf: "center",
    left: "49.7%",
    width: 2,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(102, 227, 160, 0.13)",
  },
});
