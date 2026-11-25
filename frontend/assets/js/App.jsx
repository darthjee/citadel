import { useEffect, useMemo, useState } from 'react';
import AppController from './components/AppController.js';
import AppHelper from './components/helpers/AppHelper.jsx';
import OwnerContextProvider from './components/common/ownerContext/OwnerContextProvider.jsx';
import { PERSONAL } from './utils/context/ownerContext.js';

/** Route rendered before the first hash resolution. */
const INITIAL_ROUTE = { page: 'home', context: PERSONAL };

/**
 * Root application component: resolves the current hash route and renders the matching
 * page inside the shared header, under the owner-context provider.
 *
 * @returns {React.ReactElement} The rendered application.
 */
export default function App() {
  const [route, setRoute] = useState(INITIAL_ROUTE);

  const controller = useMemo(() => new AppController(setRoute), []);

  useEffect(() => {
    setRoute(controller.getRoute());
    return controller.buildEffect()();
  }, [controller]);

  return (
    <OwnerContextProvider route={route}>
      {AppHelper.render(route.page)}
    </OwnerContextProvider>
  );
}
