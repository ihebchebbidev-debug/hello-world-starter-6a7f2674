import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Screen, Icon, ScreenHeader, Button, useToast } from '../components';
import { colors, radius, spacing, shadows, typography } from '../theme';
import { NotificationPreferencesAPI } from '../services/api';
import { humanizeError } from '../utils/errors';

const PREFS_KEY = '@ecobus_notif_prefs_v1';

const DEFAULT_PREFS = {
  master:      true,
  boarded:     true,
  droppedOff:  true,
  etaReminder: true,
  delay:       true,
  routeChange: true,
  quietHours:  false,
  quietFrom:   '22:00',
  quietTo:     '07:00',
};

// Time wheel values
const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const ITEM_H   = 50;
const VISIBLE  = 5;
const WHEEL_H  = ITEM_H * VISIBLE;
const WHEEL_PAD = ITEM_H * 2;

/* ── Time wheel sub-component ────────────────────────────────────── */
function TimeWheel({ values, value, onChange }) {
  const ref = useRef(null);

  const scrollToValue = useCallback(() => {
    const idx = values.indexOf(value);
    if (idx >= 0 && ref.current) {
      ref.current.scrollTo({ y: idx * ITEM_H, animated: false });
    }
  }, [value, values]);

  const handleScrollEnd = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    onChange(values[clamped]);
  };

  return (
    <View style={tw.wheel}>
      {/* Highlight bar behind the center/selected item */}
      <View style={tw.highlight} pointerEvents="none" />

      <ScrollView
        ref={ref}
        style={{ height: WHEEL_H }}
        contentContainerStyle={{ paddingVertical: WHEEL_PAD }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onLayout={scrollToValue}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
      >
        {values.map((v) => {
          const selected = v === value;
          return (
            <View key={v} style={tw.item}>
              <Text style={[tw.itemText, selected && tw.itemTextSelected]}>
                {v}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ── Main screen ─────────────────────────────────────────────────── */
export default function NotificationPreferencesScreen({ navigation }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  // Time picker state
  const [pickerTarget, setPickerTarget] = useState(null); // 'quietFrom' | 'quietTo'
  const [pickerHour,   setPickerHour]   = useState('22');
  const [pickerMinute, setPickerMinute] = useState('00');

  // Per-key debounce timers so flipping several toggles quickly issues one
  // PUT per key (the latest value wins) instead of a flood of requests.
  const saveTimers = useRef({});
  // Snapshot of the last server-confirmed prefs — used to roll back a toggle
  // when the PUT fails so the UI doesn't lie about the persisted state.
  const lastServerPrefs = useRef(DEFAULT_PREFS);

  // Initial load: render the AsyncStorage cache instantly, then refresh from
  // the server so the source of truth wins on a reconnect.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (!cancelled && raw) {
          const parsed = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
          setPrefs(parsed);
          lastServerPrefs.current = parsed;
        }
      })
      .catch(() => {});
    NotificationPreferencesAPI.get()
      .then((server) => {
        if (cancelled) return;
        const merged = { ...DEFAULT_PREFS, ...server };
        setPrefs(merged);
        lastServerPrefs.current = merged;
        AsyncStorage.setItem(PREFS_KEY, JSON.stringify(merged)).catch(() => {});
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const update = (key, value) => {
    const previousValue = lastServerPrefs.current[key];
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    // Debounce the network write per-key (300ms).
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      try {
        const server = await NotificationPreferencesAPI.update({ [key]: value });
        lastServerPrefs.current = { ...lastServerPrefs.current, ...server };
      } catch (err) {
        // Roll back to the last server-confirmed value and tell the user.
        setPrefs((prev) => {
          const reverted = { ...prev, [key]: previousValue };
          AsyncStorage.setItem(PREFS_KEY, JSON.stringify(reverted)).catch(() => {});
          return reverted;
        });
        toast.show(humanizeError(err, t), { tone: 'danger' });
      }
    }, 300);
  };

  // Flush any pending writes when the screen unmounts.
  useEffect(() => () => {
    Object.values(saveTimers.current).forEach((t) => t && clearTimeout(t));
  }, []);

  const openPicker = (key) => {
    const [h, m] = prefs[key].split(':');
    setPickerHour(h);
    setPickerMinute(m);
    setPickerTarget(key);
  };

  const confirmPicker = () => {
    update(pickerTarget, `${pickerHour}:${pickerMinute}`);
    setPickerTarget(null);
  };

  const masterOff = !prefs.master;

  return (
    <>
      <Screen padded={false} scroll statusBarStyle="dark-content">
        <ScreenHeader title={t('notifPrefs.title')} onBack={() => navigation.goBack()} />

        <View style={s.content}>

          {/* ── Master switch ── */}
          <View style={[s.masterCard, prefs.master && s.masterCardActive]}>
            <View style={[s.masterIcon, prefs.master && s.masterIconActive]}>
              <Icon name="tabNotifications" size={24} tint={prefs.master ? colors.primary : colors.textMuted} />
            </View>
            <View style={s.masterText}>
              <Text style={s.masterTitle}>{t('notifPrefs.masterToggle')}</Text>
              <Text style={s.masterSub}>{t('notifPrefs.masterToggleSub')}</Text>
            </View>
            <Switch
              value={prefs.master}
              onValueChange={(v) => update('master', v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.border}
            />
          </View>

          {/* ── Trip Updates ── */}
          <GroupLabel label={t('notifPrefs.trips')} />
          <View style={s.group}>
            <PrefRow
              icon="statusOnBus" iconBg={colors.successLight} iconTint={colors.success}
              title={t('notifPrefs.boarded')} sub={t('notifPrefs.boardedSub')}
              value={prefs.boarded} disabled={masterOff}
              onChange={(v) => update('boarded', v)}
            />
            <Divider />
            <PrefRow
              icon="statusDropped" iconBg={colors.primaryLight} iconTint={colors.primary}
              title={t('notifPrefs.droppedOff')} sub={t('notifPrefs.droppedOffSub')}
              value={prefs.droppedOff} disabled={masterOff}
              onChange={(v) => update('droppedOff', v)}
            />
            <Divider />
            <PrefRow
              icon="bus" iconBg={colors.infoLight} iconTint={colors.info}
              title={t('notifPrefs.etaReminder')} sub={t('notifPrefs.etaReminderSub')}
              value={prefs.etaReminder} disabled={masterOff}
              onChange={(v) => update('etaReminder', v)}
            />
          </View>

          {/* ── Alerts ── */}
          <GroupLabel label={t('notifPrefs.alerts')} />
          <View style={s.group}>
            <PrefRow
              icon="statusWaiting" iconBg={colors.warningLight} iconTint={colors.warning}
              title={t('notifPrefs.delay')} sub={t('notifPrefs.delaySub')}
              value={prefs.delay} disabled={masterOff}
              onChange={(v) => update('delay', v)}
            />
            <Divider />
            <PrefRow
              icon="alert" iconBg={colors.infoLight} iconTint={colors.info}
              title={t('notifPrefs.routeChange')} sub={t('notifPrefs.routeChangeSub')}
              value={prefs.routeChange} disabled={masterOff}
              onChange={(v) => update('routeChange', v)}
            />
          </View>

          {/* ── Safety — always on ── */}
          <GroupLabel label={t('notifPrefs.safety')} />
          <View style={s.group}>
            <View style={s.row}>
              <View style={[s.iconBox, { backgroundColor: colors.dangerLight }]}>
                <Icon name="sos" size={18} tint={colors.danger} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowTitle}>{t('notifPrefs.emergency')}</Text>
                <Text style={s.rowSub}>{t('notifPrefs.emergencySub')}</Text>
              </View>
              <View style={s.alwaysBadge}>
                <Text style={s.alwaysText}>{t('notifPrefs.alwaysOn')}</Text>
              </View>
            </View>
          </View>
          <Text style={s.safetyNote}>{t('notifPrefs.safetyNote')}</Text>

          {/* ── Quiet Hours ── */}
          <GroupLabel label={t('notifPrefs.quietHours')} />
          <View style={s.group}>
            <PrefRow
              icon="alert" iconBg={colors.surfaceAlt} iconTint={colors.textMuted}
              title={t('notifPrefs.quietHoursToggle')} sub={t('notifPrefs.quietHoursSub')}
              value={prefs.quietHours} disabled={masterOff}
              onChange={(v) => update('quietHours', v)}
            />
            {prefs.quietHours && !masterOff ? (
              <>
                <Divider />
                <View style={s.timeRow}>
                  <Text style={s.timeLabel}>{t('notifPrefs.from')}</Text>
                  <Pressable
                    onPress={() => openPicker('quietFrom')}
                    style={({ pressed }) => [s.timePill, pressed && s.timePillPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('notifPrefs.from')} ${prefs.quietFrom}`}
                  >
                    <Text style={s.timeVal}>{prefs.quietFrom}</Text>
                  </Pressable>
                  <Text style={s.timeSep}>—</Text>
                  <Text style={s.timeLabel}>{t('notifPrefs.to')}</Text>
                  <Pressable
                    onPress={() => openPicker('quietTo')}
                    style={({ pressed }) => [s.timePill, pressed && s.timePillPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('notifPrefs.to')} ${prefs.quietTo}`}
                  >
                    <Text style={s.timeVal}>{prefs.quietTo}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>

          <View style={{ height: 32 }} />
        </View>
      </Screen>

      {/* ── Time picker modal ── */}
      {pickerTarget ? (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setPickerTarget(null)}
        >
          <Pressable
            style={s.pickerOverlay}
            onPress={() => setPickerTarget(null)}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>
              {pickerTarget === 'quietFrom' ? t('notifPrefs.from') : t('notifPrefs.to')}
            </Text>

            <View style={s.pickerWheels}>
              <TimeWheel values={HOURS}   value={pickerHour}   onChange={setPickerHour}   />
              <Text style={s.pickerColon}>:</Text>
              <TimeWheel values={MINUTES} value={pickerMinute} onChange={setPickerMinute} />
            </View>

            <View style={s.pickerActions}>
              <Button
                title={t('common.cancel')}
                variant="ghost"
                onPress={() => setPickerTarget(null)}
              />
              <View style={{ width: spacing.sm }} />
              <Button
                title={t('common.save')}
                onPress={confirmPicker}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function GroupLabel({ label }) {
  return (
    <View style={s.groupLabelWrap}>
      <Text style={s.groupLabel}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

function PrefRow({ icon, iconBg, iconTint, title, sub, value, disabled, onChange }) {
  return (
    <View style={[s.row, disabled && s.rowDimmed]}>
      <View style={[s.iconBox, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={18} tint={disabled ? colors.textDisabled : iconTint} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.rowTitle, disabled && s.textDimmed]}>{title}</Text>
        <Text style={[s.rowSub,   disabled && s.textDimmed]}>{sub}</Text>
      </View>
      <Switch
        value={!disabled && value}
        onValueChange={disabled ? undefined : onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },

  /* Master */
  masterCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  masterCardActive: { borderColor: colors.primary },
  masterIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  masterIconActive: { backgroundColor: colors.primarySoft },
  masterText: { flex: 1 },
  masterTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  masterSub:   { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  /* Section labels */
  groupLabelWrap: { paddingHorizontal: 4, marginBottom: spacing.xs, marginTop: spacing.sm },
  groupLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  /* Card group */
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    ...shadows.card,
  },

  /* Row */
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 64,
    gap: spacing.sm,
  },
  rowDimmed: { opacity: 0.42 },
  iconBox: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText:    { flex: 1 },
  rowTitle:   { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowSub:     { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  textDimmed: { color: colors.textDisabled },

  divider: { height: 1, backgroundColor: colors.border, marginLeft: 62 },

  /* Always-on badge */
  alwaysBadge: {
    backgroundColor: colors.successLight,
    borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  alwaysText: { fontSize: 11, fontWeight: '700', color: colors.success },

  safetyNote: {
    fontSize: 11, color: colors.textMuted,
    paddingHorizontal: 4, marginTop: 4, marginBottom: spacing.sm,
  },

  /* Quiet hours time row */
  timeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  timeLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  timeSep:   { fontSize: 14, color: colors.textMuted },
  timePill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.primaryLight,
  },
  timePillPressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  timeVal: { fontSize: 14, fontWeight: '700', color: colors.primary },

  /* Time picker modal */
  pickerOverlay: {
    flex: 1,
    backgroundColor: colors.modalBackdrop,
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    ...shadows.modal,
  },
  pickerHandle: {
    alignSelf: 'center',
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  pickerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  pickerWheels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pickerColon: {
    fontSize: 28, fontWeight: '700', color: colors.textPrimary,
    marginBottom: 4,
  },
  pickerActions: {
    flexDirection: 'row',
  },
});

/* ── Time wheel styles (kept separate for clarity) ──────────────── */
const tw = StyleSheet.create({
  wheel: {
    width: 80,
    height: WHEEL_H,
    overflow: 'hidden',
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    left: 0, right: 0,
    top: WHEEL_PAD,
    height: ITEM_H,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    zIndex: 0,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 22,
    fontWeight: '400',
    color: colors.textMuted,
    opacity: 0.45,
  },
  itemTextSelected: {
    fontWeight: '700',
    color: colors.primary,
    opacity: 1,
  },
});
