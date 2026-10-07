import Home from "./pages/Home";

/** One page. Any path (old /create or /map/… links included) shows it. */
export default function App() {
  if (location.pathname !== "/") history.replaceState(null, "", "/" + location.search);
  return <Home />;
}
