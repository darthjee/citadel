import Header from '../common/header/Header.jsx';
import LoginModal from '../common/loginModal/LoginModal.jsx';
import ModalRedirect from '../common/ModalRedirect.jsx';
import Home from '../resources/home/pages/Home.jsx';
import ResetPasswordLanding from '../resources/accounts/pages/ResetPasswordLanding.jsx';
import AdminUsers from '../resources/admin/pages/AdminUsers.jsx';
import AdminUserEdit from '../resources/admin/pages/AdminUserEdit.jsx';
import AuthorizationRequests from '../resources/accounts/pages/AuthorizationRequests.jsx';
import MyAccount from '../resources/accounts/pages/MyAccount.jsx';

const PAGES = new Map([
  ['register', <ModalRedirect mode="register" />],
  ['login', <ModalRedirect mode="password" />],
  ['reset-password', <ResetPasswordLanding />],
  ['admin-users', <AdminUsers />],
  ['admin-user-edit', <AdminUserEdit />],
  ['authorization-requests', <AuthorizationRequests />],
  ['my-account', <MyAccount />],
  ['home', <Home />],
]);

/**
 * Helper for application page rendering: maps a page key to its component.
 * Follows the object-module convention: a plain exported object whose public methods are
 * the only entry points.
 */
const AppHelper = {
  /**
   * Render the app shell wrapping the page matching the given key, plus the route-independent
   * login modal. Unknown keys fall back to the home page.
   *
   * @param {string} page - Current page key.
   * @returns {React.ReactElement} The rendered app shell.
   */
  render(page) {
    return (
      <>
        <Header>
          {PAGES.get(page) ?? PAGES.get('home')}
        </Header>
        <LoginModal />
      </>
    );
  },
};

export default AppHelper;
