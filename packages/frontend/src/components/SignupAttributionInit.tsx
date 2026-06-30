import { useEffect } from 'react';
import { captureSignupAttribution } from '../utils/signupAttribution';

/** Runs once on load to persist first-touch UTM / referrer for signup attribution. */
export default function SignupAttributionInit() {
  useEffect(() => {
    captureSignupAttribution();
  }, []);
  return null;
}
