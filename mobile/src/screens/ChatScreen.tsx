import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import {
  ArrowLeft,
  Mic,
  Pause,
  Play,
  Send,
  ShieldCheck,
  Smile,
  Square,
  X,
} from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useSocket, ChatMessage } from "@/hooks/useSocket";
import { api } from "@/api/client";
import { ColorPalette, radius, spacing, typography } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useNavigation, useRoute } from "@react-navigation/native";

type ChatRouteParams = { requestId: string };

type EmojiCategory = {
  key: string;
  label: string;
  emojis: string[];
};

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: "smileys",
    label: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾","🙈","🙉","🙊",
    ],
  },
  {
    key: "people",
    label: "👋",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","👶","🧒","👦","👧","🧑","👱","👨","🧔","👩","🧓","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷","👮","🕵️","💂","🥷","👷","🤴","👸","👳","👲","🧕","🤵","👰","🤰","🤱","👼","🎅","🤶","🦸","🦹","🧙","🧚","🧛","🧜","🧝","🧞","🧟","💆","💇","🚶","🧍","🧎","🏃","💃","🕺","🕴️","👯","🧖","🧗","🤺","🏇","⛷️","🏂","🏌️","🏄","🚣","🏊","⛹️","🏋️","🚴","🚵","🤸","🤼","🤽","🤾","🤹","🧘","🛀","🛌",
    ],
  },
  {
    key: "nature",
    label: "🐶",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷️","🕸️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐈‍⬛","🪶","🐓","🦃","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔","🐾","🐉","🐲","🌵","🎄","🌲","🌳","🌴","🪵","🌱","🌿","☘️","🍀","🎍","🪴","🎋","🍃","🍂","🍁","🍄","🐚","🪨","🌾","💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌙","🌎","🌍","🌏","🪐","💫","⭐","🌟","✨","⚡","🔥","💥","☄️","☀️","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄","🌬️","💨","💧","💦","☔","☂️","🌊","🌫️",
    ],
  },
  {
    key: "food",
    label: "🍎",
    emojis: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🍍","🥝","🥥","🥑","🍆","🥔","🥕","🌽","🌶️","🫑","🥒","🥬","🥦","🧄","🧅","🍄","🥜","🌰","🍞","🥐","🥖","🥨","🥯","🥞","🧇","🧀","🍖","🍗","🥩","🥓","🍔","🍟","🍕","🌭","🥪","🌮","🌯","🫔","🥙","🧆","🥚","🍳","🥘","🍲","🫕","🥣","🥗","🍿","🧈","🧂","🥫","🍱","🍘","🍙","🍚","🍛","🍜","🍝","🍠","🍢","🍣","🍤","🍥","🍡","🍦","🍧","🍨","🍩","🍪","🎂","🍰","🧁","🥧","🍫","🍬","🍭","🍮","🍯","🍼","🥛","☕","🫖","🍵","🍶","🍾","🍷","🍸","🍹","🍺","🍻","🥂","🥃","🥤","🧋","🧃","🧉","🧊",
    ],
  },
  {
    key: "activity",
    label: "⚽",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🏋️","🤼","🤸","⛹️","🤺","🤾","🏌️","🏇","🧘","🏄","🏊","🚣","🧗","🚴","🚵","🤸","🤼","🤽","🤾","🤹","🎖️","🏆","🏅","🥇","🥈","🥉","🎫","🎟️","🎪","🤹","🎭","🩰","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🪘","🎷","🎺","🪗","🎸","🪕","🎻","🎲","♟️","🎯","🎳","🎮","🎰","🧩","🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🦯","🦽","🦼","🛴","🚲","🛵","🏍️","🛺","🚨","🚔","🚍","🚘","🚖","🚡","🚠","🚟","🚃","🚋","🚞","🚝","🚄","🚅","🚈","🚂","🚆","🚇","🚊","🚉","✈️","🛫","🛬","🛩️","💺","🛰️","🚀","🛸","🚁","🛶","⛵","🚤","🛥️","🛳️","⛴️","🚢","⚓","⛽","🚧","🚦","🚥","🚏","🗺️","🗿","🗽","🗼","🏰","🏯","🏟️","🎡","🎢","🎠","⛲","⛱️","🏖️","🏝️","🏜️","🌋","⛰️","🏔️","🗻","🏕️","⛺","🛖","🏠","🏡","🏘️","🏚️","🏗️","🏭","🏢","🏬","🏣","🏤","🏥","🏦","🏨","🏪","🏫","🏩","💒","🏛️","⛪","🕌","🕍","🛕","🕋","⛩️","🛤️","🛣️","🗾","🎑","🏞️","🌅","🌄","🌠","🎇","🎆","🌇","🌆","🏙️","🌃","🌌","🌉","🌁",
    ],
  },
  {
    key: "symbols",
    label: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑","⛔","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🚭","❗","❕","❓","❔","‼️","⁉️","🔅","🔆","〽️","⚠️","🚸","🔱","⚜️","🔰","♻️","✅","🈯","💹","❇️","✳️","❎","🌐","💠","Ⓜ️","🌀","💤","🏧","🚾","♿","🅿️","🈳","🈂","🛂","🛃","🛄","🛅","🛗","🧳","🧭","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚","🕛","🕜","🕝","🕞","🕟","🕠","🕡","🕢","🕣","🕤","🕥","🕦","🕧",
    ],
  },
];

