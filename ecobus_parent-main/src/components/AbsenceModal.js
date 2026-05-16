import React, { useMemo, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography, shadows } from '../theme';
import Icon from './Icon';
import Button from './Button';
import { buildDayStrip, todayYMD, addDays } from '../utils/dates';

const REASONS = [
  { key: 'sick',        icon: 'alert',        tone: 'danger'  },
  { key: 'wont_attend', icon: 'statusDropped',tone: 'warning' },
  { key: 'appointment', icon: 'tabHome',      tone: 'info'    },
  { key: 'other',       icon: 'chevronRight', tone: 'neutral' },
];

/**
 * AbsenceModal — bottom-sheet style modal that lets a parent declare their
 * child as absent for one or more days.
 *
 * Props:
 *   visible      — controls open/close
 *   childName    — display only (modal title context)
 *   submitting   — when true, buttons disabled and a spinner replaces "Confirm"
 *   onCancel()   — close without saving
 *   onConfirm({ startDate, endDate, reason, note }) — parent posts to API
 *
 * Multi-day spans: the parent picks two days on the strip; the lower one
 * becomes startDate, the higher one endDate. Tapping the same day toggles
 * back to a single-day absence.
 */
export default function AbsenceModal({
  visible, childName, submitting = false, onCancel, onConfirm,
}) {
  const { t, i18n } = useTranslation();
  const [reason, setReason] = useState(null);
  const [startDate, setStartDate] = useState(todayYMD());
  const [endDate, setEndDate] = useState(todayYMD());
  const [note, setNote] = useState('');

  // Reset internal state every time the modal is reopened.
  React.useEffect(() => {
    if (visible) {
      setReason(null);
      setStartDate(todayYMD());
      setEndDate(todayYMD());
      setNote('');
    }
  }, [visible]);

  const days = useMemo(
    () => buildDayStrip(14, todayYMD(), i18n.language),
    [i18n.language],
  );

  const isSelected = (ymd) => ymd >= startDate && ymd <= endDate;

  const onPickDay = (ymd) => {
    // Tap inside the current selection → collapse to that single day.
    if (isSelected(ymd) && startDate !== endDate) {
      setStartDate(ymd);
      setEndDate(ymd);
      return;
    }
    // Single day already selected → extend the range.
    if (startDate === endDate) {
      if (ymd < startDate) { setStartDate(ymd); }
      else if (ymd > startDate) { setEndDate(ymd); }
      else { /* same day re-tap is a no-op */ }
      return;
    }
    // A range exists and tap is outside → start a new single-day selection.
    setStartDate(ymd);
    setEndDate(ymd);
  };

  const dayCount = useMemo(() => {
    // Inclusive day count between startDate and endDate.
    let n = 1;
    let cursor = startDate;
    while (cursor < endDate) { cursor = addDays(cursor, 1); n += 1; }
    return n;
  }, [startDate, endDate]);

  const canSubmit = !!reason && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    onConfirm?.({
      startDate,
      endDate,
      reason,
      note: note.trim() ? note.trim().slice(0, 500) : undefined,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable style={s.backdrop} onPress={onCancel} accessibilityLabel={t('common.cancel')} />

      <View style={[s.sheet, shadows.modal]}>
        <View style={s.handle} />

        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{t('absence.title')}</Text>
            {childName ? (
              <Text style={s.subtitle} numberOfLines={1}>
                {t('absence.forChild', { name: childName })}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onCancel} hitSlop={10} style={s.closeBtn} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
            <Icon name="chevronRight" size={18} tint={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Reason picker */}
        <Text style={s.section}>{t('absence.reasonLabel')}</Text>
        <View style={s.reasonGrid}>
          {REASONS.map((r) => {
            const active = reason === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                style={[s.reasonChip, active && s.reasonChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(`absence.reason.${r.key}`)}
              >
                <Icon name={r.icon} size={16} tint={active ? colors.textInverse : colors.textPrimary} />
                <Text style={[s.reasonText, active && s.reasonTextActive]} numberOfLines={1}>
                  {t(`absence.reason.${r.key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Day strip */}
        <Text style={s.section}>{t('absence.daysLabel')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dayStrip}
        >
          {days.map((d) => {
            const selected = isSelected(d.ymd);
            const isStart  = d.ymd === startDate;
            const isEnd    = d.ymd === endDate;
            return (
              <Pressable
                key={d.ymd}
                onPress={() => onPickDay(d.ymd)}
                style={[
                  s.dayPill,
                  selected && s.dayPillActive,
                  selected && (isStart || isEnd) && s.dayPillEdge,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${d.dayLabel} ${d.dateLabel}`}
              >
                <Text style={[s.dayName,  selected && s.dayTextActive]}>{d.dayLabel}</Text>
                <Text style={[s.dayDate,  selected && s.dayTextActive]}>{d.dateLabel}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={s.helper}>
          {dayCount === 1
            ? t('absence.oneDayHelper')
            : t('absence.multiDayHelper', { count: dayCount })}
        </Text>

        {/* Optional note */}
        <Text style={s.section}>{t('absence.noteLabel')}</Text>
        <TextInput
          value={note}
          onChangeText={(v) => setNote(v.slice(0, 500))}
          placeholder={t('absence.notePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          style={s.note}
          multiline
          maxLength={500}
        />

        {/* Actions */}
        <View style={s.actions}>
          <View style={{ flex: 1 }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={onCancel} disabled={submitting} />
          </View>
          <View style={{ width: spacing.sm }} />
          <View style={{ flex: 1 }}>
            <Button
              title={submitting ? '' : t('absence.confirm')}
              onPress={submit}
              disabled={!canSubmit}
              iconLeft={submitting ? <ActivityIndicator color={colors.textInverse} /> : null}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.modalBackdrop },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginBottom: spacing.sm,
  },

  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  title:    { ...typography.subtitle, color: colors.textPrimary, fontWeight: '700' },
  subtitle: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '90deg' }],
  },

  section: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reasonChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.sm, paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border,
  },
  reasonChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  reasonText:       { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
  reasonTextActive: { color: colors.textInverse },

  dayStrip: { gap: spacing.xs, paddingVertical: spacing.xs },
  dayPill: {
    minWidth: 60,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  dayPillActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  dayPillEdge:   { backgroundColor: colors.primary },
  dayName: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  dayDate: { ...typography.bodySm,  color: colors.textPrimary,   fontWeight: '700', marginTop: 2 },
  dayTextActive: { color: colors.textInverse },

  helper: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },

  note: {
    minHeight: 70,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },

  actions: { flexDirection: 'row', marginTop: spacing.md },
});
