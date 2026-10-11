"use client";

import { ConvexProvider, ConvexReactClient, useMutation } from "convex/react";
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import { readableError } from "@/lib/errors";

const STORAGE_KEY = "paypilot.accessKey";
const LOCK_KEY = "paypilot.creating";
const SESSION_EVENT = "paypilot-session";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

type WorkspaceContextValue = {
  configured: boolean;
  ready: boolean;
  accessKey: string | null;
  error: string | null;
  reset: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
  configured: false,
  ready: true,
  accessKey: null,
  error: null,
  reset: () => undefined,
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  if (!convex) return children;
  return (
    <ConvexProvider client={convex}>
      <WorkspaceBridge>{children}</WorkspaceBridge>
    </ConvexProvider>
  );
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(SESSION_EVENT, onStoreChange);
  return () => window.removeEventListener(SESSION_EVENT, onStoreChange);
}

function readAccessKey() {
  return window.localStorage.getItem(STORAGE_KEY);
}

function publishSession() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

function WorkspaceBridge({ children }: { children: React.ReactNode }) {
  const ensure = useMutation(api.workspaces.ensure);
  const accessKey = useSyncExternalStore(subscribe, readAccessKey, () => null);
  const [error, setError] = useState<string | null>(null);

  const openWorkspace = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.setItem(LOCK_KEY, "1");
    publishSession();
    void ensure({})
      .then((result) => {
        window.localStorage.setItem(STORAGE_KEY, result.accessKey);
        window.localStorage.removeItem(LOCK_KEY);
        publishSession();
      })
      .catch((reason: unknown) => {
        window.localStorage.removeItem(LOCK_KEY);
        setError(readableError(reason));
      });
  }, [ensure]);

  const reset = useCallback(() => {
    setError(null);
    openWorkspace();
  }, [openWorkspace]);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    if (window.localStorage.getItem(LOCK_KEY) === "1") {
      const timer = window.setInterval(() => {
        if (window.localStorage.getItem(STORAGE_KEY)) {
          window.clearInterval(timer);
          publishSession();
        }
      }, 200);
      return () => window.clearInterval(timer);
    }
    openWorkspace();
  }, [openWorkspace]);

  return (
    <WorkspaceContext.Provider
      value={{
        configured: true,
        ready: accessKey !== null || error !== null,
        accessKey,
        error,
        reset,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
