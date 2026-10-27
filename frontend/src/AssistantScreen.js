import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "./api";

const QUICK_QUESTIONS = {
  admin: [
    "Show hospital overview",
    "How many patients are registered?",
    "Show pending bills",
    "Show staff overview",
  ],
  doctor: [
    "Show my appointments",
    "Show today's appointments",
    "Find a patient",
  ],
  doctor2: [
    "Show my appointments",
    "Show today's appointments",
    "Find a patient",
  ],
  reception: [
    "How many patients are registered?",
    "Show today's appointments",
    "Show pending bills",
  ],
  nurse: [
    "Show my work",
    "Show today's appointments",
  ],
  pharmacist: [
    "Show medicine stock",
    "Show pharmacy queue",
  ],
  lab: [
    "Show pending lab orders",
    "Show lab orders",
  ],
  accountant: [
    "Show pending bills",
    "Show collections",
    "Show profit and expenses",
  ],
  hr: [
    "Show staff overview",
    "Show attendance",
    "Show payroll overview",
  ],
};

const ROLE_LABELS = {
  admin: "Administrator",
  doctor: "Doctor",
  doctor2: "Doctor 2",
  reception: "Reception",
  nurse: "Nurse",
  pharmacist: "Pharmacist",
  lab: "Laboratory",
  accountant: "Accountant",
  hr: "Human Resources",
};

function getAnswer(data) {
  if (typeof data === "string") return data;

  return (
    data?.answer ||
    data?.response ||
    data?.message ||
    data?.reply ||
    "I couldn't find an answer. Please try another question."
  );
}

export default function AssistantScreen({ me }) {
  const role = String(me?.role || "").toLowerCase();
  const userName = me?.name || "User";
  const suggestions = QUICK_QUESTIONS[role] || [
    "Show my work",
    "Show today's appointments",
  ];

  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        `Hello ${userName}! I am your Hospital ERP Assistant. ` +
        "Ask a question about the modules available to your role.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  async function sendMessage(text = input) {
    const question = String(text || "").trim();

    if (!question || loading) return;

    setInput("");
    setError("");

    const previousHistory = messages
      .filter((m) => m.id !== "welcome")
      .slice(-6)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: question,
    };

    setMessages((old) => [...old, userMessage]);
    setLoading(true);

    try {
      const data = await api("/assistant/chat", {
        method: "POST",
        body: {
          message: question,
          history: previousHistory,
        },
      });

      const answer = getAnswer(data);

      setMessages((old) => [
        ...old,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (e) {
      setError(
        e.message ||
          "Unable to connect to the assistant. Check your connection and server."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setError("");
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Chat cleared. What would you like to know?",
      },
    ]);
  }

  function renderMessage({ item }) {
    const isUser = item.role === "user";

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userRow : styles.assistantRow,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {!isUser && (
            <Text style={styles.assistantLabel}>HOSPITAL AI</Text>
          )}

          <Text
            style={[
              styles.messageText,
              isUser && styles.userMessageText,
            ]}
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>✚</Text>
          </View>

          <View style={styles.headerDetails}>
            <Text style={styles.headerTitle}>Hospital AI Assistant</Text>
            <Text style={styles.headerSubtitle}>
              {ROLE_LABELS[role] || role || "Hospital user"} · ERP Support
            </Text>
          </View>

          <TouchableOpacity
            onPress={clearChat}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusBar}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Assistant ready</Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          ListFooterComponent={
            loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.loadingText}>
                  Assistant is thinking...
                </Text>
              </View>
            ) : null
          }
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && (
          <View style={styles.suggestionsSection}>
            <Text style={styles.suggestionsTitle}>Suggested questions</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {suggestions.map((question) => (
                <TouchableOpacity
                  key={question}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(question)}
                  disabled={loading}
                >
                  <Text style={styles.suggestionText}>{question}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.inputArea}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about patients, appointments..."
            placeholderTextColor="#8993A4"
            style={styles.input}
            multiline
            maxLength={2000}
            editable={!loading}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!input.trim() || loading) && styles.sendButtonDisabled,
            ]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
            accessibilityLabel="Send message"
          >
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          Use only information permitted for your role.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E7EAF0",
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E7F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: {
    color: "#2563EB",
    fontSize: 25,
    fontWeight: "800",
  },
  headerDetails: {
    flex: 1,
    marginLeft: 11,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#172033",
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#687386",
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: "#2563EB",
    fontWeight: "700",
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    marginRight: 8,
  },
  statusText: {
    color: "#667085",
    fontSize: 12,
  },
  messageList: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 18,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  userRow: {
    justifyContent: "flex-end",
  },
  assistantRow: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "88%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: "#2563EB",
    borderBottomRightRadius: 5,
  },
  assistantBubble: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EAF0",
    borderBottomLeftRadius: 5,
  },
  assistantLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#2563EB",
    marginBottom: 6,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#263247",
  },
  userMessageText: {
    color: "#FFFFFF",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  loadingText: {
    marginLeft: 9,
    color: "#667085",
    fontSize: 13,
  },
  errorBox: {
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FEECEC",
  },
  errorText: {
    color: "#B42318",
    fontSize: 13,
  },
  suggestionsSection: {
    paddingTop: 8,
    paddingBottom: 10,
  },
  suggestionsTitle: {
    paddingHorizontal: 15,
    paddingBottom: 8,
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },
  suggestionChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E2F2",
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginLeft: 10,
  },
  suggestionText: {
    color: "#2555A6",
    fontSize: 12,
    fontWeight: "600",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E7EAF0",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    backgroundColor: "#F5F7FB",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: "#172033",
  },
  sendButton: {
    marginLeft: 9,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#A9BDE8",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
  },
  footerNote: {
    textAlign: "center",
    fontSize: 10,
    color: "#8993A4",
    paddingBottom: 6,
    paddingTop: 2,
  },
});