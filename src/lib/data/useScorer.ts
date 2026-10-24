import type { ScorerInfo } from '../types';
import { useAuth } from './context';

/**
 * The signed-in admin as a match's scorer: their account id (to tell phones apart) and first name
 * ("Being scored on Yuva's phone"). No email, since tournaments can be read by anyone.
 */
export function useScorer(): ScorerInfo {
  const { user } = useAuth();
  return { id: user?.uid ?? '', name: user?.displayName?.trim().split(/\s+/)[0] || 'an admin' };
}
