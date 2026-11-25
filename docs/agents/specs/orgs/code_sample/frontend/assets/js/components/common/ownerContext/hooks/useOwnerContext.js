import { createContext, useContext } from 'react';
import { PERSONAL } from '../../../../utils/context/ownerContext.js';

/** Owner-context value used outside any provider. */
export const DEFAULT_OWNER_CONTEXT = Object.freeze({
  context: PERSONAL,
  page: 'home',
  userId: null,
  orgs: [],
  orgsLoaded: false,
  orgsError: null,
  refreshOrgs: () => Promise.resolve(),
  role: null,
  refreshRole: () => Promise.resolve(),
});

/** React context carrying the active owner context and the organization list. */
export const OwnerContext = createContext(DEFAULT_OWNER_CONTEXT);

/**
 * Read the active owner context.
 *
 * @returns {{context: object, page: string, userId: (number|null), orgs: Array<object>,
 *   orgsLoaded: boolean, orgsError: (string|null), refreshOrgs: Function,
 *   role: (string|null), refreshRole: Function}} The provider value.
 */
export default function useOwnerContext() {
  return useContext(OwnerContext);
}
