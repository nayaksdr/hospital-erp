import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Physical phone: set EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:8000
export const BASE = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');
let token = null;
export const setToken = (t) => { token = t; };
let onExpire = () => {};
export const setOnExpire = (f) => { onExpire = f; };

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    });
  } catch { throw new Error('Cannot reach the server. Check your connection.'); }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) onExpire();
    const d = data?.detail;
    throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => `${x.loc?.slice(-1)[0]}: ${x.msg}`).join('\n') : 'Something went wrong.');
  }
  return data;
}

export const session = {
  save: (t, u) => AsyncStorage.setItem('session', JSON.stringify({ t, u })),
  load: async () => JSON.parse((await AsyncStorage.getItem('session')) || 'null'),
  clear: () => AsyncStorage.removeItem('session'),
};
