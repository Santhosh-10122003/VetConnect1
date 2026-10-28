import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { reviewApi } from '../../api/reviewApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { CustomerStackParamList } from '../../navigation/types';
import { getErrorMessage, notify, drName } from '../../utils/helpers';

type Props = NativeStackScreenProps<CustomerStackParamList, 'AddReview'>;

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export const AddReviewScreen: React.FC<Props> = ({ navigation, route }) => {
  const { doctorId, doctorName, appointmentId } = route.params;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (rating < 1) return notify('Rating required', 'Tap a star to rate your visit.');
    setSaving(true);
    try {
      await reviewApi.createReview(doctorId, { appointmentId, rating, comment: comment.trim() || undefined });
      notify('Thank you!', 'Your review has been submitted.');
      navigation.goBack();
    } catch (e) {
      notify('Could not submit review', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={shared.screen}>
      <AppHeader title="Rate your visit" showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <View style={[shared.card, { alignItems: 'center' }]}>
          <Text style={styles.q}>How was your visit with</Text>
          <Text style={styles.name}>{drName(doctorName)}?</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={40} color={colors.star} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>{LABELS[rating] || 'Tap to rate'}</Text>
        </View>
        <AppInput
          label="Share more (optional)"
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={500}
          style={{ height: 110, textAlignVertical: 'top', paddingTop: 12 }}
          placeholder="What went well? What could be better?"
        />
        <AppButton title="Submit Review" onPress={submit} loading={saving} />
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  q: { fontSize: 14, color: colors.textSecondary },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  stars: { flexDirection: 'row', gap: 8 },
  label: { marginTop: 10, fontSize: 14, fontWeight: '600', color: colors.primary },
});
