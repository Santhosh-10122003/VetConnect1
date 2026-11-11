import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Appointment } from '../../api/appointmentApi';
import { drName, hhmm } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';

type IconName = keyof typeof Ionicons.glyphMap;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** "Today", "Tomorrow", "In 3 days", or the date, so nobody has to work it out from 2026-11-08. */
export const whenText = (iso: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = parse(iso);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return `${DAYS[d.getDay()]}, in ${diff} days`;
  if (diff === -1) return 'Yesterday';
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** What the status means, in a few plain words, and what to do about it. */
export const statusInfo = (a: Appointment): { label: string; hint: string; icon: IconName; color: string; bg: string } => {
  switch (a.status) {
    case 'AWAITING_PAYMENT':
      return { label: 'Pay advance', hint: 'Pay the advance to keep your time', icon: 'card', color: colors.warnText, bg: colors.warnBg };
    case 'PENDING':
      return { label: 'Waiting for doctor', hint: 'The doctor will accept or decline soon', icon: 'time', color: colors.warnText, bg: colors.warnBg };
    case 'CONFIRMED':
      return { label: 'Confirmed', hint: 'You are all set. Just turn up on time', icon: 'checkmark-circle', color: colors.successText, bg: colors.successBg };
    case 'COMPLETED':
      return { label: 'Done', hint: 'Visit finished', icon: 'checkmark-done', color: colors.ink, bg: colors.mint };
    case 'CANCELLED':
      return { label: 'Cancelled', hint: 'This visit was cancelled', icon: 'close-circle', color: colors.dangerText, bg: colors.dangerBg };
    case 'REJECTED':
      return { label: 'Declined', hint: 'The doctor could not take this visit', icon: 'close-circle', color: colors.dangerText, bg: colors.dangerBg };
    case 'EXPIRED':
      return { label: 'Expired', hint: 'The advance was not paid in time', icon: 'timer', color: colors.dangerText, bg: colors.dangerBg };
    case 'NO_SHOW':
      return { label: 'Missed', hint: 'You did not make it to this visit', icon: 'alert-circle', color: colors.dangerText, bg: colors.dangerBg };
    default:
      return { label: a.status, hint: '', icon: 'ellipse', color: colors.textSecondary, bg: colors.subtle };
  }
};

interface Props {
  appointment: Appointment;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onPay: () => void;
  onCancel: () => void;
  onReview: () => void;
  onBookAgain: () => void;
  /** A pet-care booking shown in the same list: the name is a business (no "Dr."), and there may be no clock time. */
  care?: boolean;
}

/** One visit: the day, who it is for, and one clear status. Tap it to open the few things you can do. */
export const VisitCard: React.FC<Props> = ({ appointment: a, expanded, onToggle, onOpen, onPay, onCancel, onReview, onBookAgain, care }) => {
  const s = statusInfo(a);
  const d = parse(a.appointmentDate);
  const open = a.status === 'CONFIRMED' || a.status === 'PENDING' || a.status === 'AWAITING_PAYMENT';
  const needsPay = a.status === 'AWAITING_PAYMENT';
  const canReview = a.status === 'COMPLETED' && !a.hasReview;
  const canRebook = a.status === 'COMPLETED' || a.status === 'CANCELLED' || a.status === 'REJECTED' || a.status === 'EXPIRED';

  return (
    <View style={[styles.card, needsPay && styles.cardPay]} testID={`visit-${a.id}`}>
      <TouchableOpacity style={styles.main} onPress={onToggle} activeOpacity={0.85} testID={`visit-toggle-${a.id}`}>
        <View style={[styles.dateBox, open ? styles.dateBoxOn : styles.dateBoxOff]}>
          <Text style={[styles.dateDay, open && { color: '#FFFFFF' }]}>{d.getDate()}</Text>
          <Text style={[styles.dateMonth, open && { color: colors.skyOnDark }]}>{MONTHS[d.getMonth()]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{a.petName} <Text style={styles.with}>{care ? 'at' : 'with'} {care ? a.doctorName : drName(a.doctorName)}</Text></Text>
          <Text style={styles.when} numberOfLines={1}>{whenText(a.appointmentDate)}{a.startTime ? ` · ${hhmm(a.startTime)}` : ''}</Text>
          <View style={[styles.chip, { backgroundColor: s.bg }]}>
            <Ionicons name={s.icon} size={13} color={s.color} />
            <Text style={[styles.chipText, { color: s.color }]}>{s.label}</Text>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </TouchableOpacity>

      {needsPay && (
        <TouchableOpacity style={styles.payBtn} onPress={onPay} activeOpacity={0.85} testID={`visit-pay-${a.id}`}>
          <Ionicons name="card" size={16} color="#FFFFFF" />
          <Text style={styles.payText}>Pay the advance to keep your time</Text>
        </TouchableOpacity>
      )}

      {!!a.rescheduleRequest && (
        <View style={styles.note} testID="reschedule-tag">
          <Ionicons name="swap-horizontal" size={14} color={colors.warnText} />
          <Text style={styles.noteText} numberOfLines={2}>Waiting for the doctor to approve your new time</Text>
        </View>
      )}

      {expanded && (
        <View style={styles.more}>
          <Text style={styles.hint}>{s.hint}</Text>
          {!!a.startTime && <View style={styles.line}><Ionicons name="time-outline" size={16} color={colors.textSecondary} /><Text style={styles.lineText}>{hhmm(a.startTime)}{a.endTime ? ` to ${hhmm(a.endTime)}` : ''}</Text></View>}
          <View style={styles.line}><Ionicons name="location-outline" size={16} color={colors.textSecondary} /><Text style={styles.lineText} numberOfLines={2}>{a.clinicName}{a.clinicAddress ? `, ${a.clinicAddress}` : ''}</Text></View>
          {!!a.reason && <View style={styles.line}><Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textSecondary} /><Text style={styles.lineText} numberOfLines={2}>{a.reason}</Text></View>}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.act, styles.actMain]} onPress={onOpen} activeOpacity={0.85} testID={`visit-open-${a.id}`}>
              <Ionicons name="open-outline" size={15} color="#FFFFFF" />
              <Text style={styles.actMainText}>Open</Text>
            </TouchableOpacity>
            {open && !needsPay && (
              <TouchableOpacity style={[styles.act, styles.actDanger]} onPress={onCancel} activeOpacity={0.85} testID={`visit-cancel-${a.id}`}>
                <Ionicons name="close" size={15} color={colors.danger} />
                <Text style={styles.actDangerText}>Cancel</Text>
              </TouchableOpacity>
            )}
            {canReview && (
              <TouchableOpacity style={[styles.act, styles.actStar]} onPress={onReview} activeOpacity={0.85} testID={`visit-review-${a.id}`}>
                <Ionicons name="star" size={15} color="#FFFFFF" />
                <Text style={styles.actMainText}>Rate</Text>
              </TouchableOpacity>
            )}
            {canRebook && (
              <TouchableOpacity style={[styles.act, styles.actLight]} onPress={onBookAgain} activeOpacity={0.85} testID={`visit-again-${a.id}`}>
                <Ionicons name="refresh" size={15} color={colors.primary} />
                <Text style={styles.actLightText}>Book again</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = themedStyles(() => ({
  card: { backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.border, marginBottom: 12, overflow: 'hidden' },
  cardPay: { borderColor: colors.warnBorder, borderWidth: 1.5 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  dateBox: { width: 54, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dateBoxOn: { backgroundColor: '#14171C' },
  dateBoxOff: { backgroundColor: colors.subtle },
  dateDay: { fontSize: 22, fontWeight: '800', color: colors.text, lineHeight: 25 },
  dateMonth: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  with: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  when: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 7 },
  chipText: { fontSize: 12, fontWeight: '800' },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#14171C', marginHorizontal: 14, marginBottom: 14, borderRadius: 14, paddingVertical: 12 },
  payText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warnBg, marginHorizontal: 14, marginBottom: 12, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  noteText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.warnText },
  more: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  hint: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  lineText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14 },
  actMain: { backgroundColor: '#14171C' },
  actMainText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  actDanger: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder },
  actDangerText: { color: colors.danger, fontWeight: '800', fontSize: 13 },
  actStar: { backgroundColor: colors.star },
  actLight: { backgroundColor: colors.mint },
  actLightText: { color: colors.ink, fontWeight: '800', fontSize: 13 },
}));
