import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Globe,
  MapPin,
  Navigation,
  Radio,
  Zap,
} from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { radius, spacing, typography, ColorPalette, darkColors } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import type { AuthStackProps } from "@/navigation/types";

const features = [
  {
    icon: Zap,
    title: "Real-time Coordination",
    description:
      "Instantly broadcast crisis requests to nearby volunteers. Live updates ensure no call for help goes unanswered.",
    accent: darkColors.crisisRescue,
  },
  {
    icon: Navigation,
    title: "AI-Powered Routing",
    description:
      "Smart algorithms match volunteers to the nearest crisis, optimizing response times and saving critical minutes.",
    accent: darkColors.crisisMedical,
  },
  {
    icon: MapPin,
    title: "GPS Tracking",
    description:
      "Precise geolocation pins every crisis on the map. Volunteers navigate directly to those in need with live tracking.",
    accent: darkColors.crisisFoodWater,
  },
];

const steps = [
  { step: "01", title: "Report a Crisis", description: "Tap the map to drop a pin at your location. Select the crisis type and describe your situation." },
  { step: "02", title: "Volunteers Respond", description: "Nearby verified volunteers receive your alert instantly and claim the task to begin responding." },
  { step: "03", title: "Help Arrives", description: "Track your volunteer's approach in real-time. Once resolved, the crisis is marked complete." },
];

const stats = [
  { value: "2,400+", label: "Crises Resolved" },
  { value: "850+", label: "Active Volunteers" },
  { value: "< 4 min", label: "Avg Response" },
  { value: "98%", label: "Resolution Rate" },
];

export default function LandingScreen({ navigation }: AuthStackProps<"Landing">) {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Radio size={20} color={palette.crisisRescue} />
          <Text style={styles.brandText}>CrisisGrid</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => navigation.navigate("SignIn")} hitSlop={8}>
            <Text style={styles.ghostLink}>Sign In</Text>
          </Pressable>
          <Button title="Get Started" size="sm" fullWidth={false} onPress={() => navigation.navigate("SignUp")} />
        </View>
      </View>

      <View style={styles.hero}>
        <Badge
          label="Live Emergency Platform"
          color={palette.crisisRescue}
          variant="outline"
          leftIcon={<Activity size={12} color={palette.crisisRescue} />}
        />
        <Text style={styles.heroTitle}>
          When Every Second Counts,{"\n"}
          <Text style={{ color: palette.crisisRescue }}>CrisisGrid Connects</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          A real-time emergency coordination platform that connects people in crisis with nearby
          volunteers — powered by AI routing, live maps, and GPS tracking.
        </Text>
        <View style={styles.heroActions}>
          <Button
            title="Start Volunteering"
            size="lg"
            onPress={() => navigation.navigate("SignUp")}
            rightIcon={<ArrowRight size={16} color="#03121C" />}
          />
          <Button
            title="Sign In"
            size="lg"
            variant="outline"
            onPress={() => navigation.navigate("SignIn")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Built for Crisis Response</Text>
        <Text style={styles.sectionSubtitle}>Everything responders need — in one unified platform.</Text>

        <View style={styles.featuresGrid}>
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} style={styles.featureCard}>
                <CardContent>
                  <View
                    style={[
                      styles.featureIcon,
                      { backgroundColor: `${feature.accent}26` },
                    ]}
                  >
                    <Icon size={20} color={feature.accent} />
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDesc}>{feature.description}</Text>
                </CardContent>
              </Card>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <Text style={styles.sectionSubtitle}>Three simple steps from crisis to resolution.</Text>

        <View style={styles.steps}>
          {steps.map((item) => (
            <View key={item.step} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{item.step}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{item.title}</Text>
                <Text style={styles.stepDesc}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Card>
          <CardContent>
            <Text style={[styles.sectionTitle, { textAlign: "center" }]}>Trusted by Communities</Text>
            <Text style={[styles.sectionSubtitle, { textAlign: "center" }]}>
              Real impact, measurable results.
            </Text>
            <View style={styles.statsRow}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.statCell}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>
      </View>

      <View style={[styles.section, styles.cta]}>
        <Globe size={32} color={palette.crisisRescue} />
        <Text style={[styles.sectionTitle, { textAlign: "center", marginTop: spacing.md }]}>
          Ready to Make a Difference?
        </Text>
        <Text style={[styles.sectionSubtitle, { textAlign: "center" }]}>
          Join CrisisGrid today and help build a safer, more connected world — one response at a time.
        </Text>
        <View style={styles.heroActions}>
          <Button
            title="Create Your Account"
            size="lg"
            onPress={() => navigation.navigate("SignUp")}
            rightIcon={<ChevronRight size={16} color="#03121C" />}
          />
          <Button
            title="Contact Us"
            size="lg"
            variant="outline"
            onPress={() => navigation.navigate("Contact")}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.brand}>
          <Radio size={14} color={palette.crisisRescue} />
          <Text style={styles.footerBrand}>CrisisGrid</Text>
        </View>
        <View style={styles.footerLinks}>
          <Pressable onPress={() => navigation.navigate("Contact")}>
            <Text style={styles.footerLink}>Contact</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("SignIn")}>
            <Text style={styles.footerLink}>Sign In</Text>
          </Pressable>

        </View>
      </View>
    </Screen>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandText: { ...typography.h3, color: c.foreground },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  ghostLink: { ...typography.bodyStrong, color: c.foreground },

  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl, alignItems: "center", gap: spacing.lg },
  heroTitle: { ...typography.display, color: c.foreground, textAlign: "center" },
  heroSubtitle: {
    ...typography.body,
    color: c.mutedForeground,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },
  heroActions: { gap: spacing.md, width: "100%", marginTop: spacing.md },

  section: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, gap: spacing.md },
  sectionTitle: { ...typography.h1, color: c.foreground },
  sectionSubtitle: { ...typography.body, color: c.mutedForeground, marginBottom: spacing.md },

  featuresGrid: { gap: spacing.md },
  featureCard: {},
  featureIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  featureTitle: { ...typography.h3, color: c.foreground, marginBottom: spacing.xs },
  featureDesc: { ...typography.small, color: c.mutedForeground },

  steps: { gap: spacing.lg },
  stepRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  stepBadge: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: "rgba(43, 179, 242, 0.15)",
    alignItems: "center", justifyContent: "center",
  },
  stepBadgeText: { ...typography.bodyStrong, color: c.crisisRescue },
  stepBody: { flex: 1 },
  stepTitle: { ...typography.h3, color: c.foreground, marginBottom: spacing.xs },
  stepDesc: { ...typography.small, color: c.mutedForeground },

  statsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: spacing.md, gap: spacing.md },
  statCell: { width: "47%", alignItems: "center", gap: 4 },
  statValue: { ...typography.h1, color: c.crisisRescue, fontSize: 24 },
  statLabel: { ...typography.small, color: c.mutedForeground, textAlign: "center" },

  cta: { alignItems: "center" },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopColor: c.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerBrand: { ...typography.small, fontWeight: "700", color: c.foreground },
  footerLinks: { flexDirection: "row", gap: spacing.lg },
  footerLink: { ...typography.small, color: c.mutedForeground },
});
