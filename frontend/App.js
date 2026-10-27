import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, session, setOnExpire, setToken } from './src/api';
import { C } from './src/theme';
import { Btn, T, notify, run, useWide } from './src/ui';
import Login from './src/screens/Login';
import Dashboard from './src/screens/Dashboard';
import Patients from './src/screens/Patients';
import Appointments from './src/screens/Appointments';
import Consult from './src/screens/Consult';
import Pharmacy from './src/screens/Pharmacy';
import Lab from './src/screens/Lab';
import Billing from './src/screens/Billing';
import Accounting from './src/screens/Accounting';
import Hr from './src/screens/Hr';
import Staff from './src/screens/Staff';
import AssistantScreen from './src/AssistantScreen';

// Admin sees everything; every other role sees only the screens listed for it.
const MENU = [
  { key: 'dashboard', label: 'Dashboard', icon: 'speedometer-outline', roles: ['accountant', 'receptionist', 'hr'], Comp: Dashboard },
  { key: 'consult', label: 'My patients', icon: 'medical-outline', roles: ['doctor'], Comp: Consult },
  { key: 'appointments', label: 'Appointments', icon: 'calendar-outline', roles: ['receptionist', 'nurse'], Comp: Appointments },
  { key: 'patients', label: 'Patients', icon: 'people-outline', roles: ['receptionist', 'doctor', 'nurse', 'pharmacist', 'lab', 'accountant'], Comp: Patients },
  { key: 'pharmacy', label: 'Pharmacy', icon: 'medkit-outline', roles: ['pharmacist', 'doctor', 'nurse'], Comp: Pharmacy },
  { key: 'lab', label: 'Lab', icon: 'flask-outline', roles: ['lab', 'doctor'], Comp: Lab },
  { key: 'billing', label: 'Billing', icon: 'receipt-outline', roles: ['receptionist', 'accountant', 'pharmacist'], Comp: Billing },
  { key: 'accounting', label: 'Accounts', icon: 'cash-outline', roles: ['accountant'], Comp: Accounting },
  { key: 'hr', label: 'Attendance & salary', icon: 'time-outline', roles: ['hr'], Comp: Hr },
  { key: 'staff', label: 'Staff', icon: 'id-card-outline', roles: ['hr'], Comp: Staff },
  {
  key: 'assistant',
  label: 'AI Assistant',
  icon: 'chatbubbles-outline',
  roles: [
    'admin',
    'doctor',
    'doctor2',
    'reception',
    'receptionist',
    'nurse',
    'pharmacist',
    'lab',
    'accountant',
    'hr'
  ],
  Comp: AssistantScreen
},
];
const menuFor = (role) => MENU.filter((m) => role === 'admin' || m.roles.includes(role));

function Shell({ me, onLogout }) {
  const wide = useWide(); const items = menuFor(me.role); const [tab, setTab] = useState(items[0].key);
  const Cur = (items.find((m) => m.key === tab) || items[0]).Comp;
  const punch = (kind) => run(async () => { const r = await api('/hr/' + kind, { method: 'POST' }); notify(kind === 'check-in' ? `Checked in at ${r.check_in}` : `Checked out at ${r.check_out}`); });
  const Nav = ({ m }) => {
    const on = m.key === tab;
    return (
      <Pressable onPress={() => setTab(m.key)} style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: wide ? 12 : 2, paddingVertical: wide ? 12 : 8, paddingHorizontal: wide ? 20 : 14, backgroundColor: on && wide ? 'rgba(255,255,255,0.12)' : 'transparent', borderLeftWidth: wide ? 3 : 0, borderLeftColor: on ? '#7FD6CC' : 'transparent' }}>
        <Ionicons name={m.icon} size={wide ? 20 : 22} color={on ? '#fff' : '#9BC2BE'} />
        <Text style={{ color: on ? '#fff' : '#9BC2BE', fontSize: wide ? 15 : 11, fontWeight: on ? '700' : '500' }}>{m.label}</Text>
      </Pressable>
    );
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: wide ? C.bg : C.primaryDark }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: C.bg }}>
        {wide && (
          <View style={{ width: 240, backgroundColor: C.primaryDark, paddingTop: 24 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', paddingHorizontal: 20, marginBottom: 20 }}>Hospital ERP</Text>
            <ScrollView>{items.map((m) => <Nav key={m.key} m={m} />)}</ScrollView>
            <View style={{ padding: 16, gap: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{me.name}</Text><Text style={{ color: '#9BC2BE', textTransform: 'capitalize' }}>{me.role}</Text>
              <Btn small kind="ghost" title="Check in" onPress={() => punch('check-in')} /><Btn small kind="ghost" title="Check out" onPress={() => punch('check-out')} />
              <Btn small kind="ghost" title="Sign out" onPress={onLogout} />
            </View>
          </View>)}
        <View style={{ flex: 1 }}>
          {!wide && (
            <View style={{ backgroundColor: C.primaryDark, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>Hospital ERP</Text>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <Pressable onPress={() => punch('check-in')}><Ionicons name="log-in-outline" size={24} color="#fff" /></Pressable>
                <Pressable onPress={() => punch('check-out')}><Ionicons name="log-out-outline" size={24} color="#fff" /></Pressable>
                <Pressable onPress={onLogout}><Ionicons name="power-outline" size={24} color="#fff" /></Pressable>
              </View>
            </View>)}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: wide ? 28 : 14, paddingBottom: 40, alignSelf: 'center', width: '100%', maxWidth: 1150 }} keyboardShouldPersistTaps="handled">
            <Cur
  me={me}
  key={tab}
  onLogout={onLogout}
/>
          </ScrollView>
          {!wide && <View style={{ backgroundColor: C.primaryDark }}><ScrollView horizontal showsHorizontalScrollIndicator={false}>{items.map((m) => <Nav key={m.key} m={m} />)}</ScrollView></View>}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [me, setMe] = useState(null); const [ready, setReady] = useState(false);
  const logout = async () => { setToken(null); await session.clear(); setMe(null); };
  useEffect(() => {
    setOnExpire(logout);
    session.load().then((s) => { if (s) { setToken(s.t); setMe(s.u); } setReady(true); });
  }, []);
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={C.primary} /></View>;
  if (!me) return <Login onLogin={async (t, u) => { setToken(t); await session.save(t, u); setMe(u); }} />;
  return <Shell me={me} onLogout={logout} />;
}
