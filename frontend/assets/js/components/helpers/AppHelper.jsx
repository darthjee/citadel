import { Fragment } from 'react';
import Header from '../common/header/Header.jsx';
import LoginModal from '../common/loginModal/LoginModal.jsx';
import ModalRedirect from '../common/ModalRedirect.jsx';
import Home from '../resources/home/pages/Home.jsx';
import ResetPasswordLanding from '../resources/accounts/pages/ResetPasswordLanding.jsx';
import AdminUsers from '../resources/admin/pages/AdminUsers.jsx';
import AdminUserEdit from '../resources/admin/pages/AdminUserEdit.jsx';
import AuthorizationRequests from '../resources/accounts/pages/AuthorizationRequests.jsx';
import MyAccount from '../resources/accounts/pages/MyAccount.jsx';
import OrganizationNew from '../resources/organizations/pages/OrganizationNew.jsx';
import OrganizationOverview from '../resources/organizations/pages/OrganizationOverview.jsx';
import OrganizationEdit from '../resources/organizations/pages/OrganizationEdit.jsx';
import NotFound from '../common/notFound/NotFound.jsx';

const PAGES = new Map([
  ['register', <ModalRedirect mode="register" />],
  ['login', <ModalRedirect mode="password" />],
  ['reset-password', <ResetPasswordLanding />],
  ['admin-users', <AdminUsers />],
  ['admin-user-edit', <AdminUserEdit />],
  ['authorization-requests', <AuthorizationRequests />],
  ['my-account', <MyAccount />],
  ['org-new', <OrganizationNew />],
  ['org-overview', <OrganizationOverview />],
  ['org-edit', <OrganizationEdit />],
  ['not-found', <NotFound />],
  ['home', <Home />],
]);

/**
 * Build a React key for an owner context, so a page is remounted (fresh state, fresh fetch) when
 * the context changes, e.g. from one organization to another.
 *
 * @param {object} [context] - The owner context.
 * @returns {string} `personal` or `org-<id>`.
 */
function contextKey(context) {
  return context?.kind === 'organization' ? `org-${context.orgId}` : 'personal';
}

/**
 * Helper for application page rendering: maps a page key to its component.
 * Follows the object-module convention: a plain exported object whose public methods are
 * the only entry points.
 */
const AppHelper = {
  /**
   * Render the app shell wrapping the page matching the given route, plus the route-independent
   * login modal. The page is keyed by the owner context, so switching contexts remounts it.
   * Unknown page keys fall back to the home page.
   *
   * @param {{page: string, context: object}} route - Current route (page key and owner context).
   * @returns {React.ReactElement} The rendered app shell.
   */
  render(route) {
    return (
      <>
        <Header>
          <Fragment key={contextKey(route.context)}>
            {PAGES.get(route.page) ?? PAGES.get('home')}
          </Fragment>
        </Header>
        <LoginModal />
      </>
    );
  },
};

export default AppHelper;
