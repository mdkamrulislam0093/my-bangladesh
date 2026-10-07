import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider, useI18n } from "./i18n/I18nProvider";
import "./index.css";

function ErrorScreen() {
  const { t } = useI18n();
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="font-display text-2xl font-semibold">{t("error.title")}</h1>
        <p className="mt-2 text-ink-2">{t("error.body")}</p>
        <button onClick={() => location.reload()} className="mt-6 h-11 rounded-full bg-green px-6 font-semibold text-white">
          {t("error.reload")}
        </button>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(error);
  }
  render() {
    return this.state.failed ? <ErrorScreen /> : this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>,
);
