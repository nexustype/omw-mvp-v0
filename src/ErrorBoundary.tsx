import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(err: any) { return { hasError: true, message: String(err) }; }
  componentDidCatch(err: any, info: any) { console.error("🟥 ErrorBoundary caught:", err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:16, fontFamily:"system-ui"}}>
          <h2>Something went wrong.</h2>
          <pre style={{whiteSpace:"pre-wrap"}}>{this.state.message}</pre>
          <button onClick={() => location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
