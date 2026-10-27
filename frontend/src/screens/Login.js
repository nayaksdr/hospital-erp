import React, { useState } from 'react';
import { View } from 'react-native';
import { api } from '../api';
import { C } from '../theme';
import { Btn, Card, Field, T, run } from '../ui';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  const go = () => { setBusy(true); run(async () => { const r = await api('/auth/login', { method: 'POST', body: { email, password } }); onLogin(r.token, r.user); }).finally(() => setBusy(false)); };
  return (
    <View style={{ flex: 1, backgroundColor: C.primaryDark, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 400, padding: 28, gap: 14 }}>
        <T v="h1">Hospital ERP</T>
        <T v="small">Sign in with your staff account</T>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={go} />
        <Btn title="Sign in" onPress={go} busy={busy} />
        <T v="small">Demo: admin@hospital.com / admin123</T>
      </Card>
    </View>
  );
}
