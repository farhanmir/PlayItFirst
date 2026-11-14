import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: string | null;
}

/** Keeps HUD/play controls alive when WebGL is unavailable (headless CI, older GPUs). */
export class CafeCanvasFallback extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error: error.message || "WebGL unavailable" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Café canvas failed", error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="cafe-canvas cafe-canvas-fallback" role="img" aria-label="Café floorplan fallback">
          <p className="brand-inline">Play It First</p>
          <p>3D floor needs WebGL — HUD and controls still work.</p>
          <p className="muted">{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
