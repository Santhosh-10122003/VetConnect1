import { DateField, toIso } from '../common/DateField';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { AvailableSlot } from '../../api/doctorApi';

interface TimeSlotPickerProps {
  slots: AvailableSlot[];
  selectedSlot: AvailableSlot | null;
  onSelectSlot: (slot: AvailableSlot) => void;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  loading?: boolean;
}

export const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  slots,
  selectedSlot,
  onSelectSlot,
  selectedDate,
  onSelectDate,
  loading = false,
}) => {
  // Generate next 14 days
  const dates = React.useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const iso = toIso(d); // local date: toISOString() is UTC and can be yesterday east of Greenwich
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      list.push({ iso, dayName, dayNum, monthName });
    }
    return list;
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Select Date</Text>
      <DateField
        value={selectedDate}
        onChange={(iso) => iso && onSelectDate(iso)}
        minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
        maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() + 1))}
        placeholder="Pick a date"
        testID="booking-date"
      />
      <Text style={styles.quickLabel}>Or choose one of the next 14 days</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateList}
      >
        {dates.map((item) => {
          const isSelected = item.iso === selectedDate;
          return (
            <TouchableOpacity
              key={item.iso}
              style={[styles.dateCard, isSelected && styles.selectedDateCard]}
              onPress={() => onSelectDate(item.iso)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayName, isSelected && styles.selectedText]}>{item.dayName}</Text>
              <Text style={[styles.dayNum, isSelected && styles.selectedText]}>{item.dayNum}</Text>
              <Text style={[styles.monthName, isSelected && styles.selectedText]}>{item.monthName}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionTitle}>Available Time Slots</Text>
      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading available slots...</Text>
        </View>
      ) : slots.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No available slots for this date. Please choose another date.</Text>
        </View>
      ) : (
        <View style={styles.slotsGrid}>
          {slots.map((slot, index) => {
            const isSelected =
              selectedSlot &&
              selectedSlot.date === slot.date &&
              selectedSlot.startTime === slot.startTime;

            return (
              <TouchableOpacity
                key={`${slot.startTime}-${index}`}
                style={[
                  styles.slotChip,
                  !slot.available && styles.disabledSlot,
                  isSelected && styles.selectedSlot,
                ]}
                disabled={!slot.available}
                onPress={() => onSelectSlot(slot)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.slotText,
                    !slot.available && styles.disabledSlotText,
                    isSelected && styles.selectedSlotText,
                  ]}
                >
                  {slot.startTime.substring(0, 5)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  quickLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8, marginTop: -6 },
  container: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  dateList: {
    paddingBottom: 16,
    gap: 10,
  },
  dateCard: {
    width: 68,
    height: 84,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  selectedDateCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayName: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dayNum: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginVertical: 2,
  },
  monthName: {
    fontSize: 11,
    color: colors.textMuted,
  },
  selectedText: {
    color: '#FFFFFF',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotChip: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSlot: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.5,
  },
  selectedSlot: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  disabledSlotText: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  selectedSlotText: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
