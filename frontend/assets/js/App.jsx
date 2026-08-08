import { useEffect, useMemo, useState } from 'react';
import AppController from './components/AppController.js';
import AppHelper from './components/helpers/AppHelper.jsx';

/**
 * Root application component: resolves the current hash route and renders the matching
 * page inside the shared header.
 *
 * @returns {React.ReactElement} The rendered application.
 */
export default function App() {
  const [page, setPage] = useState('home');

  const controller = useMemo(() => new AppController(setPage), []);

  useEffect(() => {
    setPage(controller.getPage());
    return controller.buildEffect()();
  }, [controller]);

  return AppHelper.render(page);
}