const MAX_AUDIO_BYTES = 700_000; // matches the server cap (server/index.ts)

export default function ChatScreen() {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const requestId = (route.params as ChatRouteParams)?.requestId;

  const { user } = useAuth();
  const myEmail = user?.email;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<string>("smileys");
  const emojiAnim = useRef(new Animated.Value(0)).current;
  const EMOJI_TRAY_HEIGHT = 280;
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingFor, setRecordingFor] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playSoundRef = useRef<Audio.Sound | null>(null);
  const [requestInfo, setRequestInfo] = useState<{
    description: string;
    lat: number;
    lng: number;
    requesterName: string;
    requesterEmail: string;
    status: string;
  } | null>(null);

  const listRef = useRef<FlatList<ChatMessage> | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const socketRef = useSocket(
    {
      onChatHistory: (payload) => {
        if (payload.requestId !== requestId) return;
        setMessages(payload.messages || []);
        setLoading(false);
      },
      onChatMessage: (msg) => {
        if (msg.requestId !== requestId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      },
    },
    !!requestId,
  );

  useEffect(() => {
    if (!requestId) return;
    const socket = socketRef.current;
    if (!socket) return;

    const join = () => {
      socket.emit("join_chat", { requestId });
      setJoined(true);
    };

    if (socket.connected) {
      join();
    } else {
      socket.once("connect", join);
    }

    // Fetch request details for the chat header
    (async () => {
      try {
        const reqs = await api.getRequests().catch(() => []);
        const all = Array.isArray(reqs) ? reqs : [];
        const req = all.find((r: any) => String(r.id) === String(requestId));
        if (req) {
          setRequestInfo({
            description: req.description || "",
            lat: req.lat ?? 0,
            lng: req.lng ?? 0,
            requesterName: req.requesterName || req.createdBy || "Unknown",
            requesterEmail: req.requesterEmail || req.createdBy || "",
            status: req.status || "ACTIVE",
          });
        }
      } catch {
        // ignore
      }
    })();

    const timeout = setTimeout(() => setLoading(false), 1500);
    return () => {
      clearTimeout(timeout);
      socket.off("connect", join);
    };
  }, [requestId, socketRef]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  // Animate emoji tray open/closed
  useEffect(() => {
    Animated.spring(emojiAnim, {
      toValue: showEmoji ? EMOJI_TRAY_HEIGHT : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  }, [showEmoji]);

  // Cleanup any recording/playback on unmount.
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recording?.stopAndUnloadAsync().catch(() => undefined);
      playSoundRef.current?.unloadAsync().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const socket = socketRef.current;
    if (!socket?.connected) {
      toast.error("Not connected. Try again in a moment.");
      return;
    }
    if (!joined) {
      toast.error("Joining chat — please wait a moment.");
      return;
    }
    socket.emit("send_chat_message", { requestId, text });
    setDraft("");
  }, [draft, joined, requestId, socketRef, toast]);

  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        toast.error("Microphone permission denied");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setRecordingFor(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingFor((s) => (s != null ? s + 1 : 0));
      }, 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start recording");
    }
  }, [toast]);

  const cancelRecording = useCallback(async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    try {
      await recording?.stopAndUnloadAsync();
    } catch {
      /* ignore */
    }
    setRecording(null);
    setRecordingFor(null);
  }, [recording]);

  const stopAndSendRecording = useCallback(async () => {
    if (!recording) return;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    const duration = recordingFor ?? 0;
    setRecordingFor(null);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;

      // Read the file and base64-encode it so the server's existing
      // socket protocol (server/index.ts: send_voice_note) accepts it.
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Rough byte estimate: base64 length * 0.75
      if (base64.length * 0.75 > MAX_AUDIO_BYTES) {
        toast.error("Recording is too long. Keep voice notes under ~30 seconds.");
        return;
      }

      const socket = socketRef.current;
      if (!socket?.connected) {
        toast.error("Not connected. Try again in a moment.");
        return;
      }
      socket.emit("send_voice_note", {
        requestId,
        audioBase64: base64,
        mimeType: "audio/m4a",
        durationSec: duration,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send voice note");
    }
  }, [recording, recordingFor, requestId, socketRef, toast]);

  const playAudio = useCallback(
    async (msg: ChatMessage) => {
      if (!msg.audioBase64) return;
      try {
        // Stop any currently playing clip.
        await playSoundRef.current?.unloadAsync().catch(() => undefined);
        playSoundRef.current = null;

        if (playingId === msg.id) {
          setPlayingId(null);
          return;
        }

        const fileUri = `${FileSystem.cacheDirectory}voice-${msg.id}.m4a`;
        await FileSystem.writeAsStringAsync(fileUri, msg.audioBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
        playSoundRef.current = sound;
        setPlayingId(msg.id);
        sound.setOnPlaybackStatusUpdate((s: any) => {
          if (s?.didJustFinish) {
            setPlayingId(null);
            sound.unloadAsync().catch(() => undefined);
          }
        });
        await sound.playAsync();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Playback failed");
      }
    },
    [playingId, toast],
  );

  const data = useMemo(() => messages, [messages]);

  if (!requestId) {
    return (
      <Screen>
        <Text style={styles.muted}>Missing request id.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false} keyboardOffset={20}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={20} color={palette.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {requestInfo?.description?.slice(0, 35) || "Coordination Chat"}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {requestInfo
              ? `${requestInfo.requesterName} · ${requestInfo.lat.toFixed(4)}, ${requestInfo.lng.toFixed(4)} · ${requestInfo.status}`
              : "Encrypted coordination chat"}
          </Text>
        </View>
        <View style={styles.shield}>
          <ShieldCheck size={14} color={palette.statusClaimed} />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Spinner />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(m) => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const mine = item.senderEmail === myEmail;
            const isAudio = item.type === "audio" || !!item.audioBase64;
            return (
              <View style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.theirsWrap]}>
                {!mine ? <Text style={styles.sender}>{item.senderName}</Text> : null}
                <View style={[styles.bubble, mine ? styles.mineBubble : styles.theirsBubble]}>
                  {isAudio ? (
                    <Pressable
                      onPress={() => playAudio(item)}
                      style={styles.audioRow}
                      hitSlop={6}
                    >
                      <View
                        style={[
                          styles.audioPlay,
                          { backgroundColor: mine ? "rgba(0,0,0,0.18)" : palette.crisisRescue },
                        ]}
                      >
                        {playingId === item.id ? (
                          <Pause size={14} color={mine ? "#03121C" : "#fff"} />
                        ) : (
                          <Play size={14} color={mine ? "#03121C" : "#fff"} />
                        )}
                      </View>
                      <Text style={[styles.bubbleText, mine && { color: "#03121C" }]}>
                        Voice note
                        {item.durationSec ? ` · ${formatDuration(item.durationSec)}` : ""}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.bubbleText, mine && { color: "#03121C" }]}>
                      {item.text}
                    </Text>
                  )}
                </View>
                <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.muted}>No messages yet — say hi.</Text>
            </View>
          }
        />
      )}

      <Animated.View
        style={[
          styles.emojiTray,
          { height: emojiAnim, overflow: "hidden" },
        ]}
      >
        <View style={styles.emojiHeader}>
          <Text style={styles.smallMuted}>Emoji</Text>
          <Pressable onPress={() => setShowEmoji(false)} hitSlop={6}>
            <X size={16} color={palette.mutedForeground} />
          </Pressable>
        </View>
        <View style={styles.emojiTabBar}>
          {EMOJI_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => setActiveEmojiCategory(cat.key)}
              style={[
                styles.emojiTab,
                activeEmojiCategory === cat.key && styles.emojiTabActive,
              ]}
              hitSlop={6}
            >
              <Text style={styles.emojiTabText}>{cat.label}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView
          style={styles.emojiScroll}
          contentContainerStyle={styles.emojiGrid}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {EMOJI_CATEGORIES.find((c) => c.key === activeEmojiCategory)?.emojis.map((e) => (
            <Pressable
              key={e}
              onPress={() => {
                setDraft((prev) => prev + e);
              }}
              style={styles.emojiCell}
              hitSlop={4}
            >
              <Text style={styles.emojiText}>{e}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>

      {recording ? (
        <View style={styles.recBar}>
          <ActivityIndicator size="small" color={palette.destructive} />
          <Text style={styles.recText}>
            Recording…{" "}
            {recordingFor != null ? formatDuration(recordingFor) : "0:00"}
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={cancelRecording} hitSlop={6} style={styles.recBtn}>
            <X size={16} color={palette.mutedForeground} />
          </Pressable>
          <Pressable onPress={stopAndSendRecording} hitSlop={6} style={styles.recBtnPrimary}>
            <Send size={16} color="#03121C" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.composer}>
          <Pressable
            onPress={() => setShowEmoji((s) => !s)}
            hitSlop={6}
            style={styles.iconBtn}
            accessibilityLabel="Toggle emoji picker"
          >
            <Smile size={20} color={showEmoji ? palette.crisisRescue : palette.mutedForeground} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message…"
            placeholderTextColor={palette.mutedForeground}
            style={styles.composerInput}
            multiline
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          {draft.trim() ? (
            <Pressable
              onPress={send}
              style={styles.sendBtn}
              hitSlop={6}
              accessibilityLabel="Send message"
            >
              <Send size={18} color="#03121C" />
            </Pressable>
          ) : (
            <Pressable
              onPress={startRecording}
              style={styles.sendBtn}
              hitSlop={6}
              accessibilityLabel="Record voice note"
            >
              <Mic size={18} color="#03121C" />
            </Pressable>
          )}
        </View>
      )}
    </Screen>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderBottomColor: c.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: { ...typography.h3, color: c.foreground },
    muted: { ...typography.small, color: c.mutedForeground },
    smallMuted: { ...typography.caption, color: c.mutedForeground, textTransform: "none" },
    shield: {
      width: 28, height: 28, borderRadius: radius.pill,
      backgroundColor: "rgba(49, 168, 101, 0.18)",
      alignItems: "center", justifyContent: "center",
    },

    list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md, flexGrow: 1 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl },

    bubbleWrap: { maxWidth: "80%" },
    mineWrap: { alignSelf: "flex-end", alignItems: "flex-end" },
    theirsWrap: { alignSelf: "flex-start", alignItems: "flex-start" },
    sender: { ...typography.caption, color: c.mutedForeground, marginBottom: 2, textTransform: "none" },
    bubble: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    mineBubble: {
      backgroundColor: c.crisisRescue,
      borderColor: c.crisisRescue,
      borderBottomRightRadius: 4,
    },
    theirsBubble: {
      backgroundColor: c.surfaceGlass,
      borderColor: c.surfaceGlassBorder,
      borderBottomLeftRadius: 4,
    },
    bubbleText: { ...typography.body, color: c.foreground },
    timestamp: { ...typography.caption, color: c.mutedForeground, marginTop: 2, textTransform: "none" },

    audioRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    audioPlay: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
    },

    composer: {
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
      paddingBottom: spacing.lg,
      borderTopColor: c.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: c.surface,
      alignItems: "flex-end",
    },
    iconBtn: {
      width: 42, height: 42, borderRadius: radius.lg,
      backgroundColor: c.surface,
      borderColor: c.border, borderWidth: 1,
      alignItems: "center", justifyContent: "center",
    },
    composerInput: {
      flex: 1,
      minHeight: 42,
      maxHeight: 120,
      color: c.foreground,
      fontSize: 15,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.input,
      backgroundColor: c.background,
    },
    sendBtn: {
      width: 42, height: 42, borderRadius: radius.lg,
      backgroundColor: c.crisisRescue,
      alignItems: "center", justifyContent: "center",
    },

    emojiTray: {
      borderTopColor: c.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: c.surface,
    },
    emojiScroll: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    emojiHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    emojiTabBar: {
      flexDirection: "row",
      gap: spacing.xs,
      marginBottom: spacing.sm,
      paddingBottom: spacing.xs,
      borderBottomColor: c.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    emojiTab: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.lg,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
    },
    emojiTabActive: {
      backgroundColor: c.crisisRescue,
      borderColor: c.crisisRescue,
    },
    emojiTabText: { fontSize: 18 },
    emojiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    emojiCell: {
      width: 44, height: 44, borderRadius: radius.md,
      alignItems: "center", justifyContent: "center",
      backgroundColor: c.background,
      borderWidth: 1, borderColor: c.border,
    },
    emojiText: { fontSize: 22 },

    recBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      paddingBottom: spacing.lg,
      borderTopColor: c.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: c.surface,
    },
    recText: { ...typography.bodyStrong, color: c.foreground },
    recBtn: {
      width: 36, height: 36, borderRadius: radius.md,
      backgroundColor: c.surface,
      borderColor: c.border, borderWidth: 1,
      alignItems: "center", justifyContent: "center",
    },
    recBtnPrimary: {
      width: 36, height: 36, borderRadius: radius.md,
      backgroundColor: c.crisisRescue,
      alignItems: "center", justifyContent: "center",
    },
  });
