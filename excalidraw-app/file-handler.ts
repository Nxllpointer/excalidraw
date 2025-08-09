import { useSyncExternalStore } from "react";

import type { FileSystemHandle } from "@excalidraw/excalidraw/data/filesystem";

type Opened = { blob: Blob; fileHandle: FileSystemHandle };

let currentlyOpened: Opened | null = null;
const subscribers: { [key: number]: () => void } = {};
let nextKey = 1;

function updateLaunchQueue(initialLaunch = false) {
  if ("launchQueue" in window && "LaunchParams" in window) {
    (window as any).launchQueue.setConsumer(
      async (launchParams: { files: any[] }) => {
        updateLaunchQueue();

        // Prevent retriggering launchQueue on pare reload
        const url = new URL(window.location.href);
        if (url.searchParams.has("open-file")) {
          url.searchParams.delete("open-file");
          window.history.replaceState(null, "", url);
        } else if (initialLaunch) {
          return;
        }

        if (
          launchParams.files.length === 0 ||
          launchParams.files[0].kind !== "file"
        ) {
          return;
        }

        const fileHandle = launchParams.files[0];
        const blob: Blob = await fileHandle.getFile();

        currentlyOpened = { blob, fileHandle };

        Object.values(subscribers).forEach((s) => s());
      },
    );
  }
}

function subscribe(callback: () => void) {
  const thisKey = nextKey++;
  subscribers[thisKey] = callback;
  updateLaunchQueue();

  return () => {
    delete subscribers[thisKey];
    updateLaunchQueue();
  };
}

function getSnapshot() {
  return currentlyOpened;
}

export function usePwaOpenedFile() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

updateLaunchQueue(true);
