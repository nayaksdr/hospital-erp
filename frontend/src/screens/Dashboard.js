import React from 'react';
import { View } from 'react-native';
import { api } from '../api';
import { C } from '../theme';
import { Async, Card, Grid, Header, Row, Stack, Stat, T, money, useLoad } from '../ui';

export default function Dashboard() {
  const s = useLoad(() => api('/dashboard'));
  return (
    <Stack>
      <Header title="Dashboard" />
      <Async s={s}>{(d) => {
        const max = Math.max(1, ...d.trend.flatMap((t) => [t.income, t.expense]));
        const cats = Object.entries(d.month.expenses.by_category);
        return (<>
          <Grid>
            <Stat label="Appointments today" value={d.today.appointments_total} sub={`${d.today.new_patients} new patients`} />
            <Stat label="Collected today" value={money(d.today.collection.total)} sub={`Cash ${money(d.today.collection.cash)} · Online ${money(d.today.collection.online)}`} />
            <Stat label="Pending bills" value={money(d.pending_bills.amount)} sub={`${d.pending_bills.count} invoices`} tone={d.pending_bills.count ? 'bad' : undefined} />
            <Stat label="Staff present today" value={`${d.staff.present_today}/${d.staff.total}`} />
          </Grid>
          <Grid>
            <Stat label="Income this month" value={money(d.month.income.total)} sub={`Cash ${money(d.month.income.cash)} · Online ${money(d.month.income.online)}`} />
            <Stat label="Expenses this month" value={money(d.month.expenses.total)} sub={`Building rent ${money(d.monthly_rent)} / month`} />
            <Stat label={d.month.profit >= 0 ? 'Profit this month' : 'Loss this month'} value={money(Math.abs(d.month.profit))} tone={d.month.profit >= 0 ? 'good' : 'bad'} />
            <Stat label="Pharmacy alerts" value={d.pharmacy.low_stock + d.pharmacy.expiring_soon} sub={`${d.pharmacy.low_stock} low stock · ${d.pharmacy.expiring_soon} expiring`} tone={d.pharmacy.low_stock ? 'bad' : undefined} />
          </Grid>
          <Grid>
            <Card style={{ flexGrow: 2, flexBasis: 340 }}>
              <T v="h2">Income vs expenses, last 6 months</T>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 14, paddingTop: 8 }}>
                {d.trend.map((t) => (
                  <View key={t.month} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 120 }}>
                      <View style={{ width: 14, height: Math.max(2, (t.income / max) * 120), backgroundColor: C.primary, borderRadius: 3 }} />
                      <View style={{ width: 14, height: Math.max(2, (t.expense / max) * 120), backgroundColor: C.warn, borderRadius: 3 }} />
                    </View>
                    <T v="small">{t.month.slice(5)}</T>
                  </View>))}
              </View>
              <T v="small">Teal = income · Amber = expenses</T>
            </Card>
            <Card style={{ flexGrow: 1, flexBasis: 260 }}>
              <T v="h2">Where the money went this month</T>
              {cats.length === 0 ? <T v="small">No expenses recorded yet.</T> : cats.map(([k, v]) => <Row key={k} left={<T>{k}</T>} right={<T v="b">{money(v)}</T>} />)}
            </Card>
          </Grid>
        </>);
      }}</Async>
    </Stack>
  );
}
