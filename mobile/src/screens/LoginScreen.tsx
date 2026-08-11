import { useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { apiErrorMessage } from "../api/client";
import { login } from "../api/auth";

export function LoginScreen() {
  const { setSession } = useAuth();
  const [subdomain, setSubdomain] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const trimmedSubdomain = subdomain.trim();
      const result = await login({
        ...(trimmedSubdomain ? { subdomain: trimmedSubdomain } : {}),
        username: username.trim(),
        password,
      });
      await setSession(result.access_token, result.user);
    } catch (err) {
      setError(apiErrorMessage(err, "Giriş başarısız — bilgileri kontrol edin"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>StockSense</Text>
      <TextInput
        style={styles.input}
        placeholder="Şirket kodu (subdomain)"
        autoCapitalize="none"
        value={subdomain}
        onChangeText={setSubdomain}
      />
      <TextInput
        style={styles.input}
        placeholder="Kullanıcı adı"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Şifre"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {loading ? <ActivityIndicator /> : <Button title="Giriş yap" onPress={handleSubmit} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c0392b" },
});
