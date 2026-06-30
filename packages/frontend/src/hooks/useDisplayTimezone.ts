import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetPreferencesQuery } from '../store/preferencesApi';
import { fmtDateTimeWithTimezone } from '../utils/format';
import { getUserTimezone } from '../utils/timezone';
import { tokenStorage } from '../store/authApi';

export function useDisplayTimezone() {
  const { i18n } = useTranslation();
  const isLoggedIn = Boolean(tokenStorage.getAccessToken());
  const { data: prefs } = useGetPreferencesQuery(undefined, { skip: !isLoggedIn });

  const displayTimezone = useMemo(
    () => prefs?.displayTimezone || prefs?.timezone || getUserTimezone(),
    [prefs?.displayTimezone, prefs?.timezone],
  );

  const formatDateTime = useCallback(
    (value: Date | string | null | undefined, includeSeconds = false) =>
      fmtDateTimeWithTimezone(value, displayTimezone, i18n.language, includeSeconds),
    [displayTimezone, i18n.language],
  );

  return { displayTimezone, formatDateTime };
}
