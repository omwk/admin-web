import type {
  NotificationPreference,
  NotificationPreferenceView,
} from '#/api/model/notification';

export const preferenceKey = (
  value: Pick<NotificationPreference, 'channel' | 'template'>,
) => `${value.template}:${value.channel}`;

export function changedPreferences(
  original: NotificationPreferenceView[],
  draft: NotificationPreferenceView[],
): NotificationPreference[] {
  const before = new Map(
    original.map((value) => [preferenceKey(value), value]),
  );
  return draft
    .filter((value) => {
      const previous = before.get(preferenceKey(value));
      return (
        !value.inherited &&
        previous &&
        (previous.inherited || value.enabled !== previous.enabled)
      );
    })
    .map(({ template, channel, enabled }) => ({ template, channel, enabled }));
}
